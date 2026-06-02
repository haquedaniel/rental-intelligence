from __future__ import annotations

import json
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import yaml
from dotenv import load_dotenv

from rental_intel.ingest.beds24 import Beds24Client


ROOT = Path(__file__).resolve().parents[3]


def load_client_config(client_id: str) -> Dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing client config: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def iter_listings(config: Dict[str, Any]):
    for portfolio in config.get("portfolios", []):
        source = portfolio.get("source", {})
        if source.get("system") != "beds24":
            continue

        property_id = int(source["property_id"])

        for listing in portfolio.get("listings", []):
            yield {
                "portfolio_id": portfolio["portfolio_id"],
                "portfolio_name": portfolio["name"],
                "listing_id": listing["listing_id"],
                "listing_name": listing["name"],
                "source_property_id": property_id,
                "source_room_id": int(listing["source_room_id"]),
            }


def main() -> None:
    load_dotenv(ROOT / ".env", override=True)

    client_id = "daniel_aurore"
    horizon_days = 120

    config = load_client_config(client_id)
    beds24 = Beds24Client()

    start = date.today()
    end = start + timedelta(days=horizon_days)
    retrieved_at = datetime.now(timezone.utc).isoformat()

    rows: List[Dict[str, Any]] = []
    raw_responses: List[Dict[str, Any]] = []

    for listing in iter_listings(config):
        room_id = listing["source_room_id"]

        print(f"Fetching availability for {listing['listing_id']} / room {room_id}")

        response = beds24.get_room_availability(
            room_id=room_id,
            from_date=start.isoformat(),
            to_date=end.isoformat(),
        )

        raw_responses.append(
            {
                "source_room_id": room_id,
                "from": start.isoformat(),
                "to": end.isoformat(),
                "response": response,
            }
        )

        for room_result in response.get("data", []):
            availability = room_result.get("availability") or {}

            for day, is_available in availability.items():
                rows.append(
                    {
                        "client_id": client_id,
                        "portfolio_id": listing["portfolio_id"],
                        "portfolio_name": listing["portfolio_name"],
                        "listing_id": listing["listing_id"],
                        "listing_name": listing["listing_name"],
                        "source_property_id": listing["source_property_id"],
                        "source_room_id": room_id,
                        "date": day,
                        "available": bool(is_available),
                        "retrieved_at": retrieved_at,
                    }
                )

    raw_path = ROOT / "outputs" / "raw" / "availability_raw.json"
    raw_path.write_text(json.dumps(raw_responses, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote raw availability to {raw_path}")

    df = pd.DataFrame(rows)
    out_path = ROOT / "outputs" / "processed" / "inventory_availability.csv"
    df.to_csv(out_path, index=False)
    print(f"Wrote availability to {out_path}")

    if not df.empty:
        print()
        print("Availability summary:")
        print(
            df.groupby(["portfolio_id", "listing_id"], dropna=False)
            .agg(
                days=("date", "count"),
                available_days=("available", "sum"),
            )
            .to_string()
        )


if __name__ == "__main__":
    main()
