from __future__ import annotations

import calendar
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import yaml


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"

MONTHS_2026 = [f"2026-{m:02d}" for m in range(1, 13)]

# Simple seasonal default occupancy targets.
# We can later move this into YAML if we want.
FALLBACK_TARGET_OCCUPANCY_BY_MONTH = {
    1: 0.30,
    2: 0.30,
    3: 0.30,
    4: 0.55,
    5: 0.55,
    6: 0.55,
    7: 0.80,
    8: 0.80,
    9: 0.55,
    10: 0.55,
    11: 0.30,
    12: 0.30,
}



def load_csv(name: str) -> pd.DataFrame:
    path = PROCESSED / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def load_expense_config(client_id: str) -> dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}_expenses.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing expense config: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}

def load_targets_config(client_id: str) -> dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}_targets.yaml"
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def month_number(year_month: str) -> int:
    return int(str(year_month).split("-")[1])


def days_in_month(year_month: str) -> int:
    year, month = [int(x) for x in str(year_month).split("-")]
    return calendar.monthrange(year, month)[1]


def month_start(year_month: str) -> pd.Timestamp:
    return pd.to_datetime(f"{year_month}-01")


def safe_float(value: Any) -> float:
    if value is None or pd.isna(value):
        return 0.0
    return float(value)


def rule_matches_month(rule: dict[str, Any], year_month: str) -> bool:
    applies = rule.get("applies_to", {}) or {}

    months = applies.get("months")
    if months and month_number(year_month) not in [int(m) for m in months]:
        return False

    start_date = applies.get("start_date")
    end_date = applies.get("end_date")
    start = month_start(year_month)

    if start_date and start < pd.to_datetime(start_date).replace(day=1):
        return False

    if end_date and start > pd.to_datetime(end_date).replace(day=1):
        return False

    return True


def rule_applies_to_listing(
    rule: dict[str, Any],
    listing_id: str,
    portfolio_id: str,
) -> bool:
    applies = rule.get("applies_to", {}) or {}

    listing_ids = applies.get("listing_ids")
    portfolio_ids = applies.get("portfolio_ids")

    if listing_ids and listing_id not in [str(x) for x in listing_ids]:
        return False

    if portfolio_ids and portfolio_id not in [str(x) for x in portfolio_ids]:
        return False

    if not listing_ids and not portfolio_ids:
        return False

    return True


def normalise_pct(value: Any) -> float:
    """
    Accept either 55 or 0.55 and return 0.55.
    """
    if value is None or pd.isna(value):
        return 0.0

    value = float(value)

    if value > 1:
        return value / 100

    return value


def target_occupancy_pct(
    targets_config: dict[str, Any],
    listing_id: str,
    year_month: str,
) -> float:
    month = month_number(year_month)
    occupancy = targets_config.get("occupancy_targets", {}) or {}

    by_listing = occupancy.get("by_listing", {}) or {}
    listing_targets = by_listing.get(listing_id, {}) or {}

    # Listing-specific override first.
    if month in listing_targets:
        return normalise_pct(listing_targets[month])

    if str(month) in listing_targets:
        return normalise_pct(listing_targets[str(month)])

    default_targets = occupancy.get("default", {}) or {}

    if month in default_targets:
        return normalise_pct(default_targets[month])

    if str(month) in default_targets:
        return normalise_pct(default_targets[str(month)])

    return FALLBACK_TARGET_OCCUPANCY_BY_MONTH.get(month, 0.50)


def variable_costs_per_night(
    rules: list[dict[str, Any]],
    listing_id: str,
    portfolio_id: str,
    year_month: str,
) -> dict[str, float]:
    result: dict[str, float] = {}

    for rule in rules:
        if rule.get("cost_family") != "variable_period":
            continue

        if rule.get("calculation_type") != "per_occupied_day":
            continue

        applies = rule.get("applies_to", {}) or {}

        # Price floors are for short-term rentable listings only.
        if applies.get("unit_ids"):
            continue

        if not rule_applies_to_listing(rule, listing_id, portfolio_id):
            continue

        if not rule_matches_month(rule, year_month):
            continue

        category = str(rule.get("category") or "variable_usage")
        amount = safe_float(rule.get("amount_per_day") or rule.get("amount") or 0)

        result[category] = round(result.get(category, 0.0) + amount, 2)

    return result


def concierge_rate(
    rules: list[dict[str, Any]],
    listing_id: str,
    portfolio_id: str,
    year_month: str,
) -> float:
    rate = 0.0

    for rule in rules:
        if rule.get("cost_family") != "booking_associated":
            continue

        if rule.get("category") != "concierge":
            continue

        if not rule_applies_to_listing(rule, listing_id, portfolio_id):
            continue

        if not rule_matches_month(rule, year_month):
            continue

        rate += safe_float(rule.get("percentage") or 0) / 100

    return min(rate, 0.95)


def cleaning_fee_assumption(
    reservations: pd.DataFrame,
    listing_id: str,
    year_month: str,
) -> float:
    if reservations.empty:
        return 0.0

    active = reservations[
        reservations["status"].astype(str).str.lower().isin(["new", "confirmed", "request"])
    ].copy()

    active = active[active["listing_id"].astype(str) == listing_id].copy()

    if active.empty or "cleaning_fee" not in active.columns:
        return 0.0

    active["arrival_month"] = pd.to_datetime(active["arrival"]).dt.strftime("%Y-%m")
    active["cleaning_fee"] = pd.to_numeric(active["cleaning_fee"], errors="coerce").fillna(0)

    same_month = active[
        (active["arrival_month"] == year_month)
        & (active["cleaning_fee"] > 0)
    ]

    if not same_month.empty:
        return round(float(same_month["cleaning_fee"].median()), 2)

    any_month = active[active["cleaning_fee"] > 0]

    if not any_month.empty:
        return round(float(any_month["cleaning_fee"].median()), 2)

    return 0.0


def gross_up_for_concierge(cost: float, rate: float) -> float:
    net_fraction = 1 - rate
    if net_fraction <= 0:
        return 0.0
    return round(cost / net_fraction, 2)


def main() -> None:
    client_id = "daniel_aurore"

    expense_config = load_expense_config(client_id)
    targets_config = load_targets_config(client_id)

    reservations = load_csv("normalized_reservations.csv")
    listing_financials = load_csv("listing_month_financials.csv")

    if listing_financials.empty:
        raise FileNotFoundError(
            "listing_month_financials.csv missing or empty. Run build_financial_views first."
        )

    rules = expense_config.get("expense_rules", [])

    base = listing_financials[
        [
            "client_id",
            "portfolio_id",
            "portfolio_name",
            "listing_id",
            "listing_name",
            "year_month",
            "booked_nights",
            "available_nights",
            "adr_accommodation",
            "attributable_fixed_costs_total",
        ]
    ].copy()

    rows: List[Dict[str, Any]] = []

    for _, row in base.iterrows():
        portfolio_id = str(row["portfolio_id"])
        listing_id = str(row["listing_id"])
        ym = str(row["year_month"])

        month_num = month_number(ym)
        dim = days_in_month(ym)

        booked_nights = safe_float(row.get("booked_nights"))
        fixed_costs = safe_float(row.get("attributable_fixed_costs_total"))
        current_adr = safe_float(row.get("adr_accommodation"))

        target_occ_pct = target_occupancy_pct(
            targets_config=targets_config,
            listing_id=listing_id,
            year_month=ym,
        )
        target_occupied_nights = round(dim * target_occ_pct, 2)

        variable_parts = variable_costs_per_night(
            rules=rules,
            listing_id=listing_id,
            portfolio_id=portfolio_id,
            year_month=ym,
        )

        energy_per_night = variable_parts.get("energy_usage", 0.0)
        water_per_night = variable_parts.get("water_usage", 0.0)
        variable_per_night = round(sum(variable_parts.values()), 2)

        rate = concierge_rate(
            rules=rules,
            listing_id=listing_id,
            portfolio_id=portfolio_id,
            year_month=ym,
        )

        cleaning = cleaning_fee_assumption(
            reservations=reservations,
            listing_id=listing_id,
            year_month=ym,
        )

        # 1. Pure variable floor
        variable_floor_excl_cleaning = gross_up_for_concierge(variable_per_night, rate)

        # 2. 100% occupancy floor
        fixed_per_calendar_night = fixed_costs / dim if dim else 0
        floor_100 = gross_up_for_concierge(
            fixed_per_calendar_night + variable_per_night,
            rate,
        )

        # 3. Target occupancy floor
        fixed_per_target_night = (
            fixed_costs / target_occupied_nights
            if target_occupied_nights
            else 0
        )
        floor_target = gross_up_for_concierge(
            fixed_per_target_night + variable_per_night,
            rate,
        )

        # 4. Current booked floor
        if booked_nights > 0:
            fixed_per_booked_night = fixed_costs / booked_nights
            floor_current = gross_up_for_concierge(
                fixed_per_booked_night + variable_per_night,
                rate,
            )
        else:
            floor_current = None

        def total_nightly_from_floor(floor: float | None, nights: int) -> float | None:
            if floor is None:
                return None
            return round(floor + (cleaning / nights), 2)

        rows.append(
            {
                "client_id": row.get("client_id"),
                "portfolio_id": portfolio_id,
                "portfolio_name": row.get("portfolio_name"),
                "listing_id": listing_id,
                "listing_name": row.get("listing_name"),
                "year_month": ym,
                "days_in_month": dim,
                "target_occupancy_pct": round(target_occ_pct * 100, 1),
                "target_occupied_nights": target_occupied_nights,
                "booked_nights": booked_nights,
                "current_adr_accommodation": round(current_adr, 2),
                "energy_cost_per_night": energy_per_night,
                "water_cost_per_night": water_per_night,
                "variable_cost_per_night": variable_per_night,
                "concierge_rate": round(rate, 4),
                "attributable_fixed_costs_total": round(fixed_costs, 2),

                # Floors excluding cleaning
                "variable_floor_excl_cleaning": variable_floor_excl_cleaning,
                "floor_100pct_occupancy_excl_cleaning": round(floor_100, 2),
                "floor_target_occupancy_excl_cleaning": round(floor_target, 2),
                "floor_current_booked_excl_cleaning": round(floor_current, 2)
                if floor_current is not None
                else None,

                # Cleaning and all-in nightly examples
                "cleaning_fee_assumption": cleaning,
                "min_total_nightly_1n_target_occ_incl_cleaning": total_nightly_from_floor(floor_target, 1),
                "min_total_nightly_3n_target_occ_incl_cleaning": total_nightly_from_floor(floor_target, 3),
                "min_total_nightly_7n_target_occ_incl_cleaning": total_nightly_from_floor(floor_target, 7),
            }
        )

    out = pd.DataFrame(rows)

    out_path = PROCESSED / "monthly_price_floors.csv"
    out.to_csv(out_path, index=False)

    print(f"Wrote monthly price floors to {out_path}")

    print()
    print(
        out[
            [
                "portfolio_id",
                "listing_id",
                "year_month",
                "target_occupancy_pct",
                "variable_cost_per_night",
                "concierge_rate",
                "attributable_fixed_costs_total",
                "variable_floor_excl_cleaning",
                "floor_100pct_occupancy_excl_cleaning",
                "floor_target_occupancy_excl_cleaning",
                "current_adr_accommodation",
                "cleaning_fee_assumption",
                "min_total_nightly_1n_target_occ_incl_cleaning",
                "min_total_nightly_3n_target_occ_incl_cleaning",
                "min_total_nightly_7n_target_occ_incl_cleaning",
            ]
        ].to_string(index=False)
    )


if __name__ == "__main__":
    main()
