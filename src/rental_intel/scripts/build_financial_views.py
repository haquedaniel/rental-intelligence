from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"


def load_csv(name: str) -> pd.DataFrame:
    path = PROCESSED / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def safe_col(df: pd.DataFrame, col: str, default: float = 0.0) -> pd.Series:
    if col not in df.columns:
        return pd.Series([default] * len(df), index=df.index)
    return pd.to_numeric(df[col], errors="coerce").fillna(default)


def pick_expense_columns(df: pd.DataFrame) -> list[str]:
    excluded = {
        "client_id",
        "portfolio_id",
        "portfolio_name",
        "listing_id",
        "listing_name",
        "year",
        "month",
        "year_month",
        "booked_nights",
        "gross_booking_value",
        "accommodation_revenue",
        "cleaning_fee",
        "tourist_tax",
        "channel_commission",
        "host_payout",
        "host_payout_minus_cleaning",
        "available_nights",
        "occupancy_pct",
        "adr_accommodation",
        "adr_host_payout",
        "booking_associated_costs",
        "fixed_allocated_costs",
        "estimated_operating_profit",
    }

    numeric_cols = []
    for col in df.columns:
        if col in excluded:
            continue
        series = pd.to_numeric(df[col], errors="coerce")
        if series.notna().any():
            numeric_cols.append(col)

    return numeric_cols


def build_listing_month_financials() -> pd.DataFrame:
    profitability = load_csv("monthly_profitability.csv")

    if profitability.empty:
        raise FileNotFoundError(
            "monthly_profitability.csv missing or empty. Run build_profitability first."
        )

    df = profitability.copy()

    reservations = load_csv("normalized_reservations.csv")

    if not reservations.empty:
        active = reservations[
            reservations["status"].astype(str).str.lower().isin(["new", "confirmed", "request"])
        ].copy()

        active["year_month"] = pd.to_datetime(active["arrival"]).dt.strftime("%Y-%m")

        cleaning_by_arrival_month = (
            active.groupby(["portfolio_id", "listing_id", "year_month"], dropna=False)["cleaning_fee"]
            .sum()
            .reset_index()
            .rename(columns={"cleaning_fee": "cleaning_fee_charged_arrival_month"})
        )

        df = df.merge(
            cleaning_by_arrival_month,
            on=["portfolio_id", "listing_id", "year_month"],
            how="left",
        )
    else:
        df["cleaning_fee_charged_arrival_month"] = 0.0

    # Rename booking / revenue concepts into clearer business terms.
    df["cleaning_fee_charged"] = safe_col(df, "cleaning_fee_charged_arrival_month")
    df["actual_cleaning_cost"] = safe_col(df, "cleaning_actual_cost")
    df["concierge_fee"] = safe_col(df, "concierge")
    df["electricity_usage_cost"] = safe_col(df, "electricity_usage")
    df["cleaning_margin"] = (
        df["cleaning_fee_charged"] - df["actual_cleaning_cost"]
    ).round(2)

    booking_known = [
        "cleaning_actual_cost",
        "concierge",
        "electricity_usage",
    ]

    df["other_booking_costs"] = 0.0
    for col in pick_expense_columns(df):
        if col in booking_known:
            continue

    df["booking_associated_costs_total"] = safe_col(df, "booking_associated_costs")

    df["rental_contribution"] = (
        safe_col(df, "host_payout") - df["booking_associated_costs_total"]
    ).round(2)

    # Attributable fixed cost categories.
    df["loan_payment"] = safe_col(df, "loan_payment")
    df["copro_charges"] = safe_col(df, "copro_charges")
    df["insurance"] = (
        safe_col(df, "home_insurance")
        + safe_col(df, "insurance_pno")
    ).round(2)
    df["cfe"] = safe_col(df, "cfe")
    df["property_tax"] = (
        safe_col(df, "property_tax")
        + safe_col(df, "housing_tax")
    ).round(2)
    df["electricity_subscription"] = safe_col(df, "electricity_subscription")
    df["accounting"] = safe_col(df, "accounting")
    df["garden"] = safe_col(df, "garden")
    df["software"] = safe_col(df, "software")

    known_fixed = [
        "loan_payment",
        "copro_charges",
        "home_insurance",
        "insurance_pno",
        "cfe",
        "property_tax",
        "housing_tax",
        "electricity_subscription",
        "accounting",
        "garden",
        "software",
    ]

    fixed_allocated = safe_col(df, "fixed_allocated_costs")
    known_fixed_total = sum(safe_col(df, col) for col in known_fixed)
    df["other_attributable_fixed_costs"] = (
        fixed_allocated - known_fixed_total
    ).round(2)

    # Avoid ugly -0.00 effects.
    df.loc[df["other_attributable_fixed_costs"].abs() < 0.01, "other_attributable_fixed_costs"] = 0.0

    df["attributable_fixed_costs_total"] = fixed_allocated.round(2)

    df["attributed_profit"] = (
        df["rental_contribution"] - df["attributable_fixed_costs_total"]
    ).round(2)

    out_cols = [
        # Identity
        "client_id",
        "portfolio_id",
        "portfolio_name",
        "listing_id",
        "listing_name",
        "year",
        "month",
        "year_month",

        # Activity
        "booked_nights",
        "available_nights",
        "occupancy_pct",
        "adr_accommodation",

        # Revenue / booking facts
        "gross_booking_value",
        "accommodation_revenue",
        "cleaning_fee_charged",
        "tourist_tax",
        "channel_commission",
        "host_payout",
        "host_payout_minus_cleaning",

        # Booking-associated costs
        "actual_cleaning_cost",
        "cleaning_margin",
        "concierge_fee",
        "electricity_usage_cost",
        "other_booking_costs",
        "booking_associated_costs_total",

        # Level 1 result
        "rental_contribution",

        # Attributable fixed costs
        "loan_payment",
        "copro_charges",
        "insurance",
        "cfe",
        "property_tax",
        "electricity_subscription",
        "accounting",
        "garden",
        "software",
        "other_attributable_fixed_costs",
        "attributable_fixed_costs_total",

        # Level 2 result
        "attributed_profit",
    ]

    out_cols = [c for c in out_cols if c in df.columns]
    out = df[out_cols].copy()

    money_cols = [
        c for c in out.columns
        if c not in {
            "client_id",
            "portfolio_id",
            "portfolio_name",
            "listing_id",
            "listing_name",
            "year",
            "month",
            "year_month",
            "booked_nights",
            "available_nights",
            "occupancy_pct",
            "adr_accommodation",
        }
    ]

    for col in money_cols:
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0).round(2)

    return out.sort_values(["portfolio_id", "listing_id", "year_month"])


def build_portfolio_month_financials() -> pd.DataFrame:
    portfolio = load_csv("portfolio_profitability.csv")

    if portfolio.empty:
        raise FileNotFoundError(
            "portfolio_profitability.csv missing or empty. Run build_portfolio_profitability first."
        )

    df = portfolio.copy()

    df["short_term_rental_contribution"] = (
        safe_col(df, "short_term_host_payout")
        - safe_col(df, "short_term_booking_associated_costs")
    ).round(2)

    df["short_term_attributed_profit"] = safe_col(df, "short_term_operating_profit")

    df["portfolio_cash_result"] = safe_col(df, "estimated_portfolio_cash_result")

    out_cols = [
        "portfolio_id",
        "year_month",

        # Short-term rental roll-up
        "short_term_host_payout",
        "short_term_accommodation_revenue",
        "short_term_cleaning_fee",
        "short_term_tourist_tax",
        "short_term_booking_associated_costs",
        "short_term_rental_contribution",
        "short_term_fixed_allocated_costs",
        "short_term_attributed_profit",

        # Long-term and non-STR units
        "long_term_rent_gross",
        "long_term_rent_adjustments",
        "long_term_rent_net",
        "fixed_costs_long_term_units",
        "fixed_costs_vacant_units",
        "unit_fixed_costs_total",

        # Final investor / portfolio result
        "portfolio_cash_result",
    ]

    out_cols = [c for c in out_cols if c in df.columns]
    out = df[out_cols].copy()

    for col in out.columns:
        if col not in {"portfolio_id", "year_month"}:
            out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0).round(2)

    return out.sort_values(["portfolio_id", "year_month"])


def main() -> None:
    listing = build_listing_month_financials()
    portfolio = build_portfolio_month_financials()

    listing_path = PROCESSED / "listing_month_financials.csv"
    portfolio_path = PROCESSED / "portfolio_month_financials.csv"

    listing.to_csv(listing_path, index=False)
    portfolio.to_csv(portfolio_path, index=False)

    print(f"Wrote listing month financials to {listing_path}")
    print(f"Wrote portfolio month financials to {portfolio_path}")

    print()
    print("Listing/month financials:")
    print(
        listing[
            [
                "portfolio_id",
                "listing_id",
                "year_month",
                "host_payout",
                "booking_associated_costs_total",
                "rental_contribution",
                "attributable_fixed_costs_total",
                "attributed_profit",
            ]
        ].to_string(index=False)
    )

    print()
    print("Portfolio/month financials:")
    print(
        portfolio[
            [
                "portfolio_id",
                "year_month",
                "short_term_rental_contribution",
                "short_term_attributed_profit",
                "long_term_rent_net",
                "fixed_costs_vacant_units",
                "portfolio_cash_result",
            ]
        ].to_string(index=False)
    )


if __name__ == "__main__":
    main()
