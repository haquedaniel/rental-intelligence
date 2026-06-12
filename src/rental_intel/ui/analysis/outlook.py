from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import pandas as pd


@dataclass(frozen=True)
class OutlookConfig:
    min_gap_nights: int = 2


def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for col in candidates:
        if col in df.columns:
            return col
    return None


def _to_bool(series: pd.Series) -> pd.Series:
    return series.astype(str).str.lower().isin(["true", "1", "yes", "y"])


def normalise_daily_calendar(daily: pd.DataFrame) -> pd.DataFrame:
    """
    Normalise the daily calendar.

    Important MVP assumption:
    If the file only contains reservation/occupied rows, the missing days will be
    completed later and treated as available/open.
    """
    if daily.empty:
        return daily

    df = daily.copy()

    date_col = _find_col(df, ["date", "stay_date", "calendar_date", "day"])
    listing_col = _find_col(df, ["listing_id", "unit_id", "room_id", "listing"])

    if date_col is None or listing_col is None:
        return pd.DataFrame()

    df = df.rename(columns={date_col: "date", listing_col: "listing_id"})
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
    df = df[df["date"].notna()].copy()
    df["listing_id"] = df["listing_id"].astype(str)

    occupied_col = _find_col(df, ["occupied", "is_occupied", "booked", "is_booked"])
    available_col = _find_col(df, ["available", "is_available", "bookable"])
    blocked_col = _find_col(df, ["blocked", "is_blocked", "closed"])

    if occupied_col:
        df["occupied"] = _to_bool(df[occupied_col])
    else:
        # Most reservation-expanded calendars are one row per occupied night.
        df["occupied"] = True

    if available_col:
        df["available"] = _to_bool(df[available_col])
    else:
        df["available"] = False

    if blocked_col:
        df["blocked"] = _to_bool(df[blocked_col])
    else:
        df["blocked"] = False

    status_col = _find_col(df, ["status", "calendar_status", "availability_status"])

    if status_col:
        status = df[status_col].astype(str).str.lower()

        df["occupied"] = df["occupied"] | status.isin(
            ["booked", "occupied", "reservation", "reserved"]
        )
        df["blocked"] = df["blocked"] | status.isin(
            ["blocked", "closed", "unavailable"]
        )
        df["available"] = df["available"] | status.isin(
            ["available", "open", "free"]
        )

    revenue_col = _find_col(df, ["revenue", "accommodation_revenue", "host_payout", "amount"])

    if revenue_col:
        df["revenue"] = pd.to_numeric(df[revenue_col], errors="coerce").fillna(0)
    else:
        df["revenue"] = 0.0

    df["status"] = "unknown"
    df.loc[df["available"] & ~df["occupied"] & ~df["blocked"], "status"] = "available"
    df.loc[df["blocked"] & ~df["occupied"], "status"] = "blocked"
    df.loc[df["occupied"], "status"] = "booked"

    return df[
        [
            "listing_id",
            "date",
            "status",
            "occupied",
            "available",
            "blocked",
            "revenue",
        ]
    ].copy()


def complete_calendar_grid(
    daily: pd.DataFrame,
    start_date: date,
    end_date: date,
) -> pd.DataFrame:
    """
    Create a complete listing x date grid.

    Missing rows are treated as available/open for now.
    Later we can replace this with Beds24 inventory availability for perfect accuracy.
    """
    if daily.empty:
        return daily

    listings = sorted(daily["listing_id"].astype(str).dropna().unique().tolist())

    if not listings:
        return pd.DataFrame()

    dates = pd.date_range(start=start_date, end=end_date - timedelta(days=1), freq="D").date

    grid = pd.MultiIndex.from_product(
        [listings, dates],
        names=["listing_id", "date"],
    ).to_frame(index=False)

    merged = grid.merge(
        daily,
        on=["listing_id", "date"],
        how="left",
        suffixes=("", "_source"),
    )

    merged["status"] = merged["status"].fillna("available")
    merged["occupied"] = merged["occupied"].fillna(False).astype(bool)
    merged["blocked"] = merged["blocked"].fillna(False).astype(bool)

    # Missing dates are our open nights.
    merged["available"] = merged["available"].fillna(True).astype(bool)

    # Enforce consistency.
    merged.loc[merged["occupied"], "available"] = False
    merged.loc[merged["blocked"], "available"] = False
    merged["revenue"] = pd.to_numeric(merged["revenue"], errors="coerce").fillna(0)

    return merged[
        [
            "listing_id",
            "date",
            "status",
            "occupied",
            "available",
            "blocked",
            "revenue",
        ]
    ].copy()


def build_weekly_listing_summary(daily: pd.DataFrame) -> pd.DataFrame:
    if daily.empty:
        return daily

    df = daily.copy()
    df["date_dt"] = pd.to_datetime(df["date"])
    df["week_start"] = df["date_dt"].dt.to_period("W-MON").dt.start_time.dt.date

    summary = (
        df.groupby(["listing_id", "week_start"], dropna=False)
        .agg(
            nights=("date", "size"),
            booked_nights=("occupied", "sum"),
            available_nights=("available", "sum"),
            blocked_nights=("blocked", "sum"),
            revenue=("revenue", "sum"),
        )
        .reset_index()
    )

    summary["occupancy_rate"] = (
        summary["booked_nights"] / summary["nights"] * 100
    ).round(0)

    return summary


def find_available_gaps(
    daily: pd.DataFrame,
    config: OutlookConfig | None = None,
) -> pd.DataFrame:
    config = config or OutlookConfig()

    if daily.empty:
        return daily

    rows: list[dict] = []

    for listing_id, group in daily.sort_values("date").groupby("listing_id"):
        group = group.reset_index(drop=True)
        in_gap = False
        gap_start = None
        gap_dates: list[date] = []

        for _, row in group.iterrows():
            is_available = (
                bool(row["available"])
                and not bool(row["occupied"])
                and not bool(row["blocked"])
            )

            if is_available and not in_gap:
                in_gap = True
                gap_start = row["date"]
                gap_dates = [row["date"]]
            elif is_available and in_gap:
                gap_dates.append(row["date"])
            elif not is_available and in_gap:
                if len(gap_dates) >= config.min_gap_nights:
                    rows.append(
                        {
                            "listing_id": listing_id,
                            "gap_start": gap_start,
                            "gap_end": gap_dates[-1] + timedelta(days=1),
                            "nights": len(gap_dates),
                        }
                    )

                in_gap = False
                gap_start = None
                gap_dates = []

        if in_gap and len(gap_dates) >= config.min_gap_nights:
            rows.append(
                {
                    "listing_id": listing_id,
                    "gap_start": gap_start,
                    "gap_end": gap_dates[-1] + timedelta(days=1),
                    "nights": len(gap_dates),
                }
            )

    return pd.DataFrame(rows)


def attach_market_signal_to_gaps(
    gaps: pd.DataFrame,
    benchmark: pd.DataFrame,
) -> pd.DataFrame:
    if gaps.empty:
        return gaps

    if benchmark.empty:
        gaps = gaps.copy()
        gaps["market_tension"] = "no_market_data"
        gaps["price_position"] = "no_comparison"
        gaps["pricing_guidance"] = "Pas encore de signal marché disponible pour cette période."
        gaps["own_nightly_amount"] = pd.NA
        gaps["competitor_normalised_median_nightly"] = pd.NA
        gaps["competitors_available"] = pd.NA
        gaps["competitors_checked"] = pd.NA
        return gaps

    b = benchmark.copy()
    b["check_in_dt"] = pd.to_datetime(b["check_in"], errors="coerce").dt.date

    rows: list[dict] = []

    for _, gap in gaps.iterrows():
        listing_id = gap["listing_id"]
        start = gap["gap_start"]

        candidates = b[b["listing_id"].astype(str) == str(listing_id)].copy()

        if candidates.empty:
            candidates = b.copy()

        candidates["days_from_gap"] = candidates["check_in_dt"].apply(
            lambda x: abs((x - start).days) if pd.notna(x) else 9999
        )

        best = candidates.sort_values("days_from_gap").head(1)

        row = gap.to_dict()

        if best.empty:
            row.update(
                {
                    "market_tension": "no_market_data",
                    "price_position": "no_comparison",
                    "pricing_guidance": "Pas encore de signal marché disponible pour cette période.",
                    "own_nightly_amount": pd.NA,
                    "competitor_normalised_median_nightly": pd.NA,
                    "competitors_available": pd.NA,
                    "competitors_checked": pd.NA,
                }
            )
        else:
            signal = best.iloc[0]

            for col in [
                "market_tension",
                "price_position",
                "pricing_guidance",
                "own_nightly_amount",
                "competitor_normalised_median_nightly",
                "competitors_available",
                "competitors_checked",
                "market_availability_rate",
            ]:
                row[col] = signal.get(col, pd.NA)

            row["signal_check_in"] = signal.get("check_in", pd.NA)
            row["signal_days_from_gap"] = signal.get("days_from_gap", pd.NA)

        rows.append(row)

    return pd.DataFrame(rows)


def build_outlook(
    daily_raw: pd.DataFrame,
    benchmark: pd.DataFrame,
    start_date: date,
    end_date: date,
) -> dict[str, pd.DataFrame]:
    config = OutlookConfig()

    daily = normalise_daily_calendar(daily_raw)

    if daily.empty:
        return {
            "daily": daily,
            "weekly": pd.DataFrame(),
            "gaps": pd.DataFrame(),
        }

    daily = complete_calendar_grid(
        daily=daily,
        start_date=start_date,
        end_date=end_date,
    )

    weekly = build_weekly_listing_summary(daily)
    gaps = find_available_gaps(daily, config=config)
    gaps = attach_market_signal_to_gaps(gaps, benchmark)

    return {
        "daily": daily,
        "weekly": weekly,
        "gaps": gaps,
    }