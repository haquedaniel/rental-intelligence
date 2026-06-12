from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import yaml

from rental_intel.market.scenarios import generate_windows_for_scenario, is_truthy


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"


def load_market_config(client_id: str) -> dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}_market.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing market config: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def active_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [item for item in items if is_truthy(item.get("active", True))]

def normalise_airbnb_id(value: Any) -> str:
    if value is None:
        return ""

    text = str(value).strip()

    if text.endswith(".0"):
        text = text[:-2]

    return text


def build_jobs(config: dict[str, Any], today: datetime.date) -> pd.DataFrame:
    scenarios = active_items(config.get("scenarios", []))
    own_listings = active_items(config.get("own_listings", []))
    competitors = active_items(config.get("competitors", []))

    rows: list[dict[str, Any]] = []

    for scenario in scenarios:
        windows = generate_windows_for_scenario(scenario, today=today)

        for window in windows:
            scenario_id = str(window["scenario_id"])

            for listing in own_listings:
                allowed_scenarios = listing.get("scenario_ids")

                if allowed_scenarios and scenario_id not in [str(x) for x in allowed_scenarios]:
                    continue

                rows.append(
                    {
                        "job_type": "own_beds24",
                        "portfolio_id": listing.get("portfolio_id"),
                        "market_set_id": listing.get("market_set_id"),
                        "listing_id": listing.get("listing_id"),
                        "competitor_id": None,
                        "source": "beds24",
                        "airbnb_id": None,
                        "expected_price_index": None,
                        **window,
                    }
                )

            for competitor in competitors:
                allowed_scenarios = competitor.get("scenario_ids")

                

                if allowed_scenarios and scenario_id not in [str(x) for x in allowed_scenarios]:
                    continue

                rows.append(
                    {
                        "job_type": "competitor_airbnb",
                        "portfolio_id": None,
                        "market_set_id": competitor.get("market_set_id"),
                        "listing_id": None,
                        "competitor_id": competitor.get("competitor_id"),
                        "competitor_name": competitor.get("name"),
                        "source": competitor.get("source", "airbnb"),
                        "airbnb_id": str(competitor.get("airbnb_id") or "").replace(".0", ""),
                        "expected_price_index": float(competitor.get("expected_price_index") or 1.0),
                        **window,
                        "guest_price_to_comparable_factor": competitor.get(
                            "guest_price_to_comparable_factor",
                            1.0,
                        ),
                    }
                )

    df = pd.DataFrame(rows)

    if not df.empty:
        for col in ["check_in", "check_out"]:
            df[col] = df[col].apply(lambda d: d.isoformat() if hasattr(d, "isoformat") else d)

    return df


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--client-id", default="daniel_aurore")
    parser.add_argument("--today", default=None, help="Override today's date YYYY-MM-DD")
    args = parser.parse_args()

    today = (
        datetime.strptime(args.today, "%Y-%m-%d").date()
        if args.today
        else datetime.today().date()
    )

    config = load_market_config(args.client_id)
    jobs = build_jobs(config, today=today)

    out_path = PROCESSED / "market_probe_jobs.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    jobs.to_csv(out_path, index=False)

    print(f"Wrote market probe jobs to {out_path}")
    print()

    if jobs.empty:
        print("No market jobs generated. Check active scenarios/listings/competitors.")
        return

    print("Job counts:")
    print(jobs.groupby(["job_type", "scenario_id"]).size().to_string())

    print()
    print(jobs.head(50).to_string(index=False))


if __name__ == "__main__":
    main()
