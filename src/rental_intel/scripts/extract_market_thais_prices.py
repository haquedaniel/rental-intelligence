from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests
import yaml


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"
RAW = ROOT / "outputs" / "raw" / "market"


def load_market_config(client_id: str) -> dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}_market.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing market config: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


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


def append_to_history(path: Path, df: pd.DataFrame) -> pd.DataFrame:
    if path.exists():
        existing = pd.read_csv(path)
        combined = pd.concat([existing, df], ignore_index=True)
    else:
        combined = df

    combined.to_csv(path, index=False)
    return combined


def is_date_string(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        date.fromisoformat(value[:10])
        return True
    except ValueError:
        return False


def extract_price_from_node(node: Any) -> tuple[float | None, str, bool | None]:
    """
    Try to extract price, currency and availability from one JSON node.
    This is intentionally defensive because vendor APIs vary.
    """
    if isinstance(node, (int, float, str)):
        price = parse_money(node)
        return price, "", price is not None

    if not isinstance(node, dict):
        return None, "", None

    price_keys = [
        "price",
        "amount",
        "value",
        "rate",
        "min_price",
        "minPrice",
        "best_price",
        "bestPrice",
    ]

    price = None
    for key in price_keys:
        if key in node:
            price = parse_money(node.get(key))
            if price is not None:
                break

    currency = (
        node.get("currency")
        or node.get("currencyCode")
        or node.get("currency_code")
        or ""
    )

    availability_keys = [
        "available",
        "isAvailable",
        "bookable",
        "isBookable",
    ]

    available = None
    for key in availability_keys:
        if key in node:
            raw = node.get(key)
            if isinstance(raw, bool):
                available = raw
            else:
                available = str(raw).strip().lower() in {"true", "1", "yes", "available"}
            break

    if available is None and price is not None:
        available = True

    return price, str(currency), available


def walk_prices(payload: Any) -> list[dict[str, Any]]:
    """
    Walk arbitrary JSON and find date → price records.

    Supports shapes like:
      {"2026-06-01": 101}
      {"2026-06-01": {"price": 101}}
      [{"date": "2026-06-01", "price": 101}]
      {"data": [...]}
    """
    rows: list[dict[str, Any]] = []

    def walk(node: Any, current_date: str | None = None) -> None:
        if isinstance(node, dict):
            # Case 1: node itself has a date field.
            date_value = (
                node.get("date")
                or node.get("day")
                or node.get("arrival")
                or node.get("startDate")
            )

            if date_value and is_date_string(str(date_value)):
                d = str(date_value)[:10]
                price, currency, available = extract_price_from_node(node)
                if price is not None or available is not None:
                    rows.append(
                        {
                            "date": d,
                            "price": price,
                            "currency": currency,
                            "available": available,
                            "raw_node": node,
                        }
                    )

            # Case 2: keys are dates.
            for key, value in node.items():
                if is_date_string(key):
                    d = key[:10]
                    price, currency, available = extract_price_from_node(value)
                    if price is not None or available is not None:
                        rows.append(
                            {
                                "date": d,
                                "price": price,
                                "currency": currency,
                                "available": available,
                                "raw_node": value,
                            }
                        )
                    else:
                        walk(value, current_date=d)
                else:
                    walk(value, current_date=current_date)

        elif isinstance(node, list):
            for item in node:
                walk(item, current_date=current_date)

    walk(payload)

    # Deduplicate if the recursive walk found the same date multiple times.
    if not rows:
        return rows

    df = pd.DataFrame(rows)
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df = df.sort_values(["date", "price"], na_position="last")
    df = df.drop_duplicates(subset=["date"], keep="first")

    return df.to_dict(orient="records")


def parse_thais_price_rows(
    payload: Any,
    competitor: dict[str, Any],
    from_date: str,
    to_date: str,
) -> list[dict[str, Any]]:
    if not isinstance(payload, list):
        return walk_prices(payload)

    df = pd.DataFrame(payload)

    if df.empty:
        return []

    room_type_ids = competitor.get("room_type_ids")
    rate_ids = competitor.get("rate_ids")

    if room_type_ids and "room_type_id" in df.columns:
        df = df[df["room_type_id"].astype(str).isin([str(x) for x in room_type_ids])]

    if rate_ids and "rate_id" in df.columns:
        df = df[df["rate_id"].astype(str).isin([str(x) for x in rate_ids])]

    if "stop_sell" in df.columns:
        df["available"] = ~df["stop_sell"].fillna(False).astype(bool)
    else:
        df["available"] = True

    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")

    df = df.dropna(subset=["date"])

    # If several rows still exist for a date, keep the cheapest available filtered rate.
    df = df.sort_values(["date", "available", "price"], ascending=[True, False, True])
    df = df.drop_duplicates(subset=["date"], keep="first")
    all_dates = pd.DataFrame(
        {
            "date": pd.date_range(
                start=from_date,
                end=to_date,
                freq="D",
            ).strftime("%Y-%m-%d")
        }
    )

    df = all_dates.merge(df, on="date", how="left")

    df["available"] = df["available"].fillna(False)
    

    rows = []
    for _, r in df.iterrows():
        available = bool(r.get("available")) and not pd.isna(r.get("price"))
        rows.append(
            {
                "date": r["date"],
                "currency": "EUR",
                "available": available,
                "price": None if pd.isna(r.get("price")) else float(r.get("price")),
                "status": "success_available" if available else "success_unavailable",
                "raw_node": r.to_dict(),
                "room_type_id": r.get("room_type_id"),
                "rate_id": r.get("rate_id"),
                "min_stay": r.get("min_stay"),
                "stop_sell": r.get("stop_sell"),
            }
        )

    return rows

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--client-id", default="daniel_aurore")
    parser.add_argument("--from-date", default=None)
    parser.add_argument("--to-date", default=None)
    parser.add_argument("--competitor-id", default=None)
    args = parser.parse_args()

    config = load_market_config(args.client_id)

    competitors = [
        c for c in config.get("competitors", [])
        if c.get("active", True)
        and c.get("source") == "thais_prices_api"
    ]

    if args.competitor_id:
        competitors = [
            c for c in competitors
            if str(c.get("competitor_id")) == str(args.competitor_id)
        ]

    if not competitors:
        print("No active thais_prices_api competitors found.")
        return

    today = date.today()
    from_date = args.from_date or today.replace(day=1).isoformat()
    to_date = args.to_date or date(today.year + 1, today.month, 1).isoformat()

    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%d_%H%M%S")
    scraped_at = now.isoformat()

    RAW.mkdir(parents=True, exist_ok=True)

    all_rows: list[dict[str, Any]] = []
    raw_records: list[dict[str, Any]] = []

    for competitor in competitors:
        competitor_id = str(competitor["competitor_id"])
        name = competitor.get("name", "")
        url = competitor["prices_api_url"]

        print(f"Fetching {competitor_id}: {from_date} → {to_date}")

        try:
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"
                ),
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
                "Referer": "https://legoyen.thais-hotel.com/direct-booking/calendar",
                "Origin": "https://legoyen.thais-hotel.com",
            }

            response = requests.get(
                url,
                params={
                    "from": from_date,
                    "to": to_date,
                },
                headers=headers,
                timeout=60,
            )
            response.raise_for_status()
            payload = response.json()

            price_rows = parse_thais_price_rows(payload, competitor, from_date, to_date)

            raw_records.append(
                {
                    "competitor": competitor,
                    "url": response.url,
                    "status_code": response.status_code,
                    "payload": payload,
                    "parsed_rows": len(price_rows),
                }
            )

            for row in price_rows:
                all_rows.append(
                    {
                        "run_id": run_id,
                        "scraped_at": scraped_at,
                        "competitor_id": competitor_id,
                        "competitor_name": name,
                        "market_set_id": competitor.get("market_set_id"),
                        "source": "thais_prices_api",
                        "date": row["date"],
                        "available": bool(row.get("available")),
                        "price": row.get("price"),
                        "currency": row.get("currency") or "EUR",
                        "status": "success_available"
                        if row.get("price") is not None
                        else "success_unavailable",
                        "error_type": "",
                        "error_summary": "",
                        "room_type_id": row.get("room_type_id"),
                        "rate_id": row.get("rate_id"),
                        "min_stay": row.get("min_stay"),
                        "stop_sell": row.get("stop_sell"),
                    }
                )

        except Exception as exc:
            raw_records.append(
                {
                    "competitor": competitor,
                    "error": repr(exc),
                }
            )
            all_rows.append(
                {
                    "run_id": run_id,
                    "scraped_at": scraped_at,
                    "competitor_id": competitor_id,
                    "competitor_name": name,
                    "market_set_id": competitor.get("market_set_id"),
                    "source": "thais_prices_api",
                    "date": None,
                    "available": False,
                    "price": None,
                    "currency": "EUR",
                    "status": "failed_scrape",
                    "error_type": "api_error",
                    "error_summary": repr(exc),
                }
            )

    out = pd.DataFrame(all_rows)

    latest_path = PROCESSED / "market_daily_price_snapshots_latest.csv"
    history_path = PROCESSED / "market_daily_price_snapshots.csv"
    raw_path = RAW / f"thais_prices_run_{run_id}.json"

    out.to_csv(latest_path, index=False)
    append_to_history(history_path, out)

    raw_path.write_text(
        json.dumps(raw_records, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    print()
    print(f"Wrote latest daily market prices to {latest_path}")
    print(f"Appended daily market price history to {history_path}")
    print(f"Wrote raw response to {raw_path}")

    print()
    if not out.empty:
        print(out.head(80).to_string(index=False))


if __name__ == "__main__":
    main()
