from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]

HORIZONS = [14, 30, 60, 90]


def load_csv(name: str) -> pd.DataFrame:
    path = ROOT / "outputs" / "processed" / name
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}")
    return pd.read_csv(path)


def main() -> None:
    daily = load_csv("daily_calendar.csv")
    availability = load_csv("inventory_availability.csv")

    today = date.today()

    availability = availability.copy()
    availability["date"] = pd.to_datetime(availability["date"]).dt.date

    daily = daily.copy()
    daily["date"] = pd.to_datetime(daily["date"]).dt.date

    listing_meta = (
        availability[
            [
                "client_id",
                "portfolio_id",
                "portfolio_name",
                "listing_id",
                "listing_name",
                "source_property_id",
                "source_room_id",
            ]
        ]
        .drop_duplicates()
        .to_dict("records")
    )

    rows: List[Dict[str, Any]] = []

    for listing in listing_meta:
        listing_id = str(listing["listing_id"])

        listing_avail = availability[availability["listing_id"].astype(str) == listing_id]
        listing_daily = daily[daily["listing_id"].astype(str) == listing_id]

        for horizon in HORIZONS:
            start = today
            end = today + timedelta(days=horizon)

            avail_window = listing_avail[
                (listing_avail["date"] >= start)
                & (listing_avail["date"] < end)
            ]

            daily_window = listing_daily[
                (listing_daily["date"] >= start)
                & (listing_daily["date"] < end)
            ]

            available_days = int(avail_window["available"].sum()) if not avail_window.empty else 0
            booked_nights = int(len(daily_window))
            total_days = int((end - start).days)

            open_nights = available_days
            unavailable_nights = total_days - available_days

            # In Beds24 availability, booked nights normally appear unavailable.
            # So we report both secured bookings and currently open/sellable nights.
            secured_accommodation = round(
                float(daily_window.get("accommodation_revenue_allocated", pd.Series(dtype=float)).sum()),
                2,
            )
            secured_host_payout = round(
                float(daily_window.get("host_payout_allocated", pd.Series(dtype=float)).sum()),
                2,
            )
            secured_cleaning_fee = round(
                float(daily_window.get("cleaning_fee_allocated", pd.Series(dtype=float)).sum()),
                2,
            )
            secured_tourist_tax = round(
                float(daily_window.get("tourist_tax_allocated", pd.Series(dtype=float)).sum()),
                2,
            )

            occupancy_pct = round(booked_nights / total_days * 100, 1) if total_days else 0
            open_pct = round(open_nights / total_days * 100, 1) if total_days else 0

            rows.append(
                {
                    **listing,
                    "horizon_days": horizon,
                    "period_start": start.isoformat(),
                    "period_end": end.isoformat(),
                    "total_days": total_days,
                    "booked_nights": booked_nights,
                    "open_nights": open_nights,
                    "unavailable_nights": unavailable_nights,
                    "occupancy_pct": occupancy_pct,
                    "open_pct": open_pct,
                    "secured_accommodation_revenue": secured_accommodation,
                    "secured_host_payout": secured_host_payout,
                    "secured_cleaning_fee": secured_cleaning_fee,
                    "secured_tourist_tax": secured_tourist_tax,
                }
            )

    out = pd.DataFrame(rows)

    out_path = ROOT / "outputs" / "processed" / "forward_position.csv"
    out.to_csv(out_path, index=False)

    print(f"Wrote forward position to {out_path}")
    print()
    print(out.to_string(index=False))


if __name__ == "__main__":
    main()
