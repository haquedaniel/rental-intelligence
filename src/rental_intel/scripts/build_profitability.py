from __future__ import annotations

import calendar
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import yaml


ROOT = Path(__file__).resolve().parents[3]

MONTHS_2026 = [f"2026-{m:02d}" for m in range(1, 13)]

LISTING_META_FALLBACK = {
    "peskerezh_house": {
        "client_id": "daniel_aurore",
        "portfolio_id": "peskerezh",
        "portfolio_name": "La Peskerezh",
        "listing_name": "Grande maison de famille avec piscine",
    },
    "apt2": {
        "client_id": "daniel_aurore",
        "portfolio_id": "voilerie",
        "portfolio_name": "Le Clos de la Voilerie",
        "listing_name": "Un Jardin sur la Mer",
    },
    "apt4": {
        "client_id": "daniel_aurore",
        "portfolio_id": "voilerie",
        "portfolio_name": "Le Clos de la Voilerie",
        "listing_name": "Un Balcon sur la Mer",
    },
    "apt5": {
        "client_id": "daniel_aurore",
        "portfolio_id": "voilerie",
        "portfolio_name": "Le Clos de la Voilerie",
        "listing_name": "Le Refuge sous les Toits",
    },
}

def load_csv(name: str) -> pd.DataFrame:
    path = ROOT / "outputs" / "processed" / name
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}")
    return pd.read_csv(path)


def load_expense_rules(client_id: str) -> list[dict[str, Any]]:
    path = ROOT / "config" / "clients" / f"{client_id}_expenses.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing expense rules: {path}")

    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data.get("expense_rules", [])


def parse_date(value: Any) -> pd.Timestamp | None:
    if value is None or value == "":
        return None
    if pd.isna(value):
        return None
    return pd.to_datetime(value)


def list_matches(value: Any, allowed: list[Any] | None) -> bool:
    if not allowed:
        return True
    return str(value) in {str(x) for x in allowed}


def list_excludes(value: Any, excluded: list[Any] | None) -> bool:
    if not excluded:
        return False
    return str(value) in {str(x) for x in excluded}


def rule_applies_to_booking(rule: dict[str, Any], booking: pd.Series) -> bool:
    applies = rule.get("applies_to", {}) or {}

    arrival = pd.to_datetime(booking["arrival"])
    start_date = parse_date(applies.get("start_date"))
    end_date = parse_date(applies.get("end_date"))

    if start_date is not None and arrival < start_date:
        return False

    if end_date is not None and arrival > end_date:
        return False

    if not list_matches(booking.get("portfolio_id"), applies.get("portfolio_ids")):
        return False

    if not list_matches(booking.get("listing_id"), applies.get("listing_ids")):
        return False

    channel = str(booking.get("channel") or "").lower()

    include_channels = applies.get("include_channels")
    if include_channels:
        include_channels = [str(x).lower() for x in include_channels]
        if channel not in include_channels:
            return False

    exclude_channels = applies.get("exclude_channels")
    if exclude_channels:
        exclude_channels = [str(x).lower() for x in exclude_channels]
        if channel in exclude_channels:
            return False

    return True


def calculate_booking_expense(rule: dict[str, Any], booking: pd.Series) -> float:
    calc_type = rule.get("calculation_type")

    amount = float(rule.get("amount") or 0)
    percentage = float(rule.get("percentage") or 0) / 100

    host_payout = float(booking.get("host_payout") or 0)
    cleaning_fee = float(booking.get("cleaning_fee") or 0)
    accommodation = float(booking.get("accommodation_revenue") or 0)
    nights = int(booking.get("nights") or 0)

    if calc_type == "fixed_per_booking":
        return round(amount, 2)

    if calc_type == "fixed_per_night":
        return round(amount * nights, 2)

    if calc_type == "percentage_of_host_payout":
        return round(host_payout * percentage, 2)

    if calc_type == "percentage_of_host_payout_minus_cleaning":
        return round((host_payout - cleaning_fee) * percentage, 2)

    if calc_type == "percentage_of_accommodation_revenue":
        return round(accommodation * percentage, 2)
    
    if calc_type == "equal_to_cleaning_fee_charged":
        return round(cleaning_fee, 2)

    raise ValueError(f"Unsupported booking expense calculation_type: {calc_type}")


def build_booking_expenses(
    reservations: pd.DataFrame,
    rules: list[dict[str, Any]],
) -> pd.DataFrame:
    active = reservations[
        reservations["status"].astype(str).str.lower().isin(["confirmed", "new", "request"])
    ].copy()

    booking_rules = [
        r for r in rules
        if r.get("cost_family") == "booking_associated"
    ]

    rows: List[Dict[str, Any]] = []

    for _, booking in active.iterrows():
        for rule in booking_rules:
            if not rule_applies_to_booking(rule, booking):
                continue

            expense_amount = calculate_booking_expense(rule, booking)

            rows.append(
                {
                    "client_id": booking.get("client_id"),
                    "portfolio_id": booking.get("portfolio_id"),
                    "portfolio_name": booking.get("portfolio_name"),
                    "listing_id": booking.get("listing_id"),
                    "listing_name": booking.get("listing_name"),
                    "source_booking_id": booking.get("source_booking_id"),
                    "arrival": booking.get("arrival"),
                    "departure": booking.get("departure"),
                    "nights": booking.get("nights"),
                    "channel": booking.get("channel"),
                    "year_month": pd.to_datetime(booking.get("arrival")).strftime("%Y-%m"),
                    "rule_id": rule.get("rule_id"),
                    "category": rule.get("category"),
                    "cost_family": rule.get("cost_family"),
                    "calculation_type": rule.get("calculation_type"),
                    "expense_amount": expense_amount,
                }
            )

    return pd.DataFrame(rows)


def rule_applies_to_month(rule: dict[str, Any], portfolio_id: str, listing_id: str | None, month_start: pd.Timestamp) -> bool:
    applies = rule.get("applies_to", {}) or {}

    start_date = parse_date(applies.get("start_date"))
    end_date = parse_date(applies.get("end_date"))

    if start_date is not None and month_start < start_date.replace(day=1):
        return False

    if end_date is not None and month_start > end_date.replace(day=1):
        return False

    if not list_matches(portfolio_id, applies.get("portfolio_ids")):
        return False

    if listing_id is not None and not list_matches(listing_id, applies.get("listing_ids")):
        return False

    return True

def listing_ids_from_fixed_rules(rules: list[dict[str, Any]]) -> set[str]:
    listing_ids: set[str] = set()

    for rule in rules:
        if rule.get("cost_family") != "fixed_period":
            continue

        applies = rule.get("applies_to", {}) or {}

        # Unit-level costs, like lot6/lot7/lot8, are handled in portfolio profitability.
        if applies.get("unit_ids"):
            continue

        for listing_id in applies.get("listing_ids") or []:
            listing_ids.add(str(listing_id))

    return listing_ids


def build_complete_monthly_base(
    monthly: pd.DataFrame,
    rules: list[dict[str, Any]],
) -> pd.DataFrame:
    """
    Ensure monthly profitability has one row per active STR listing per month,
    even when there are no bookings.

    This is necessary because fixed costs exist even when revenue is zero.
    """
    monthly = monthly.copy()

    if monthly.empty:
        existing_listing_ids: set[str] = set()
    else:
        existing_listing_ids = set(monthly["listing_id"].dropna().astype(str).unique())

    fixed_listing_ids = listing_ids_from_fixed_rules(rules)

    listing_ids = sorted(existing_listing_ids | fixed_listing_ids)

    required_rows: list[dict[str, Any]] = []

    for listing_id in listing_ids:
        meta = LISTING_META_FALLBACK.get(listing_id, {})

        # If listing appears in monthly data, prefer real metadata from there.
        existing = monthly[monthly["listing_id"].astype(str) == listing_id]
        if not existing.empty:
            first = existing.iloc[0]
            meta = {
                "client_id": first.get("client_id"),
                "portfolio_id": first.get("portfolio_id"),
                "portfolio_name": first.get("portfolio_name"),
                "listing_name": first.get("listing_name"),
            } | meta

            # Prefer non-empty real values over fallback.
            for key in ["client_id", "portfolio_id", "portfolio_name", "listing_name"]:
                if pd.notna(first.get(key)) and str(first.get(key)) != "":
                    meta[key] = first.get(key)

        if not meta:
            # Unknown listing; skip rather than creating bad nan rows.
            continue

        for ym in MONTHS_2026:
            year, month = ym.split("-")
            required_rows.append(
                {
                    "client_id": meta.get("client_id"),
                    "portfolio_id": meta.get("portfolio_id"),
                    "portfolio_name": meta.get("portfolio_name"),
                    "listing_id": listing_id,
                    "listing_name": meta.get("listing_name"),
                    "year": int(year),
                    "month": int(month),
                    "year_month": ym,
                    "booked_nights": 0,
                    "gross_booking_value": 0.0,
                    "accommodation_revenue": 0.0,
                    "cleaning_fee": 0.0,
                    "tourist_tax": 0.0,
                    "channel_commission": 0.0,
                    "host_payout": 0.0,
                    "host_payout_minus_cleaning": 0.0,
                    "available_nights": pd.Period(ym).days_in_month,
                    "occupancy_pct": 0.0,
                    "adr_accommodation": 0.0,
                    "adr_host_payout": 0.0,
                }
            )

    base = pd.DataFrame(required_rows)

    if monthly.empty:
        return base

    index_cols = ["portfolio_id", "listing_id", "year_month"]

    combined = base.merge(
        monthly,
        on=index_cols,
        how="left",
        suffixes=("_base", ""),
    )

    # For every column, prefer real monthly value; otherwise keep base zero/default.
    output_cols = list(base.columns)
    out = pd.DataFrame()

    for col in output_cols:
        if col in index_cols:
            out[col] = combined[col]
        elif col in monthly.columns and col in base.columns:
            out[col] = combined[col].combine_first(combined[f"{col}_base"])
        elif f"{col}_base" in combined.columns:
            out[col] = combined[f"{col}_base"]
        elif col in combined.columns:
            out[col] = combined[col]

    money_cols = [
        "gross_booking_value",
        "accommodation_revenue",
        "cleaning_fee",
        "tourist_tax",
        "channel_commission",
        "host_payout",
        "host_payout_minus_cleaning",
        "adr_accommodation",
        "adr_host_payout",
    ]

    for col in money_cols:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0).round(2)

    int_cols = ["year", "month", "booked_nights", "available_nights"]
    for col in int_cols:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0).astype(int)

    if "occupancy_pct" in out.columns:
        out["occupancy_pct"] = pd.to_numeric(out["occupancy_pct"], errors="coerce").fillna(0).round(1)

    return out.sort_values(["portfolio_id", "listing_id", "year_month"])

def build_fixed_expenses(
    monthly: pd.DataFrame,
    rules: list[dict[str, Any]],
) -> pd.DataFrame:
    fixed_rules = [
        r for r in rules
        if r.get("cost_family") == "fixed_period"
        and not (r.get("applies_to", {}) or {}).get("unit_ids")
    ]

    if monthly.empty or not fixed_rules:
        return pd.DataFrame()

    rows: List[Dict[str, Any]] = []

    month_listing_base = monthly[
        [
            "client_id",
            "portfolio_id",
            "portfolio_name",
            "listing_id",
            "listing_name",
            "year",
            "month",
            "year_month",
            "host_payout",
            "booked_nights",
        ]
    ].copy()

    for rule in fixed_rules:
        calc_type = rule.get("calculation_type")
        if calc_type != "fixed_monthly":
            raise ValueError(f"Unsupported fixed expense calculation_type: {calc_type}")

        total_amount = float(rule.get("amount") or 0)
        allocation_method = rule.get("allocation_method", "portfolio_level")

        for year_month, month_group in month_listing_base.groupby("year_month"):
            month_start = pd.to_datetime(f"{year_month}-01")

            # Select eligible listings for this rule/month.
            eligible = month_group[
                month_group.apply(
                    lambda row: rule_applies_to_month(
                        rule,
                        portfolio_id=str(row["portfolio_id"]),
                        listing_id=str(row["listing_id"]),
                        month_start=month_start,
                    ),
                    axis=1,
                )
            ].copy()

            if eligible.empty:
                continue

            if allocation_method == "portfolio_level":
                # Apply once to the first matching portfolio row.
                first = eligible.iloc[0]
                rows.append(
                    {
                        "client_id": first["client_id"],
                        "portfolio_id": first["portfolio_id"],
                        "portfolio_name": first["portfolio_name"],
                        "listing_id": None,
                        "listing_name": None,
                        "year_month": year_month,
                        "rule_id": rule.get("rule_id"),
                        "category": rule.get("category"),
                        "cost_family": rule.get("cost_family"),
                        "calculation_type": calc_type,
                        "allocation_method": allocation_method,
                        "expense_amount": round(total_amount, 2),
                    }
                )
                continue

            if allocation_method == "split_evenly_across_listings":
                amount_each = round(total_amount / len(eligible), 2)
                weights = [amount_each] * len(eligible)
                # final row absorbs rounding
                if weights:
                    weights[-1] = round(total_amount - sum(weights[:-1]), 2)

            elif allocation_method == "split_by_host_payout":
                total_weight = float(eligible["host_payout"].sum())
                if total_weight <= 0:
                    amount_each = round(total_amount / len(eligible), 2)
                    weights = [amount_each] * len(eligible)
                    if weights:
                        weights[-1] = round(total_amount - sum(weights[:-1]), 2)
                else:
                    weights = [
                        round(total_amount * float(row["host_payout"]) / total_weight, 2)
                        for _, row in eligible.iterrows()
                    ]
                    if weights:
                        weights[-1] = round(total_amount - sum(weights[:-1]), 2)

            elif allocation_method == "split_by_booked_nights":
                total_weight = float(eligible["booked_nights"].sum())
                if total_weight <= 0:
                    amount_each = round(total_amount / len(eligible), 2)
                    weights = [amount_each] * len(eligible)
                    if weights:
                        weights[-1] = round(total_amount - sum(weights[:-1]), 2)
                else:
                    weights = [
                        round(total_amount * float(row["booked_nights"]) / total_weight, 2)
                        for _, row in eligible.iterrows()
                    ]
                    if weights:
                        weights[-1] = round(total_amount - sum(weights[:-1]), 2)

            else:
                raise ValueError(f"Unsupported allocation_method: {allocation_method}")

            for (_, row), amount in zip(eligible.iterrows(), weights):
                rows.append(
                    {
                        "client_id": row["client_id"],
                        "portfolio_id": row["portfolio_id"],
                        "portfolio_name": row["portfolio_name"],
                        "listing_id": row["listing_id"],
                        "listing_name": row["listing_name"],
                        "year_month": year_month,
                        "rule_id": rule.get("rule_id"),
                        "category": rule.get("category"),
                        "cost_family": rule.get("cost_family"),
                        "calculation_type": calc_type,
                        "allocation_method": allocation_method,
                        "expense_amount": round(amount, 2),
                    }
                )

    return pd.DataFrame(rows)


def build_monthly_profitability(
    monthly: pd.DataFrame,
    booking_expenses: pd.DataFrame,
    fixed_expenses: pd.DataFrame,
) -> pd.DataFrame:
    base = monthly.copy()

    if not booking_expenses.empty:
        booking_summary = (
            booking_expenses.groupby(
                ["portfolio_id", "listing_id", "year_month", "category"],
                dropna=False,
            )["expense_amount"]
            .sum()
            .reset_index()
            .pivot_table(
                index=["portfolio_id", "listing_id", "year_month"],
                columns="category",
                values="expense_amount",
                aggfunc="sum",
                fill_value=0,
            )
            .reset_index()
        )
    else:
        booking_summary = pd.DataFrame(columns=["portfolio_id", "listing_id", "year_month"])

    if not fixed_expenses.empty:
        fixed_listing = fixed_expenses[fixed_expenses["listing_id"].notna()].copy()

        fixed_summary = (
            fixed_listing.groupby(
                ["portfolio_id", "listing_id", "year_month", "category"],
                dropna=False,
            )["expense_amount"]
            .sum()
            .reset_index()
            .pivot_table(
                index=["portfolio_id", "listing_id", "year_month"],
                columns="category",
                values="expense_amount",
                aggfunc="sum",
                fill_value=0,
            )
            .reset_index()
        )
    else:
        fixed_summary = pd.DataFrame(columns=["portfolio_id", "listing_id", "year_month"])

    out = base.merge(
        booking_summary,
        on=["portfolio_id", "listing_id", "year_month"],
        how="left",
        suffixes=("", "_booking_expense"),
    )

    out = out.merge(
        fixed_summary,
        on=["portfolio_id", "listing_id", "year_month"],
        how="left",
        suffixes=("", "_fixed_expense"),
    )

    expense_categories = [
        c for c in out.columns
        if c not in base.columns
        and c not in ["portfolio_id", "listing_id", "year_month"]
    ]

    for col in expense_categories:
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0)

    out["booking_associated_costs"] = 0.0
    if not booking_expenses.empty:
        booking_categories = booking_expenses["category"].dropna().unique()
        for cat in booking_categories:
            if cat in out.columns:
                out["booking_associated_costs"] += out[cat]

    out["fixed_allocated_costs"] = 0.0
    if not fixed_expenses.empty:
        fixed_categories = fixed_expenses["category"].dropna().unique()
        for cat in fixed_categories:
            if cat in out.columns:
                # If a category exists in both booking and fixed rules this will over-add.
                # Avoid that by not reusing categories across cost families.
                out["fixed_allocated_costs"] += out[cat]

    out["estimated_operating_profit"] = (
        pd.to_numeric(out["host_payout"], errors="coerce").fillna(0)
        - out["booking_associated_costs"]
        - out["fixed_allocated_costs"]
    ).round(2)

    out["booking_associated_costs"] = out["booking_associated_costs"].round(2)
    out["fixed_allocated_costs"] = out["fixed_allocated_costs"].round(2)

    return out


def main() -> None:
    client_id = "daniel_aurore"

    reservations = load_csv("normalized_reservations.csv")
    monthly = load_csv("monthly_metrics.csv")
    rules = load_expense_rules(client_id)
    monthly = build_complete_monthly_base(monthly, rules)

    booking_expenses = build_booking_expenses(reservations, rules)
    fixed_expenses = build_fixed_expenses(monthly, rules)
    profitability = build_monthly_profitability(monthly, booking_expenses, fixed_expenses)

    out_dir = ROOT / "outputs" / "processed"

    booking_path = out_dir / "booking_expenses.csv"
    fixed_path = out_dir / "fixed_expenses.csv"
    profitability_path = out_dir / "monthly_profitability.csv"

    booking_expenses.to_csv(booking_path, index=False)
    fixed_expenses.to_csv(fixed_path, index=False)
    profitability.to_csv(profitability_path, index=False)

    print(f"Wrote booking expenses to {booking_path}")
    print(f"Wrote fixed expenses to {fixed_path}")
    print(f"Wrote monthly profitability to {profitability_path}")

    print()
    cols = [
        "portfolio_id",
        "listing_id",
        "year_month",
        "host_payout",
        "booking_associated_costs",
        "fixed_allocated_costs",
        "estimated_operating_profit",
    ]
    print(profitability[cols].to_string(index=False))


if __name__ == "__main__":
    main()
