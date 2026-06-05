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


def load_monthly_targets(client_id: str) -> pd.DataFrame:
    path = ROOT / "config" / "clients" / f"{client_id}_targets.yaml"
    if not path.exists():
        return pd.DataFrame()

    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    rows = []

    listing_to_portfolio = {
        "peskerezh_house": "peskerezh",
        "apt2": "voilerie",
        "apt4": "voilerie",
        "apt5": "voilerie",
    }

    for item in data.get("monthly_targets", []):
        year_month = str(item["year_month"])
        year = int(year_month[:4])

        for listing_id, target in item.get("targets", {}).items():
            rows.append(
                {
                    "year": year,
                    "year_month": year_month,
                    "portfolio_id": listing_to_portfolio.get(listing_id),
                    "listing_id": listing_id,
                    "target_host_payout": float(target or 0),
                }
            )

    return pd.DataFrame(rows)


def main() -> None:
    client_id = "daniel_aurore"
    today = date.today()
    current_year = today.year
    current_month = f"{today.year}-{today.month:02d}"

    monthly_profitability = load_csv("monthly_profitability.csv")
    portfolio_profitability = load_csv("portfolio_profitability.csv")
    booking_expenses = load_csv("booking_expenses.csv")
    targets = load_monthly_targets(client_id)

    rows: List[Dict[str, Any]] = []

    portfolios = sorted(
        set(monthly_profitability["portfolio_id"].dropna().astype(str).unique())
        | set(portfolio_profitability["portfolio_id"].dropna().astype(str).unique())
    )

    if targets.empty:
        current_month_targets = pd.DataFrame()
        year_targets = pd.DataFrame()
    else:
        current_month_targets = targets[targets["year_month"].astype(str) == current_month]
        year_targets = targets[targets["year"].astype(int) == current_year]

    for portfolio_id in portfolios:
        monthly_p = monthly_profitability[
            monthly_profitability["portfolio_id"].astype(str) == portfolio_id
        ].copy()

        portfolio_p = portfolio_profitability[
            portfolio_profitability["portfolio_id"].astype(str) == portfolio_id
        ].copy()

        current_month_listing = monthly_p[
            monthly_p["year_month"].astype(str) == current_month
        ]

        current_month_portfolio = portfolio_p[
            portfolio_p["year_month"].astype(str) == current_month
        ]

        ytd_listing = monthly_p[
            monthly_p["year"].astype(int) == current_year
        ]

        ytd_portfolio = portfolio_p[
            portfolio_p["year_month"].astype(str).str.startswith(str(current_year))
        ]

        portfolio_targets = (
            year_targets[
                year_targets["portfolio_id"].astype(str) == portfolio_id
            ]
            if not year_targets.empty
            else pd.DataFrame()
        )

        portfolio_current_target = (
            current_month_targets[
                current_month_targets["portfolio_id"].astype(str) == portfolio_id
            ]
            if not current_month_targets.empty
            else pd.DataFrame()
        )

        target_host_payout = (
            float(portfolio_targets["target_host_payout"].sum())
            if not portfolio_targets.empty
            else 0.0
        )

        current_month_target_host_payout = (
            float(portfolio_current_target["target_host_payout"].sum())
            if not portfolio_current_target.empty
            else 0.0
        )

        ytd_host_payout = (
            float(ytd_listing["host_payout"].sum())
            if not ytd_listing.empty
            else 0.0
        )

        ytd_operating_profit = (
            float(ytd_listing["estimated_operating_profit"].sum())
            if not ytd_listing.empty
            else 0.0
        )

        ytd_portfolio_cash_result = (
            float(ytd_portfolio["estimated_portfolio_cash_result"].sum())
            if not ytd_portfolio.empty
            else 0.0
        )

        current_host_payout = (
            float(current_month_listing["host_payout"].sum())
            if not current_month_listing.empty
            else 0.0
        )

        current_operating_profit = (
            float(current_month_listing["estimated_operating_profit"].sum())
            if not current_month_listing.empty
            else 0.0
        )

        current_portfolio_cash_result = (
            float(current_month_portfolio["estimated_portfolio_cash_result"].sum())
            if not current_month_portfolio.empty
            else 0.0
        )

        remaining_months = max(12 - today.month + 1, 1)

        rows.append(
            {
                "client_id": client_id,
                "portfolio_id": portfolio_id,
                "year": current_year,
                "current_month": current_month,

                # Current month
                "current_month_host_payout": round(current_host_payout, 2),
                "current_month_target_host_payout": round(current_month_target_host_payout, 2),
                "current_month_vs_target": round(
                    current_host_payout - current_month_target_host_payout,
                    2,
                ),
                "current_month_target_pct": round(
                    current_host_payout / current_month_target_host_payout * 100,
                    1,
                )
                if current_month_target_host_payout
                else None,
                "current_month_operating_profit": round(current_operating_profit, 2),
                "current_month_portfolio_cash_result": round(
                    current_portfolio_cash_result,
                    2,
                ),

                # YTD / annual target
                "ytd_host_payout": round(ytd_host_payout, 2),
                "target_host_payout": round(target_host_payout, 2),
                "host_payout_target_pct": round(
                    ytd_host_payout / target_host_payout * 100,
                    1,
                )
                if target_host_payout
                else None,
                "host_payout_remaining_to_target": round(
                    target_host_payout - ytd_host_payout,
                    2,
                )
                if target_host_payout
                else None,
                "host_payout_required_per_remaining_month": round(
                    (target_host_payout - ytd_host_payout) / remaining_months,
                    2,
                )
                if target_host_payout
                else None,

                # Profit metrics without targets for now
                "ytd_operating_profit": round(ytd_operating_profit, 2),
                "ytd_portfolio_cash_result": round(ytd_portfolio_cash_result, 2),
            }
        )

    kpis = pd.DataFrame(rows)

    if booking_expenses.empty:
        cleaner_due = pd.DataFrame()
    else:
        cleaner_due = booking_expenses[
            (booking_expenses["category"].astype(str) == "cleaning_actual_cost")
            & (booking_expenses["year_month"].astype(str) == current_month)
        ].copy()

    out_dir = ROOT / "outputs" / "processed"
    kpis_path = out_dir / "dashboard_kpis.csv"
    cleaner_path = out_dir / "cleaner_payment_due.csv"

    kpis.to_csv(kpis_path, index=False)
    cleaner_due.to_csv(cleaner_path, index=False)

    print(f"Wrote dashboard KPIs to {kpis_path}")
    print(f"Wrote cleaner payment due to {cleaner_path}")
    print()
    print(kpis.to_string(index=False))

    if not cleaner_due.empty:
        print()
        print("Cleaner payment due this month:")
        cols = [
            "portfolio_id",
            "listing_id",
            "source_booking_id",
            "arrival",
            "departure",
            "channel",
            "rule_id",
            "expense_amount",
        ]
        existing_cols = [c for c in cols if c in cleaner_due.columns]
        print(cleaner_due[existing_cols].to_string(index=False))


if __name__ == "__main__":
    main()
