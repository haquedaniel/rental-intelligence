from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]


def money(value: Any) -> float:
    return round(float(value or 0), 2)


def make_recommendation_id(category: str, listing_id: str, start: str, end: str = "") -> str:
    base = f"{category}_{listing_id}_{start}"
    if end:
        base += f"_{end}"
    return base.replace("-", "")


def load_csv(name: str) -> pd.DataFrame:
    path = ROOT / "outputs" / "processed" / name
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}")
    return pd.read_csv(path)


def availability_lookup(availability: pd.DataFrame) -> dict[tuple[str, str], bool]:
    return {
        (str(row["listing_id"]), str(row["date"])): bool(row["available"])
        for _, row in availability.iterrows()
    }


def offer_lookup(offers: pd.DataFrame) -> dict[tuple[str, str, int], pd.Series]:
    lookup: dict[tuple[str, str, int], pd.Series] = {}
    for _, row in offers.iterrows():
        key = (str(row["listing_id"]), str(row["arrival"]), int(row["nights"]))
        lookup[key] = row
    return lookup


def find_available_runs(
    availability: pd.DataFrame,
    max_gap_days: int = 7,
) -> pd.DataFrame:
    """
    Find contiguous available runs per listing.

    Example:
    available 2026-06-30 and 2026-07-01 only
    => gap_start 2026-06-30, gap_end 2026-07-02, gap_nights 2
    """
    rows: List[Dict[str, Any]] = []

    availability = availability.copy()
    availability["date"] = pd.to_datetime(availability["date"]).dt.date

    for listing_id, group in availability.groupby("listing_id"):
        group = group.sort_values("date").copy()
        dates = group["date"].tolist()
        avail = group["available"].tolist()

        i = 0
        while i < len(dates):
            if not avail[i]:
                i += 1
                continue

            start = dates[i]
            j = i
            while j + 1 < len(dates) and avail[j + 1]:
                # only contiguous calendar dates
                if dates[j + 1] != dates[j] + timedelta(days=1):
                    break
                j += 1

            end_exclusive = dates[j] + timedelta(days=1)
            gap_nights = (end_exclusive - start).days

            if gap_nights <= max_gap_days:
                rows.append(
                    {
                        "listing_id": listing_id,
                        "gap_start": start.isoformat(),
                        "gap_end": end_exclusive.isoformat(),
                        "gap_nights": gap_nights,
                    }
                )

            i = j + 1

    return pd.DataFrame(rows)


def get_listing_meta(*dfs: pd.DataFrame) -> dict[str, dict[str, Any]]:
    meta: dict[str, dict[str, Any]] = {}

    for df in dfs:
        if df.empty or "listing_id" not in df.columns:
            continue

        for _, row in df.iterrows():
            listing_id = str(row.get("listing_id", ""))
            if not listing_id or listing_id == "nan":
                continue

            current = meta.setdefault(listing_id, {})
            for col in [
                "client_id",
                "portfolio_id",
                "portfolio_name",
                "listing_name",
                "source_property_id",
                "source_room_id",
            ]:
                value = row.get(col)
                if pd.notna(value) and value != "":
                    current[col] = value

    return meta


def add_common_fields(
    rec: Dict[str, Any],
    meta: dict[str, dict[str, Any]],
    listing_id: str,
) -> Dict[str, Any]:
    m = meta.get(listing_id, {})

    return {
        "recommendation_id": rec["recommendation_id"],
        "category": rec["category"],
        "priority": rec["priority"],
        "client_id": m.get("client_id"),
        "portfolio_id": m.get("portfolio_id"),
        "portfolio_name": m.get("portfolio_name"),
        "listing_id": listing_id,
        "listing_name": m.get("listing_name"),
        "source_property_id": m.get("source_property_id"),
        "source_room_id": m.get("source_room_id"),
        "period_start": rec.get("period_start"),
        "period_end": rec.get("period_end"),
        "problem": rec.get("problem"),
        "evidence": rec.get("evidence"),
        "suggested_action": rec.get("suggested_action"),
        "suggested_price": rec.get("suggested_price"),
        "confidence": rec.get("confidence", "medium"),
        "actionable_in_beds24": rec.get("actionable_in_beds24", True),
        "status": "new",
    }


def build_orphan_night_recommendations(
    gaps: pd.DataFrame,
    offers_lookup: dict[tuple[str, str, int], pd.Series],
    meta: dict[str, dict[str, Any]],
) -> List[Dict[str, Any]]:
    recs: List[Dict[str, Any]] = []

    if gaps.empty:
        return recs

    today = date.today()

    for _, gap in gaps.iterrows():
        if int(gap["gap_nights"]) != 1:
            continue

        listing_id = str(gap["listing_id"])
        start = str(gap["gap_start"])
        end = str(gap["gap_end"])

        arrival_date = pd.to_datetime(start).date()
        days_until = (arrival_date - today).days

        # Do not push far-future 1-night orphan recommendations too aggressively.
        if days_until > 30:
            continue

        one_night_offer = offers_lookup.get((listing_id, start, 1))
        two_night_offer = offers_lookup.get((listing_id, start, 2))

        one_night_bookable = bool(one_night_offer["bookable"]) if one_night_offer is not None else False

        if one_night_bookable:
            continue

        reference_price = None
        if two_night_offer is not None and pd.notna(two_night_offer.get("effective_price_per_night")):
            reference_price = money(two_night_offer.get("effective_price_per_night"))

        suggested_price = None
        if reference_price:
            suggested_price = round(max(reference_price * 1.6, reference_price + 60), 0)

        rec = {
            "recommendation_id": make_recommendation_id(
                "orphan_night_premium", listing_id, start, end
            ),
            "category": "orphan_night_premium",
            "priority": "medium" if days_until > 7 else "high",
            "period_start": start,
            "period_end": end,
            "problem": "Single available orphan night is not currently bookable as a 1-night stay.",
            "evidence": (
                f"{listing_id} has a 1-night gap on {start}. "
                f"1-night offer is not bookable. Days until arrival: {days_until}."
            ),
            "suggested_action": (
                "Consider opening this single night with a premium 1-night calendar override."
            ),
            "suggested_price": suggested_price,
            "confidence": "medium",
            "actionable_in_beds24": True,
        }
        recs.append(add_common_fields(rec, meta, listing_id))

    return recs


def build_short_gap_restriction_recommendations(
    gaps: pd.DataFrame,
    diagnostics: pd.DataFrame,
    meta: dict[str, dict[str, Any]],
) -> List[Dict[str, Any]]:
    recs: List[Dict[str, Any]] = []

    if gaps.empty or diagnostics.empty:
        return recs

    for _, gap in gaps.iterrows():
        gap_nights = int(gap["gap_nights"])

        if gap_nights not in {2, 3}:
            continue

        listing_id = str(gap["listing_id"])
        start = str(gap["gap_start"])
        end = str(gap["gap_end"])

        d = diagnostics[
            (diagnostics["listing_id"].astype(str) == listing_id)
            & (diagnostics["arrival"].astype(str) == start)
            & (diagnostics["target_nights"].astype(int) == gap_nights)
        ]

        if d.empty:
            continue

        row = d.iloc[0]
        if str(row.get("likely_blocker")) != "min_stay_or_restriction":
            continue

        shortest = row.get("shortest_bookable_stay_tested")

        rec = {
            "recommendation_id": make_recommendation_id(
                "short_gap_restriction", listing_id, start, end
            ),
            "category": "short_gap_restriction",
            "priority": "high",
            "period_start": start,
            "period_end": end,
            "problem": f"{gap_nights}-night available gap is not currently bookable.",
            "evidence": (
                f"{listing_id} has a {gap_nights}-night available gap from {start} to {end}. "
                f"All dates are available, but the {gap_nights}-night offer is blocked. "
                f"Shortest tested bookable stay: {shortest}."
            ),
            "suggested_action": (
                f"Consider a temporary calendar override allowing {gap_nights}-night stays for this gap."
            ),
            "suggested_price": None,
            "confidence": "high",
            "actionable_in_beds24": True,
        }
        recs.append(add_common_fields(rec, meta, listing_id))

    return recs


def build_occupancy_risk_recommendations(
    monthly: pd.DataFrame,
    meta: dict[str, dict[str, Any]],
) -> List[Dict[str, Any]]:
    recs: List[Dict[str, Any]] = []

    if monthly.empty:
        return recs

    today = date.today()
    current_month_start = date(today.year, today.month, 1)

    for _, row in monthly.iterrows():
        year = int(row["year"])
        month = int(row["month"])
        month_start = date(year, month, 1)

        days_until_month = (month_start - today).days

        # Focus on near-future months.
        if days_until_month < -31 or days_until_month > 90:
            continue

        occupancy = float(row["occupancy_pct"])
        listing_id = str(row["listing_id"])

        if occupancy >= 35:
            continue

        rec = {
            "recommendation_id": make_recommendation_id(
                "occupancy_risk", listing_id, str(row["year_month"])
            ),
            "category": "occupancy_risk",
            "priority": "high" if days_until_month <= 45 else "medium",
            "period_start": f"{row['year_month']}-01",
            "period_end": "",
            "problem": "Future occupancy is below the current risk threshold.",
            "evidence": (
                f"{listing_id} occupancy for {row['year_month']} is {occupancy:.1f}% "
                f"({int(row['booked_nights'])} booked nights)."
            ),
            "suggested_action": (
                "Review open dates, current prices and restrictions. Consider targeted discounts on weak periods."
            ),
            "suggested_price": None,
            "confidence": "medium",
            "actionable_in_beds24": False,
        }
        recs.append(add_common_fields(rec, meta, listing_id))

    return recs


def build_price_protection_recommendations(
    monthly: pd.DataFrame,
    meta: dict[str, dict[str, Any]],
) -> List[Dict[str, Any]]:
    recs: List[Dict[str, Any]] = []

    if monthly.empty:
        return recs

    today = date.today()

    for _, row in monthly.iterrows():
        year = int(row["year"])
        month = int(row["month"])
        month_start = date(year, month, 1)
        days_until_month = (month_start - today).days

        if days_until_month < -31 or days_until_month > 120:
            continue

        occupancy = float(row["occupancy_pct"])
        listing_id = str(row["listing_id"])

        if occupancy < 75:
            continue

        rec = {
            "recommendation_id": make_recommendation_id(
                "price_protection", listing_id, str(row["year_month"])
            ),
            "category": "price_protection",
            "priority": "medium",
            "period_start": f"{row['year_month']}-01",
            "period_end": "",
            "problem": "Month is already strongly booked; avoid unnecessary discounting.",
            "evidence": (
                f"{listing_id} occupancy for {row['year_month']} is already {occupancy:.1f}% "
                f"with ADR accommodation of €{float(row['adr_accommodation']):.2f}."
            ),
            "suggested_action": (
                "Protect remaining dates. Consider holding price or increasing remaining peak-night prices."
            ),
            "suggested_price": None,
            "confidence": "medium",
            "actionable_in_beds24": False,
        }
        recs.append(add_common_fields(rec, meta, listing_id))

    return recs


def main() -> None:
    monthly = load_csv("monthly_metrics.csv")
    availability = load_csv("inventory_availability.csv")
    offers = load_csv("future_offers.csv")
    diagnostics = load_csv("restriction_diagnostics.csv")

    meta = get_listing_meta(monthly, availability, offers, diagnostics)
    offers_lu = offer_lookup(offers)

    gaps = find_available_runs(availability, max_gap_days=7)

    recs: List[Dict[str, Any]] = []
    recs.extend(build_orphan_night_recommendations(gaps, offers_lu, meta))
    recs.extend(build_short_gap_restriction_recommendations(gaps, diagnostics, meta))
    recs.extend(build_occupancy_risk_recommendations(monthly, meta))
    recs.extend(build_price_protection_recommendations(monthly, meta))

    recommendations = pd.DataFrame(recs)

    out_path = ROOT / "outputs" / "processed" / "recommendations.csv"
    recommendations.to_csv(out_path, index=False)
    print(f"Wrote recommendations to {out_path}")

    if recommendations.empty:
        print("No recommendations generated.")
        return

    print()
    print("Recommendation summary:")
    print(
        recommendations.groupby(["category", "priority"], dropna=False)
        .size()
        .to_string()
    )

    print()
    cols = [
        "category",
        "priority",
        "listing_id",
        "period_start",
        "period_end",
        "problem",
        "suggested_action",
        "suggested_price",
    ]
    print(recommendations[cols].to_string(index=False))


if __name__ == "__main__":
    main()
