from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]


TARGET_STAYS = [2, 3]


def stay_dates(arrival: str, nights: int) -> list[str]:
    start = pd.to_datetime(arrival).date()
    return [(start + timedelta(days=i)).isoformat() for i in range(nights)]


def main() -> None:
    offers_path = ROOT / "outputs" / "processed" / "future_offers.csv"
    availability_path = ROOT / "outputs" / "processed" / "inventory_availability.csv"

    if not offers_path.exists():
        raise FileNotFoundError(f"Missing {offers_path}. Run extract_offers first.")

    if not availability_path.exists():
        raise FileNotFoundError(f"Missing {availability_path}. Run extract_availability first.")

    offers = pd.read_csv(offers_path)
    availability = pd.read_csv(availability_path)

    avail_lookup = {
        (row["listing_id"], row["date"]): bool(row["available"])
        for _, row in availability.iterrows()
    }

    rows: List[Dict[str, Any]] = []

    # We only need the min-stay scenario rows for diagnostics.
    minstay = offers[offers["scenario"].astype(str).str.startswith("minstay_")].copy()

    for (listing_id, arrival), group in minstay.groupby(["listing_id", "arrival"], dropna=False):
        group = group.copy()

        bookable_stays = group[group["bookable"] == True]["nights"].tolist()
        shortest_bookable = min(bookable_stays) if bookable_stays else None

        base = group.iloc[0].to_dict()

        for target_nights in TARGET_STAYS:
            target_row = group[group["nights"] == target_nights]

            if target_row.empty:
                continue

            target = target_row.iloc[0]
            dates = stay_dates(arrival, target_nights)
            dates_available = [avail_lookup.get((listing_id, d), False) for d in dates]
            all_dates_available = all(dates_available)

            if bool(target["bookable"]):
                likely_blocker = "none"
                diagnostic = "target_stay_bookable"
                action_type = "none"
            elif not all_dates_available:
                likely_blocker = "availability_or_booking"
                diagnostic = "one_or_more_dates_unavailable"
                action_type = "none"
            elif shortest_bookable is not None and shortest_bookable > target_nights:
                likely_blocker = "min_stay_or_restriction"
                diagnostic = "dates_available_but_short_stay_not_bookable"
                action_type = "consider_calendar_override"
            else:
                likely_blocker = "unknown_offer_rejection"
                diagnostic = "dates_available_but_no_offer_reason_unknown"
                action_type = "investigate"

            rows.append(
                {
                    "client_id": base.get("client_id"),
                    "portfolio_id": base.get("portfolio_id"),
                    "portfolio_name": base.get("portfolio_name"),
                    "listing_id": listing_id,
                    "listing_name": base.get("listing_name"),
                    "source_property_id": base.get("source_property_id"),
                    "source_room_id": base.get("source_room_id"),
                    "arrival": arrival,
                    "target_nights": target_nights,
                    "target_departure": pd.to_datetime(arrival).date()
                    + timedelta(days=target_nights),
                    "target_bookable": bool(target["bookable"]),
                    "all_dates_available": all_dates_available,
                    "availability_pattern": "".join("1" if x else "0" for x in dates_available),
                    "shortest_bookable_stay_tested": shortest_bookable,
                    "target_offer_price": target.get("offer_price"),
                    "target_effective_price_per_night": target.get("effective_price_per_night"),
                    "likely_blocker": likely_blocker,
                    "diagnostic": diagnostic,
                    "suggested_action_type": action_type,
                    "retrieved_at": base.get("retrieved_at"),
                }
            )

    diagnostics = pd.DataFrame(rows)

    out_path = ROOT / "outputs" / "processed" / "restriction_diagnostics.csv"
    diagnostics.to_csv(out_path, index=False)
    print(f"Wrote restriction diagnostics to {out_path}")

    if not diagnostics.empty:
        print()
        print("Restriction diagnostic summary:")
        print(
            diagnostics.groupby(["listing_id", "target_nights", "likely_blocker"], dropna=False)
            .size()
            .to_string()
        )

        print()
        print("Potential min-stay/restriction blocks:")
        cols = [
            "listing_id",
            "arrival",
            "target_nights",
            "target_bookable",
            "all_dates_available",
            "shortest_bookable_stay_tested",
            "likely_blocker",
            "suggested_action_type",
        ]
        flagged = diagnostics[
            diagnostics["likely_blocker"] == "min_stay_or_restriction"
        ][cols]

        if flagged.empty:
            print("None.")
        else:
            print(flagged.to_string(index=False))


if __name__ == "__main__":
    main()
