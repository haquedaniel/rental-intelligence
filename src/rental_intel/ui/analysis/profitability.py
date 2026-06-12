from __future__ import annotations

from datetime import date, timedelta

import pandas as pd


def _safe_sum(df: pd.DataFrame, col: str) -> float:
    if df.empty or col not in df.columns:
        return 0.0
    return float(pd.to_numeric(df[col], errors="coerce").fillna(0).sum())


def _period_months(period_start: date, period_end: date) -> tuple[str, str, list[str]]:
    start_month = period_start.strftime("%Y-%m")
    end_inclusive = period_end - timedelta(days=1)
    end_month = end_inclusive.strftime("%Y-%m")

    months = [
        str(p)
        for p in pd.period_range(start=start_month, end=end_month, freq="M")
    ]

    return start_month, end_month, months


def date_bounds_from_monthly(monthly: pd.DataFrame) -> tuple[date, date]:
    today = date.today()

    if monthly.empty or "year_month" not in monthly.columns:
        return date(today.year, 1, 1), date(today.year, 12, 31) + timedelta(days=1)

    months = sorted(
        monthly["year_month"].dropna().astype(str).str[:7].unique().tolist()
    )

    if not months:
        return date(today.year, 1, 1), date(today.year, 12, 31) + timedelta(days=1)

    first_y, first_m = [int(x) for x in months[0].split("-")]
    last_y, last_m = [int(x) for x in months[-1].split("-")]

    min_date = date(first_y, first_m, 1)

    if last_m == 12:
        max_date = date(last_y + 1, 1, 1)
    else:
        max_date = date(last_y, last_m + 1, 1)

    return min_date, max_date


def current_month_range(bounds_min: date, bounds_max: date) -> tuple[date, date]:
    today = date.today()
    start = today.replace(day=1)

    if today.month == 12:
        end = date(today.year + 1, 1, 1)
    else:
        end = date(today.year, today.month + 1, 1)

    start = max(start, bounds_min)
    end = min(end, bounds_max)

    if end <= start:
        end = min(start + timedelta(days=31), bounds_max)

    return start, end


def build_profitability_view(
    monthly: pd.DataFrame,
    floors: pd.DataFrame,
    fixed_expenses: pd.DataFrame,
    variable_costs: pd.DataFrame,
    period_start: date,
    period_end: date,
) -> dict:
    start_month, end_month, months = _period_months(period_start, period_end)

    m = monthly.copy()
    f = floors.copy()
    fixed = fixed_expenses.copy()
    variable = variable_costs.copy()

    if not m.empty and "year_month" in m.columns:
        m["year_month_norm"] = m["year_month"].astype(str).str[:7]
        period_monthly = m[m["year_month_norm"].isin(months)].copy()
    else:
        period_monthly = pd.DataFrame()

    gross = _safe_sum(period_monthly, "host_payout")
    accommodation = _safe_sum(period_monthly, "accommodation_revenue")
    cleaning_charged = _safe_sum(period_monthly, "cleaning_fee_charged")
    after_variables = _safe_sum(period_monthly, "rental_contribution")
    after_fixed = _safe_sum(period_monthly, "attributed_profit")

    if after_fixed == 0 and "estimated_operating_profit" in period_monthly.columns:
        after_fixed = _safe_sum(period_monthly, "estimated_operating_profit")

    variable_cost_total = gross - after_variables
    fixed_cost_total = after_variables - after_fixed

    margin_after_fixed = after_fixed / gross * 100 if gross else None
    margin_after_variables = after_variables / gross * 100 if gross else None

    listing_rows = []
    if not period_monthly.empty:
        agg = {
            "gross": ("host_payout", "sum"),
            "accommodation": ("accommodation_revenue", "sum"),
            "after_variables": ("rental_contribution", "sum"),
            "after_fixed": ("attributed_profit", "sum"),
            "booked_nights": ("booked_nights", "sum"),
            "available_nights": ("available_nights", "sum"),
            "occupancy_pct": ("occupancy_pct", "mean"),
        }

        available_agg = {
            k: v for k, v in agg.items() if v[0] in period_monthly.columns
        }

        listing_summary = (
            period_monthly.groupby(["listing_id", "listing_name"], dropna=False)
            .agg(**available_agg)
            .reset_index()
        )

        listing_summary["margin_after_fixed"] = listing_summary.apply(
            lambda r: (r["after_fixed"] / r["gross"] * 100)
            if r.get("gross", 0)
            else None,
            axis=1,
        )

        listing_rows = listing_summary.sort_values(
            "after_fixed", ascending=False
        ).to_dict("records")

    cost_rows = []

    if not period_monthly.empty:
        cost_cols = [
            "actual_cleaning_cost",
            "concierge_fee",
            "electricity_usage_cost",
            "other_booking_costs",
            "booking_associated_costs_total",
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
        ]

        labels = {
            "actual_cleaning_cost": "Ménage réel",
            "concierge_fee": "Conciergerie",
            "electricity_usage_cost": "Électricité usage",
            "other_booking_costs": "Autres coûts réservation",
            "booking_associated_costs_total": "Variables total",
            "loan_payment": "Emprunt",
            "copro_charges": "Charges copro",
            "insurance": "Assurance",
            "cfe": "CFE",
            "property_tax": "Taxe foncière",
            "electricity_subscription": "Abonnement électricité",
            "accounting": "Comptabilité",
            "garden": "Jardin",
            "software": "Logiciel",
            "other_attributable_fixed_costs": "Autres fixes",
        }

        for col in cost_cols:
            value = _safe_sum(period_monthly, col)
            if value:
                family = "Variable" if col in [
                    "actual_cleaning_cost",
                    "concierge_fee",
                    "electricity_usage_cost",
                    "other_booking_costs",
                    "booking_associated_costs_total",
                ] else "Fixe"

                cost_rows.append(
                    {
                        "category": labels.get(col, col),
                        "family": family,
                        "amount": value,
                    }
                )

    cost_breakdown = pd.DataFrame(cost_rows).sort_values(
        "amount", ascending=False
    ) if cost_rows else pd.DataFrame(columns=["category", "family", "amount"])

    if not f.empty and "year_month" in f.columns:
        f["year_month_norm"] = f["year_month"].astype(str).str[:7]
        floors_period = f[f["year_month_norm"].isin(months)].copy()
    else:
        floors_period = pd.DataFrame()

    trend = pd.DataFrame()
    if not m.empty:
        trend = (
            m.groupby("year_month", dropna=False)
            .agg(
                gross=("host_payout", "sum"),
                after_variables=("rental_contribution", "sum"),
                after_fixed=("attributed_profit", "sum"),
            )
            .reset_index()
            .sort_values("year_month")
        )

    return {
        "period_label": start_month if start_month == end_month else f"{start_month} → {end_month}",
        "summary": {
            "gross": gross,
            "accommodation": accommodation,
            "cleaning_charged": cleaning_charged,
            "after_variables": after_variables,
            "after_fixed": after_fixed,
            "variable_cost_total": variable_cost_total,
            "fixed_cost_total": fixed_cost_total,
            "margin_after_variables": margin_after_variables,
            "margin_after_fixed": margin_after_fixed,
        },
        "listing_rows": listing_rows,
        "cost_breakdown": cost_breakdown,
        "floors": floors_period,
        "trend": trend,
        "period_monthly": period_monthly,
    }


def build_portfolio_global_view(
    portfolio_monthly: pd.DataFrame,
    long_term_income: pd.DataFrame,
    unit_fixed_costs: pd.DataFrame,
    period_start: date,
    period_end: date,
) -> dict:
    start_month, end_month, months = _period_months(period_start, period_end)

    p = portfolio_monthly.copy()
    lti = long_term_income.copy()
    ufc = unit_fixed_costs.copy()

    if not p.empty and "year_month" in p.columns:
        p["year_month_norm"] = p["year_month"].astype(str).str[:7]
        p_period = p[p["year_month_norm"].isin(months)].copy()
    else:
        p_period = pd.DataFrame()

    if not lti.empty and "year_month" in lti.columns:
        lti["year_month_norm"] = lti["year_month"].astype(str).str[:7]
        lti_period = lti[lti["year_month_norm"].isin(months)].copy()
    else:
        lti_period = pd.DataFrame()

    if not ufc.empty and "year_month" in ufc.columns:
        ufc["year_month_norm"] = ufc["year_month"].astype(str).str[:7]
        ufc_period = ufc[ufc["year_month_norm"].isin(months)].copy()
    else:
        ufc_period = pd.DataFrame()

    short_term_host_payout = _safe_sum(p_period, "short_term_host_payout")
    short_term_contribution = _safe_sum(p_period, "short_term_rental_contribution")
    short_term_profit = _safe_sum(p_period, "short_term_attributed_profit")

    long_term_rent_gross = _safe_sum(p_period, "long_term_rent_gross")
    long_term_rent_net = _safe_sum(p_period, "long_term_rent_net")

    if long_term_rent_gross == 0:
        long_term_rent_gross = _safe_sum(lti_period, "amount")
    if long_term_rent_net == 0:
        long_term_rent_net = long_term_rent_gross

    fixed_costs_long_term_units = _safe_sum(p_period, "fixed_costs_long_term_units")
    fixed_costs_vacant_units = _safe_sum(p_period, "fixed_costs_vacant_units")
    unit_fixed_costs_total = _safe_sum(p_period, "unit_fixed_costs_total")
    portfolio_cash_result = _safe_sum(p_period, "portfolio_cash_result")

    if portfolio_cash_result == 0:
        portfolio_cash_result = (
            short_term_profit
            + long_term_rent_net
            - fixed_costs_long_term_units
            - fixed_costs_vacant_units
        )

    portfolio_rows = []

    if not p_period.empty:
        group = (
            p_period.groupby("portfolio_id", dropna=False)
            .agg(
                short_term_host_payout=("short_term_host_payout", "sum"),
                short_term_profit=("short_term_attributed_profit", "sum"),
                long_term_rent_net=("long_term_rent_net", "sum"),
                fixed_costs_long_term_units=("fixed_costs_long_term_units", "sum"),
                fixed_costs_vacant_units=("fixed_costs_vacant_units", "sum"),
                unit_fixed_costs_total=("unit_fixed_costs_total", "sum"),
                portfolio_cash_result=("portfolio_cash_result", "sum"),
            )
            .reset_index()
        )

        portfolio_rows = group.sort_values(
            "portfolio_cash_result", ascending=False
        ).to_dict("records")

    unit_cost_rows = []

    if not ufc_period.empty:
        unit_group = (
            ufc_period.groupby(["portfolio_id", "unit_id", "unit_type"], dropna=False)
            .agg(
                cost=("expense_amount", "sum"),
            )
            .reset_index()
            .sort_values("cost", ascending=False)
        )
        unit_cost_rows = unit_group.to_dict("records")

    long_term_rows = []

    if not lti_period.empty:
        rent_group = (
            lti_period.groupby(["portfolio_id", "unit_id"], dropna=False)
            .agg(
                rent=("amount", "sum"),
            )
            .reset_index()
            .sort_values("rent", ascending=False)
        )
        long_term_rows = rent_group.to_dict("records")

    trend = pd.DataFrame()

    if not p.empty and "year_month" in p.columns:
        trend = (
            p.groupby("year_month", dropna=False)
            .agg(
                short_term_host_payout=("short_term_host_payout", "sum"),
                short_term_profit=("short_term_attributed_profit", "sum"),
                long_term_rent_net=("long_term_rent_net", "sum"),
                fixed_costs_vacant_units=("fixed_costs_vacant_units", "sum"),
                portfolio_cash_result=("portfolio_cash_result", "sum"),
            )
            .reset_index()
            .sort_values("year_month")
        )

    return {
        "period_label": start_month if start_month == end_month else f"{start_month} → {end_month}",
        "summary": {
            "short_term_host_payout": short_term_host_payout,
            "short_term_contribution": short_term_contribution,
            "short_term_profit": short_term_profit,
            "long_term_rent_gross": long_term_rent_gross,
            "long_term_rent_net": long_term_rent_net,
            "fixed_costs_long_term_units": fixed_costs_long_term_units,
            "fixed_costs_vacant_units": fixed_costs_vacant_units,
            "unit_fixed_costs_total": unit_fixed_costs_total,
            "portfolio_cash_result": portfolio_cash_result,
        },
        "portfolio_rows": portfolio_rows,
        "unit_cost_rows": unit_cost_rows,
        "long_term_rows": long_term_rows,
        "trend": trend,
        "period_portfolio_monthly": p_period,
    }