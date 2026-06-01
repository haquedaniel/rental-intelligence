from __future__ import annotations

from datetime import timedelta
from typing import List

import pandas as pd


def allocate_amount_across_nights(total: float, nights: int) -> List[float]:
    """
    Allocate a booking-level amount across nights.

    We round each night to 2 decimals, but force the final night to absorb
    the rounding difference so that the daily rows sum exactly to the booking total.

    Example:
    350 / 3 = [116.67, 116.67, 116.66]
    """
    if nights <= 0:
        return []

    total = round(float(total or 0), 2)

    if nights == 1:
        return [total]

    standard = round(total / nights, 2)
    values = [standard for _ in range(nights - 1)]
    final_value = round(total - sum(values), 2)
    values.append(final_value)

    return values


def expand_reservations_to_daily(reservations: pd.DataFrame) -> pd.DataFrame:
    """
    Convert reservation-level rows into one row per booked night.

    Example:
    arrival 2026-07-10, departure 2026-07-13 = 3 booked nights:
    2026-07-10, 2026-07-11, 2026-07-12
    """
    rows = []

    if reservations.empty:
        return pd.DataFrame()

    for _, booking in reservations.iterrows():
        status = str(booking.get("status") or "").lower()
        if status == "cancelled":
            continue
        arrival = pd.to_datetime(booking["arrival"]).date()
        departure = pd.to_datetime(booking["departure"]).date()
        nights = int(booking["nights"])

        if nights <= 0:
            continue

        accommodation_allocations = allocate_amount_across_nights(
            booking.get("accommodation_revenue", 0),
            nights,
        )
        host_payout_allocations = allocate_amount_across_nights(
            booking.get("host_payout", 0),
            nights,
        )

        current = arrival
        night_index = 0

        while current < departure:
            rows.append(
                {
                    "client_id": booking.get("client_id"),
                    "portfolio_id": booking.get("portfolio_id"),
                    "portfolio_name": booking.get("portfolio_name"),
                    "listing_id": booking.get("listing_id"),
                    "listing_name": booking.get("listing_name"),
                    "date": current.isoformat(),
                    "year": current.year,
                    "month": current.month,
                    "year_month": current.strftime("%Y-%m"),
                    "source_system": booking.get("source_system"),
                    "source_booking_id": booking.get("source_booking_id"),
                    "source_property_id": booking.get("source_property_id"),
                    "source_room_id": booking.get("source_room_id"),
                    "status": booking.get("status"),
                    "channel": booking.get("channel"),
                    "is_booked": True,
                    "num_adult": booking.get("num_adult"),
                    "num_child": booking.get("num_child"),
                    "guest_country": booking.get("guest_country"),
                    "guest_language": booking.get("guest_language"),
                    "accommodation_revenue_allocated": accommodation_allocations[night_index],
                    "host_payout_allocated": host_payout_allocations[night_index],
                }
            )
            current += timedelta(days=1)
            night_index += 1

    return pd.DataFrame(rows)
