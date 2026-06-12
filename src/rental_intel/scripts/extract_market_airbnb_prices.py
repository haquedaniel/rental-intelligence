from __future__ import annotations

import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests
import yaml
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"
RAW = ROOT / "outputs" / "raw" / "market"

DEFAULT_ACTOR_ID = "sve/airbnb-price-scraper"


def load_csv(name: str) -> pd.DataFrame:
    path = PROCESSED / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, dtype={"airbnb_id": str})


def load_market_config(client_id: str) -> dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}_market.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing market config: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def actor_to_url_actor_id(actor_id: str) -> str:
    return actor_id.replace("/", "~")

def normalise_airbnb_id(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text


def parse_money(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None

    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).replace("\u00a0", " ").strip()
    cleaned = re.sub(r"[^0-9,.-]", "", text)

    if not cleaned:
        return None

    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(".") > cleaned.rfind(","):
            cleaned = cleaned.replace(",", "")
        else:
            cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")

    try:
        return float(cleaned)
    except ValueError:
        return None


def flatten_breakdown(raw: dict[str, Any]) -> dict[str, Any]:
    breakdown = raw.get("breakdown") or raw.get("priceBreakdown") or {}

    if not isinstance(breakdown, dict):
        return {}

    return {
        "base_rate_raw": breakdown.get("base_rate")
        or breakdown.get("baseRate")
        or breakdown.get("basePrice"),
        "cleaning_fee": parse_money(
            breakdown.get("cleaning_fee") or breakdown.get("cleaningFee")
        ),
        "service_fee": parse_money(
            breakdown.get("service_fee") or breakdown.get("serviceFee")
        ),
        "taxes": parse_money(breakdown.get("taxes")),
    }


def summarise_error(error: str) -> str:
    text = str(error or "")

    if "Property is unavailable for the requested dates" in text:
        return "Property unavailable for requested dates"

    if "Timed out waiting for booking widget" in text:
        return "Timed out waiting for booking widget"

    if "net::ERR_TIMED_OUT" in text:
        return "Network timeout"

    if "net::ERR_TUNNEL_CONNECTION_FAILED" in text:
        return "Proxy tunnel connection failed"

    if "Monthly usage hard limit exceeded" in text:
        return "Apify monthly usage hard limit exceeded"

    if "Actor run did not succeed" in text:
        return "Actor run did not succeed"

    return text[:500]

def classify_error(error: str) -> str:
    text = str(error or "").lower()

    if "property is unavailable for the requested dates" in text:
        return "property_unavailable"
    
    if "net::err_timed_out" in text:
        return "network_timeout"

    if "timed out waiting for booking widget" in text:
        return "booking_widget_timeout"

    if "monthly usage hard limit exceeded" in text:
        return "apify_limit_exceeded"

    if "actor run did not succeed" in text:
        return "actor_run_failed"

    if "http 403" in text:
        return "http_403"

    if "http 400" in text:
        return "http_400"

    if "timeout" in text:
        return "timeout"

    return "unknown_error"


def call_apify_actor_with_logs(
    actor_id: str,
    apify_token: str,
    payload: dict[str, Any],
    timeout_seconds: int = 240,
    poll_seconds: float = 3.0,
) -> tuple[str, list[dict[str, Any]], str, str]:
    """
    Returns:
      status: success_available / success_unavailable / failed_scrape
      dataset_items: list of actor dataset items
      error_type: classified error type
      error_text: useful error/log text
    """
    actor_url_id = actor_to_url_actor_id(actor_id)

    # 1. Start run
    start_url = f"https://api.apify.com/v2/acts/{actor_url_id}/runs"
    start_response = requests.post(
        start_url,
        params={"token": apify_token},
        json=payload,
        timeout=60,
    )

    if not start_response.ok:
        error_text = f"Apify HTTP {start_response.status_code}: {start_response.text[:2000]}"
        return "failed_scrape", [], classify_error(error_text), error_text

    run = start_response.json().get("data", {})
    run_id = run.get("id")

    if not run_id:
        error_text = f"No Apify run id returned: {start_response.text[:2000]}"
        return "failed_scrape", [], classify_error(error_text), error_text

    # 2. Poll run
    run_url = f"https://api.apify.com/v2/actor-runs/{run_id}"
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        run_response = requests.get(
            run_url,
            params={"token": apify_token},
            timeout=60,
        )

        if not run_response.ok:
            error_text = f"Apify run poll HTTP {run_response.status_code}: {run_response.text[:2000]}"
            return "failed_scrape", [], classify_error(error_text), error_text

        run_data = run_response.json().get("data", {})
        run_status = run_data.get("status")

        if run_status in {"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"}:
            break

        time.sleep(poll_seconds)
    else:
        error_text = f"Apify run polling timed out after {timeout_seconds}s, run_id={run_id}"
        return "failed_scrape", [], classify_error(error_text), error_text

    # 3. Fetch log text, useful even for failures
    log_text = ""
    log_url = f"https://api.apify.com/v2/logs/{run_id}"
    log_response = requests.get(
        log_url,
        params={"token": apify_token},
        timeout=60,
    )
    if log_response.ok:
        log_text = log_response.text or ""

    # 4. If failed but log says unavailable, treat as clean unavailable
    if run_status != "SUCCEEDED":
        error_type = classify_error(log_text)

        if error_type == "property_unavailable":
            return "success_unavailable", [], error_type, log_text[-3000:]

        return "failed_scrape", [], error_type, log_text[-3000:] or f"Apify run {run_status}"

    # 5. Fetch dataset items
    dataset_id = run_data.get("defaultDatasetId")

    if not dataset_id:
        error_text = f"Apify run succeeded but no dataset id returned. run_id={run_id}"
        return "failed_scrape", [], classify_error(error_text), error_text

    dataset_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items"
    dataset_response = requests.get(
        dataset_url,
        params={"token": apify_token, "clean": "true"},
        timeout=60,
    )

    if not dataset_response.ok:
        error_text = f"Apify dataset HTTP {dataset_response.status_code}: {dataset_response.text[:2000]}"
        return "failed_scrape", [], classify_error(error_text), error_text

    data = dataset_response.json()

    if isinstance(data, list):
        items = [x for x in data if isinstance(x, dict)]
    elif isinstance(data, dict):
        items = [data]
    else:
        items = []

    if not items:
        return "success_unavailable", [], "no_dataset_items", log_text[-3000:]

    return "success_available", items, "", ""

def job_to_apify_input(
    job: pd.Series,
    max_retries: int = 1,
    locale: str = "en",
    currency: str = "EUR",
) -> dict[str, Any]:
    return {
        "propertyId": normalise_airbnb_id(job["airbnb_id"]),
        "checkIn": str(job["check_in"]),
        "checkOut": str(job["check_out"]),
        "adults": int(job.get("adults") or 2),
        "children": int(job.get("children") or 0),
        "infants": int(job.get("infants") or 0),
        "pets": int(job.get("pets") or 0),
        "maxRetries": max_retries,
        "locale": locale,
        "currency": currency,
    }


def classify_result(raw_item: dict[str, Any] | None) -> tuple[str, bool, float | None]:
    """
    Return (status, available, total_amount).

    Important distinction:
    - success_available: price returned
    - success_unavailable: scrape succeeded but no price returned
    - failed_scrape: HTTP/API/parser error handled outside this function
    """
    raw_item = raw_item or {}

    total = (
        raw_item.get("totalAmount")
        or raw_item.get("total")
        or raw_item.get("total_price")
        or raw_item.get("price")
    )

    total_amount = parse_money(total)

    if total_amount is not None and total_amount > 0:
        return "success_available", True, total_amount

    return "success_unavailable", False, None


def normalise_result(
    job: pd.Series,
    run_id: str,
    scraped_at: str,
    raw_item: dict[str, Any] | None,
    status: str,
    available: bool,
    total_amount: float | None,
    error: str = "",
    error_log_path: str = "",
    keep_full_error: bool = False,
) -> dict[str, Any]:
    raw_item = raw_item or {}
    nights = int(job.get("nights") or 0)
    nightly_amount = (
        round(total_amount / nights, 2)
        if total_amount is not None and nights
        else None
    )

    breakdown = flatten_breakdown(raw_item)

    return {
        "run_id": run_id,
        "scraped_at": scraped_at,
        "job_type": job.get("job_type"),
        "portfolio_id": job.get("portfolio_id"),
        "market_set_id": job.get("market_set_id"),
        "competitor_id": job.get("competitor_id"),
        "competitor_name": job.get("competitor_name"),
        "source": job.get("source"),
        "airbnb_id": normalise_airbnb_id(job.get("airbnb_id")),
        "expected_price_index": job.get("expected_price_index"),
        "guest_price_to_comparable_factor": job.get("guest_price_to_comparable_factor", 1.0),
        "scenario_id": job.get("scenario_id"),
        "window_index": job.get("window_index"),
        "check_in": job.get("check_in"),
        "check_out": job.get("check_out"),
        "nights": nights,
        "adults": job.get("adults"),
        "children": job.get("children"),
        "infants": job.get("infants"),
        "pets": job.get("pets"),
        "status": status,
        "available": available,
        "total_amount": total_amount,
        "nightly_amount": nightly_amount,
        "currency": raw_item.get("currency") or raw_item.get("currencyCode"),
        "base_rate_raw": breakdown.get("base_rate_raw"),
        "cleaning_fee": breakdown.get("cleaning_fee"),
        "service_fee": breakdown.get("service_fee"),
        "taxes": breakdown.get("taxes"),
        "error_type": classify_error(error) if error else "",
        "error_summary": summarise_error(error) if error else "",
        "error_log_path": error_log_path,
        "error": error if keep_full_error else "",
    }


def append_to_history(path: Path, df: pd.DataFrame) -> pd.DataFrame:
    if path.exists():
        existing = pd.read_csv(path)
        combined = pd.concat([existing, df], ignore_index=True)
    else:
        combined = df

    combined.to_csv(path, index=False)
    return combined


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--client-id", default="daniel_aurore")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--sleep-seconds", type=float, default=0.5)
    parser.add_argument("--competitor-id", default=None)
    parser.add_argument("--scenario-id", default=None)
    parser.add_argument(
        "--keep-full-error",
        action="store_true",
        help="Store full Apify error/log text in the CSV. Normally keep this off; raw JSON already contains full logs.",
    )
    args = parser.parse_args()

    load_dotenv(ROOT / ".env", override=True)

    config = load_market_config(args.client_id)
    settings = config.get("settings", {}) or {}

    locale = settings.get("locale") or "en"
    currency = settings.get("currency") or "EUR"

    actor_id = settings.get("apify_actor_id") or DEFAULT_ACTOR_ID
    max_retries = int(settings.get("max_retries") or 1)
    max_scrapes_per_run = int(settings.get("max_scrapes_per_run") or 80)

    jobs = load_csv("market_probe_jobs.csv")

    if jobs.empty:
        raise FileNotFoundError(
            "market_probe_jobs.csv missing or empty. Run build_market_jobs first."
        )

    comp_jobs = jobs[jobs["job_type"].astype(str) == "competitor_airbnb"].copy()
    if args.competitor_id:
        comp_jobs = comp_jobs[
            comp_jobs["competitor_id"].astype(str) == str(args.competitor_id)
        ].copy()

    if args.scenario_id:
        comp_jobs = comp_jobs[
            comp_jobs["scenario_id"].astype(str) == str(args.scenario_id)
        ].copy()
    if comp_jobs.empty:
        print("No competitor Airbnb jobs found. Add active competitors to market YAML.")
        return

    comp_jobs = comp_jobs[comp_jobs["airbnb_id"].notna()]
    comp_jobs = comp_jobs[comp_jobs["airbnb_id"].astype(str).str.strip() != ""]

    if args.limit is not None:
        comp_jobs = comp_jobs.head(args.limit)

    if len(comp_jobs) > max_scrapes_per_run:
        raise RuntimeError(
            f"Refusing to run {len(comp_jobs)} scrapes; max_scrapes_per_run={max_scrapes_per_run}"
        )

    token = os.environ.get("APIFY_TOKEN")

    if not args.dry_run and not token:
        raise ValueError("APIFY_TOKEN is required unless --dry-run is used")

    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%d_%H%M%S")
    scraped_at = now.isoformat()

    RAW.mkdir(parents=True, exist_ok=True)

    raw_path = RAW / f"airbnb_competitor_run_{run_id}.json"

    rows: list[dict[str, Any]] = []
    raw_records: list[dict[str, Any]] = []

    rows: list[dict[str, Any]] = []
    raw_records: list[dict[str, Any]] = []

    print(f"Run {run_id}: {len(comp_jobs)} competitor Airbnb jobs")
    print(f"Actor: {actor_id}")
    print(f"Dry run: {args.dry_run}")

    for idx, (_, job) in enumerate(comp_jobs.iterrows(), start=1):
        payload = job_to_apify_input(
            job,
            max_retries=max_retries,
            locale=locale,
            currency=currency,
        )

        print(
            f"[{idx}/{len(comp_jobs)}] {job.get('competitor_id')} "
            f"{job.get('scenario_id')} {job.get('check_in')} → {job.get('check_out')}"
        )

        if args.dry_run:
            rows.append(
                normalise_result(
                    job=job,
                    run_id=run_id,
                    scraped_at=scraped_at,
                    raw_item=None,
                    status="dry_run",
                    available=False,
                    total_amount=None,
                    error=error_text if status != "success_available" else "",
                    error_log_path=str(raw_path) if "raw_path" in locals() else "",
                    keep_full_error=args.keep_full_error,
                )
            )
            raw_records.append({"job": job.to_dict(), "payload": payload, "dry_run": True})
            continue

        try:
            status, result_items, error_type, error_text = call_apify_actor_with_logs(
                actor_id=actor_id,
                apify_token=token,
                payload=payload,
            )

            raw_item = result_items[0] if result_items else None

            if status == "success_available":
                parsed_status, available, total_amount = classify_result(raw_item)
                status = parsed_status
            elif status == "success_unavailable":
                available = False
                total_amount = None
            else:
                available = False
                total_amount = None

            rows.append(
                normalise_result(
                    job=job,
                    run_id=run_id,
                    scraped_at=scraped_at,
                    raw_item=raw_item,
                    status=status,
                    available=available,
                    total_amount=total_amount,
                    error=error_text if status != "success_available" else "",
                    error_log_path=str(raw_path) if "raw_path" in locals() else "",
                    keep_full_error=args.keep_full_error,
                )
            )

            # Override / preserve the more precise error type
            if rows[-1].get("error_type") == "" and error_type:
                rows[-1]["error_type"] = error_type

            raw_records.append(
                {
                    "job": job.to_dict(),
                    "payload": payload,
                    "result": result_items,
                    "status": status,
                    "error_type": error_type,
                    "error_text": error_text[-3000:] if error_text else "",
                }
            )

            raw_records.append(
                {
                    "job": job.to_dict(),
                    "payload": payload,
                    "result": result_items,
                    "status": status,
                }
            )

        except Exception as exc:
            rows.append(
                normalise_result(
                    job=job,
                    run_id=run_id,
                    scraped_at=scraped_at,
                    raw_item=None,
                    status="failed_scrape",
                    available=False,
                    total_amount=None,
                    error=repr(exc),
                    error_log_path=str(raw_path),
                    keep_full_error=args.keep_full_error,
                )
            )
            raw_records.append(
                {
                    "job": job.to_dict(),
                    "payload": payload,
                    "error": repr(exc),
                    "status": "failed_scrape",
                }
            )

        if args.sleep_seconds and not args.dry_run:
            time.sleep(args.sleep_seconds)

    run_df = pd.DataFrame(rows)

    latest_path = PROCESSED / "market_price_snapshots_latest.csv"
    history_path = PROCESSED / "market_price_snapshots.csv"
    #raw_path = RAW / f"airbnb_competitor_run_{run_id}.json"

    run_df.to_csv(latest_path, index=False)
    append_to_history(history_path, run_df)

    raw_path.write_text(
        json.dumps(raw_records, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    print()
    print(f"Wrote latest market snapshots to {latest_path}")
    print(f"Appended market snapshot history to {history_path}")
    print(f"Wrote raw market responses to {raw_path}")
    print()
    print("Status counts:")
    print(run_df.groupby("status").size().to_string())

    preview_cols = [
        "competitor_id",
        "market_set_id",
        "scenario_id",
        "check_in",
        "check_out",
        "status",
        "available",
        "total_amount",
        "nightly_amount",
        "error_type",
        "error_summary",
        "error_log_path",
    ]

    print()
    print(run_df[preview_cols].to_string(index=False))


if __name__ == "__main__":
    main()
