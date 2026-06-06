from __future__ import annotations

import calendar
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import yaml


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"


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


def month_days(year_month: str) -> int:
    year, month = [int(x) for x in year_month.split("-")]
    return calendar.monthrange(year, month)[1]


def month_number(year_month: str) -> int:
    return int(year_month.split("-")[1])


def build_listing_occupied_days(daily: pd.DataFrame) -> pd.DataFrame:
    if daily.empty:
        return pd.DataFrame()

    active = daily.copy()
    active["year_month"] = pd.to_datetime(active["date"]).dt.strftime("%Y-%m")

    return (
        active.groupby(
            ["client_id", "portfolio_id", "portfolio_name", "listing_id", "listing_name", "year_month"],
            dropna=False,
        )
        .agg(occupied_days=("is_booked", "sum"))
        .reset_index()
    )


def unit_meta(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(u["unit_id"]): u for u in config.get("units", [])}


def rule_matches_month(rule: dict[str, Any], year_month: str) -> bool:
    applies = rule.get("applies_to", {}) or {}
    months = applies.get("months")

    if months and month_number(year_month) not in [int(m) for m in months]:
        return False

    start_date = applies.get("start_date")
    end_date = applies.get("end_date")
    month_start = pd.to_datetime(f"{year_month}-01")

    if start_date and month_start < pd.to_datetime(start_date).replace(day=1):
        return False

    if end_date and month_start > pd.to_datetime(end_date).replace(day=1):
        return False

    return True


def build_variable_period_costs(config: dict[str, Any], daily: pd.DataFrame) -> pd.DataFrame:
    listing_days = build_listing_occupied_days(daily)
    units = unit_meta(config)

    months = [f"2026-{m:02d}" for m in range(1, 13)]
    rows: List[Dict[str, Any]] = []

    rules = [
        r for r in config.get("expense_rules", [])
        if r.get("cost_family") == "variable_period"
    ]

    for rule in rules:
        applies = rule.get("applies_to", {}) or {}
        calc_type = rule.get("calculation_type")
        amount_per_day = float(rule.get("amount_per_day") or rule.get("amount") or 0)

        if calc_type != "per_occupied_day":
            raise ValueError(
                f"Unsupported variable_period calculation_type for {rule.get('rule_id')}: {calc_type}"
            )

        # Short-term listing rules: occupied days come from daily_calendar.csv
        for listing_id in applies.get("listing_ids") or []:
            listing_id = str(listing_id)

            if listing_days.empty:
                continue

            listing_base = listing_days[listing_days["listing_id"].astype(str) == listing_id].copy()

            for _, row in listing_base.iterrows():
                ym = str(row["year_month"])
                if not rule_matches_month(rule, ym):
                    continue

                occupied_days = float(row["occupied_days"])
                amount = round(occupied_days * amount_per_day, 2)

                rows.append(
                    {
                        "client_id": row.get("client_id"),
                        "portfolio_id": row.get("portfolio_id"),
                        "portfolio_name": row.get("portfolio_name"),
                        "listing_id": listing_id,
                        "listing_name": row.get("listing_name"),
                        "unit_id": None,
                        "unit_type": "short_term_rental",
                        "year_month": ym,
                        "rule_id": rule.get("rule_id"),
                        "category": rule.get("category"),
                        "cost_family": rule.get("cost_family"),
                        "calculation_type": calc_type,
                        "occupied_days": occupied_days,
                        "amount_per_day": amount_per_day,
                        "expense_amount": amount,
                    }
                )

        # Unit rules: e.g. lot8 long-term rental, full month occupancy
        for unit_id in applies.get("unit_ids") or []:
            unit_id = str(unit_id)
            unit = units.get(unit_id, {})
            portfolio_id = (
                (applies.get("portfolio_ids") or [None])[0]
                or unit.get("portfolio_id")
            )

            occupancy_basis = applies.get("occupancy_basis", "full_month")

            for ym in months:
                if not rule_matches_month(rule, ym):
                    continue

                if occupancy_basis == "full_month":
                    occupied_days = month_days(ym)
                else:
                    raise ValueError(
                        f"Unsupported occupancy_basis for {rule.get('rule_id')}: {occupancy_basis}"
                    )

                amount = round(occupied_days * amount_per_day, 2)

                rows.append(
                    {
                        "client_id": "daniel_aurore",
                        "portfolio_id": portfolio_id,
                        "portfolio_name": None,
                        "listing_id": None,
                        "listing_name": None,
                        "unit_id": unit_id,
                        "unit_type": unit.get("unit_type"),
                        "year_month": ym,
                        "rule_id": rule.get("rule_id"),
                        "category": rule.get("category"),
                        "cost_family": rule.get("cost_family"),
                        "calculation_type": calc_type,
                        "occupied_days": occupied_days,
                        "amount_per_day": amount_per_day,
                        "expense_amount": amount,
                    }
                )

    return pd.DataFrame(rows)


def main() -> None:
    client_id = "daniel_aurore"

    config = load_expense_config(client_id)
    daily = load_csv("daily_calendar.csv")

    costs = build_variable_period_costs(config, daily)

    out_path = PROCESSED / "variable_period_costs.csv"
    costs.to_csv(out_path, index=False)

    print(f"Wrote variable period costs to {out_path}")

    if costs.empty:
        print("No variable period costs generated.")
    else:
        print()
        print(costs.to_string(index=False))

        print()
        print("Annual totals:")
        print(
            costs.groupby(["portfolio_id", "listing_id", "unit_id", "category"], dropna=False)
            .agg(amount=("expense_amount", "sum"))
            .round(2)
            .to_string()
        )


if __name__ == "__main__":
    main()
