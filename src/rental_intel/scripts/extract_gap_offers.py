from __future__ import annotations

import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
from dotenv import load_dotenv

from rental_intel.ingest.beds24 import Beds24Client


ROOT = Path(__file__).resolve().parents[3]


def find_available_runs(availability: pd.DataFrame, max_gap_days: int = 7) -> pd.DataFrame:
    rows: List[Dict[str, Any]] = []

    availability = availability.copy()
    availability["date"] = pd.to_datetime(availability["date"]).dt.date

    group_cols = [
        "client_id",
        "portfolio_id",
        "portfolio_name",
        "listing_id",
        "listing_name",
        "source_property_id",
        "source_room_id",
    ]

    for keys, group in availability.groupby(group_cols, dropna=False):
        group = group.sort_values("date")
        dates = group["date"].tolist()
        avail = group["available"].tolist()

        base = dict(zip(group_cols, keys))

        i = 0
        while i < len(dates):
            if not avail[i]:
                i += 1
                continue

            start = dates[i]
            j = i

            while (
                j + 1 < len(dates)
                and avail[j + 1]
                and dates[j + 1] == dates[j] + timedelta(days=1)
            ):
                j += 1

            end_exclusive = dates[j] + timedelta(days=1)
            gap_nights = (end_exclusive - start).days

            if gap_nights <= max_gap_days:
                rows.append(
                    {
                        **base,
                        "gap_start": start.isoformat(),
                        "gap_end": end_exclusive.isoformat(),
                        "gap_nights": gap_nights,
                    }
                )

            i = j + 1

    return pd.DataFrame(rows)


def parse_best_offer(response: Dict[str, Any], room_id: int) -> Dict[str, Any]:
    for room_result in response.get("data", []):
        if int(room_result.get("roomId")) != int(room_id):
            continue

        offers = room_result.get("offers") or []
        if not offers:
            return {
                "bookable": False,
                "offer_id": None,
                "offer_name": None,
                "offer_price": None,
                "units_available": 0,
                "effective_price_per_night": None,
            }

        best_offer = min(offers, key=lambda o: float(o.get("price") or 0))
        price = float(best_offer.get("price") or 0)
        units_available = int(best_offer.get("unitsAvailable") or 0)

        return {
            "bookable": units_available > 0,
            "offer_id": best_offer.get("offerId"),
            "offer_name": best_offer.get("offerName"),
            "offer_price": round(price, 2),
            "units_available": units_available,
            "effective_price_per_night": round(price / response["_nights"], 2),
        }

    return {
        "bookable": False,
        "offer_id": None,
        "offer_name": None,
        "offer_price": None,
        "units_available": 0,
        "effective_price_per_night": None,
    }


def main() -> None:
    load_dotenv(ROOT / ".env", override=True)

    availability_path = ROOT / "outputs" / "processed" / "inventory_availability.csv"
    if not availability_path.exists():
        raise FileNotFoundError(f"Missing {availability_path}. Run extract_availability first.")

    availability = pd.read_csv(availability_path)
    gaps = find_available_runs(availability, max_gap_days=7)

    # Only targeted commercial gaps for now.
    target_gaps = gaps[gaps["gap_nights"].isin([1, 2, 3])].copy()

    beds24 = Beds24Client()
    retrieved_at = datetime.now(timezone.utc).isoformat()

    rows: List[Dict[str, Any]] = []
    raw: List[Dict[str, Any]] = []

    print(f"Found {len(target_gaps)} targeted gaps to check.")

    for _, gap in target_gaps.iterrows():
        property_id = int(gap["source_property_id"])
        room_id = int(gap["source_room_id"])
        arrival = str(gap["gap_start"])
        departure = str(gap["gap_end"])
        nights = int(gap["gap_nights"])

        print(f"Checking {gap['listing_id']} {arrival} → {departure} ({nights} nights)")

        response = beds24.get_offers(
            property_id=property_id,
            arrival=arrival,
            departure=departure,
            num_adults=2,
            num_children=0,
        )
        response["_nights"] = nights

        raw.append(
            {
                "listing_id": gap["listing_id"],
                "room_id": room_id,
                "arrival": arrival,
                "departure": departure,
                "nights": nights,
                "response": response,
            }
        )

        parsed = parse_best_offer(response, room_id=room_id)

        rows.append(
            {
                "client_id": gap["client_id"],
                "portfolio_id": gap["portfolio_id"],
                "portfolio_name": gap["portfolio_name"],
                "listing_id": gap["listing_id"],
                "listing_name": gap["listing_name"],
                "source_property_id": property_id,
                "source_room_id": room_id,
                "gap_start": arrival,
                "gap_end": departure,
                "gap_nights": nights,
                "num_adults": 2,
                "num_children": 0,
                **parsed,
                "retrieved_at": retrieved_at,
            }
        )

        time.sleep(3.2)

    raw_path = ROOT / "outputs" / "raw" / "gap_offers_raw.json"
    raw_path.write_text(json.dumps(raw, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote raw gap offers to {raw_path}")

    out = pd.DataFrame(rows)
    out_path = ROOT / "outputs" / "processed" / "gap_offers.csv"
    out.to_csv(out_path, index=False)
    print(f"Wrote gap offers to {out_path}")

    if not out.empty:
        print()
        print(out.to_string(index=False))


if __name__ == "__main__":
    main()
