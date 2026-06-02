from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import yaml


ROOT = Path(__file__).resolve().parents[3]


def load_csv(name: str) -> pd.DataFrame:
    path = ROOT / "outputs" / "processed" / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def load_expense_config(client_id: str) -> dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}_expenses.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing expense config: {path}")

    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def parse_date(value: Any) -> pd.Timestamp | None:
    if value is None or value == "":
        return None
    if pd.isna(value):
        return None
    return pd.to_datetime(value)


def month_range_for_2026() -> list[str]:
    return [f"2026-{m:02d}" for m in range(1, 13)]


def month_start(year_month: str) -> pd.Timestamp:
    return pd.to_datetime(f"{year_month}-01")


def rule_active_for_month(applies_to: dict[str, Any], year_month: str) -> bool:
    start = parse_date(applies_to.get("start_date"))
    end = parse_date(applies_to.get("end_date"))
    start_of_month = month_start(year_month)

    if start is not None and start_of_month < start.replace(day=1):
        return False

    if end is not None and start_of_month > end.replace(day=1):
        return False

    return True


def build_long_term_income(config: dict[str, Any], months: list[str]) -> pd.DataFrame:
    rows: List[Dict[str, Any]] = []

    for income in config.get("long_term_income", []):
        portfolio_id = str(income["portfolio_id"])
        unit_id = str(income["unit_id"])
        category = str(income.get("category", "long_term_income"))
        amount = float(income.get("amount_monthly") or 0)

        applies = {
            "start_date": income.get("start_date"),
            "end_date": income.get("end_date"),
        }

        for ym in months:
            if not rule_active_for_month(applies, ym):
                continue

            rows.append(
                {
                    "portfolio_id": portfolio_id,
                    "unit_id": unit_id,
                    "year_month": ym,
                    "income_id": income.get("income_id"),
                    "category": category,
                    "amount": round(amount, 2),
                    "notes": income.get("notes", ""),
                }
            )

    return pd.DataFrame(rows)


def unit_meta(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    meta: dict[str, dict[str, Any]] = {}
    for unit in config.get("units", []):
        meta[str(unit["unit_id"])] = unit
    return meta


def build_unit_fixed_costs(config: dict[str, Any], months: list[str]) -> pd.DataFrame:
    rows: List[Dict[str, Any]] = []
    meta = unit_meta(config)

    for rule in config.get("expense_rules", []):
        if rule.get("cost_family") != "fixed_period":
            continue

        applies = rule.get("applies_to", {}) or {}
        unit_ids = applies.get("unit_ids") or []

        if not unit_ids:
            continue

        if rule.get("calculation_type") != "fixed_monthly":
            raise ValueError(
                f"Unsupported unit fixed calculation_type for {rule.get('rule_id')}: "
                f"{rule.get('calculation_type')}"
            )

        amount = float(rule.get("amount") or 0)

        for unit_id in unit_ids:
            unit_id = str(unit_id)
            unit = meta.get(unit_id, {})
            portfolio_id = applies.get("portfolio_ids", [unit.get("portfolio_id")])[0]

            for ym in months:
                if not rule_active_for_month(applies, ym):
                    continue

                rows.append(
                    {
                        "portfolio_id": str(portfolio_id),
                        "unit_id": unit_id,
                        "unit_type": unit.get("unit_type"),
                        "year_month": ym,
                        "rule_id": rule.get("rule_id"),
                        "category": rule.get("category"),
                        "cost_family": rule.get("cost_family"),
                        "calculation_type": rule.get("calculation_type"),
                        "expense_amount": round(amount, 2),
                    }
                )

    return pd.DataFrame(rows)


def main() -> None:
    client_id = "daniel_aurore"
    months = month_range_for_2026()

    config = load_expense_config(client_id)
    monthly_profitability = load_csv("monthly_profitability.csv")

    if monthly_profitability.empty:
        raise FileNotFoundError(
            "monthly_profitability.csv missing or empty. Run build_profitability first."
        )

    long_term_income = build_long_term_income(config, months)
    unit_fixed_costs = build_unit_fixed_costs(config, months)

    # Short-term summary by portfolio/month
    short_term = (
        monthly_profitability.groupby(["portfolio_id", "year_month"], dropna=False)
        .agg(
            short_term_host_payout=("host_payout", "sum"),
            short_term_accommodation_revenue=("accommodation_revenue", "sum"),
            short_term_cleaning_fee=("cleaning_fee", "sum"),
            short_term_tourist_tax=("tourist_tax", "sum"),
            short_term_booking_associated_costs=("booking_associated_costs", "sum"),
            short_term_fixed_allocated_costs=("fixed_allocated_costs", "sum"),
            short_term_operating_profit=("estimated_operating_profit", "sum"),
        )
        .reset_index()
    )

    portfolios = sorted(
        set(short_term["portfolio_id"].dropna().astype(str).unique())
        | set(long_term_income["portfolio_id"].dropna().astype(str).unique() if not long_term_income.empty else [])
        | set(unit_fixed_costs["portfolio_id"].dropna().astype(str).unique() if not unit_fixed_costs.empty else [])
    )

    base = pd.DataFrame(
        [
            {"portfolio_id": p, "year_month": ym}
            for p in portfolios
            for ym in months
        ]
    )

    out = base.merge(short_term, on=["portfolio_id", "year_month"], how="left")

    for col in [
        "short_term_host_payout",
        "short_term_accommodation_revenue",
        "short_term_cleaning_fee",
        "short_term_tourist_tax",
        "short_term_booking_associated_costs",
        "short_term_fixed_allocated_costs",
        "short_term_operating_profit",
    ]:
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0)

    if not long_term_income.empty:
        lti_pivot = (
            long_term_income.groupby(["portfolio_id", "year_month", "category"], dropna=False)["amount"]
            .sum()
            .reset_index()
            .pivot_table(
                index=["portfolio_id", "year_month"],
                columns="category",
                values="amount",
                aggfunc="sum",
                fill_value=0,
            )
            .reset_index()
        )

        out = out.merge(lti_pivot, on=["portfolio_id", "year_month"], how="left")

    for col in ["long_term_rent", "long_term_electricity_included"]:
        if col not in out.columns:
            out[col] = 0
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0)

    out["long_term_rent_gross"] = out["long_term_rent"]
    out["long_term_rent_adjustments"] = out["long_term_electricity_included"]
    out["long_term_rent_net"] = (
        out["long_term_rent_gross"] + out["long_term_rent_adjustments"]
    )

    if not unit_fixed_costs.empty:
        unit_cost_summary = (
            unit_fixed_costs.groupby(["portfolio_id", "year_month", "unit_type"], dropna=False)[
                "expense_amount"
            ]
            .sum()
            .reset_index()
            .pivot_table(
                index=["portfolio_id", "year_month"],
                columns="unit_type",
                values="expense_amount",
                aggfunc="sum",
                fill_value=0,
            )
            .reset_index()
        )

        out = out.merge(unit_cost_summary, on=["portfolio_id", "year_month"], how="left")

    # Unit fixed cost buckets
    for col in ["long_term_rental", "vacant_unit"]:
        if col not in out.columns:
            out[col] = 0
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0)

    out["fixed_costs_long_term_units"] = out["long_term_rental"]
    out["fixed_costs_vacant_units"] = out["vacant_unit"]
    out["unit_fixed_costs_total"] = (
        out["fixed_costs_long_term_units"] + out["fixed_costs_vacant_units"]
    )

    out["estimated_portfolio_cash_result"] = (
        out["short_term_operating_profit"]
        + out["long_term_rent_net"]
        - out["unit_fixed_costs_total"]
    )

    money_cols = [
        "short_term_host_payout",
        "short_term_accommodation_revenue",
        "short_term_cleaning_fee",
        "short_term_tourist_tax",
        "short_term_booking_associated_costs",
        "short_term_fixed_allocated_costs",
        "short_term_operating_profit",
        "long_term_rent_gross",
        "long_term_rent_adjustments",
        "long_term_rent_net",
        "fixed_costs_long_term_units",
        "fixed_costs_vacant_units",
        "unit_fixed_costs_total",
        "estimated_portfolio_cash_result",
    ]

    for col in money_cols:
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0).round(2)

    out = out[
        [
            "portfolio_id",
            "year_month",
            "short_term_host_payout",
            "short_term_accommodation_revenue",
            "short_term_cleaning_fee",
            "short_term_tourist_tax",
            "short_term_booking_associated_costs",
            "short_term_fixed_allocated_costs",
            "short_term_operating_profit",
            "long_term_rent_gross",
            "long_term_rent_adjustments",
            "long_term_rent_net",
            "fixed_costs_long_term_units",
            "fixed_costs_vacant_units",
            "unit_fixed_costs_total",
            "estimated_portfolio_cash_result",
        ]
    ]

    out_dir = ROOT / "outputs" / "processed"

    portfolio_path = out_dir / "portfolio_profitability.csv"
    lti_path = out_dir / "long_term_income.csv"
    unit_costs_path = out_dir / "unit_fixed_costs.csv"

    out.to_csv(portfolio_path, index=False)
    long_term_income.to_csv(lti_path, index=False)
    unit_fixed_costs.to_csv(unit_costs_path, index=False)

    print(f"Wrote portfolio profitability to {portfolio_path}")
    print(f"Wrote long-term income to {lti_path}")
    print(f"Wrote unit fixed costs to {unit_costs_path}")

    print()
    print(out.to_string(index=False))


if __name__ == "__main__":
    main()
