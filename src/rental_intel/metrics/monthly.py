from __future__ import annotations

import calendar

import pandas as pd


def month_days(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def build_monthly_metrics(daily_calendar: pd.DataFrame) -> pd.DataFrame:
    """
    Build monthly metrics from booked-night daily calendar.

    Currently calculates available nights as calendar days in month,
    assuming each listing has one bookable unit and no owner blocks.

    TODO(inventory): replace calendar-month available nights with Beds24
    availability once we ingest inventory/room calendar data.
    """
    if daily_calendar.empty:
        return pd.DataFrame()

    daily = daily_calendar.copy()
    daily["date"] = pd.to_datetime(daily["date"])
    daily["year"] = daily["date"].dt.year
    daily["month"] = daily["date"].dt.month
    daily["year_month"] = daily["date"].dt.strftime("%Y-%m")

    grouped = (
        daily.groupby(
            [
                "client_id",
                "portfolio_id",
                "portfolio_name",
                "listing_id",
                "listing_name",
                "year",
                "month",
                "year_month",
            ],
            dropna=False,
        )
        .agg(
            booked_nights=("date", "count"),
            gross_booking_value=("gross_booking_value_allocated", "sum"),
            accommodation_revenue=("accommodation_revenue_allocated", "sum"),
            cleaning_fee=("cleaning_fee_allocated", "sum"),
            tourist_tax=("tourist_tax_allocated", "sum"),
            channel_commission=("channel_commission_allocated", "sum"),
            host_payout=("host_payout_allocated", "sum"),
            host_payout_minus_cleaning=("host_payout_minus_cleaning_allocated", "sum"),
        )
        .reset_index()
    )

    grouped["available_nights"] = grouped.apply(
        lambda row: month_days(int(row["year"]), int(row["month"])),
        axis=1,
    )

    grouped["occupancy_pct"] = (
        grouped["booked_nights"] / grouped["available_nights"] * 100
    ).round(1)

    grouped["adr_accommodation"] = (
        grouped["accommodation_revenue"] / grouped["booked_nights"]
    ).round(2)

    grouped["adr_host_payout"] = (
        grouped["host_payout"] / grouped["booked_nights"]
    ).round(2)

    money_cols = [
        "gross_booking_value",
        "accommodation_revenue",
        "cleaning_fee",
        "tourist_tax",
        "channel_commission",
        "host_payout",
        "host_payout_minus_cleaning",
    ]

    for col in money_cols:
        grouped[col] = grouped[col].round(2)

    return grouped.sort_values(["portfolio_id", "listing_id", "year_month"])
