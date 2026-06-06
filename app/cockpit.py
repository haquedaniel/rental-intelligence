from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import plotly.express as px
import streamlit as st


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "outputs" / "processed"


st.set_page_config(
    page_title="Rental Intelligence Cockpit",
    page_icon="🏡",
    layout="wide",
)


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
def load_csv(name: str) -> pd.DataFrame:
    path = DATA / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def money(value: Any) -> str:
    try:
        if pd.isna(value):
            return "—"
        return f"€{float(value):,.0f}".replace(",", " ")
    except Exception:
        return "—"


def money_2(value: Any) -> str:
    try:
        if pd.isna(value):
            return "—"
        return f"€{float(value):,.2f}".replace(",", " ")
    except Exception:
        return "—"


def pct(value: Any) -> str:
    try:
        if pd.isna(value):
            return "—"
        return f"{float(value):.1f}%"
    except Exception:
        return "—"


def clean_text(value: Any) -> str:
    if value is None:
        return "—"
    try:
        if pd.isna(value):
            return "—"
    except Exception:
        pass
    text = str(value)
    if text.lower() in {"nan", "none", "nat", ""}:
        return "—"
    return text


def clean_display_df(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out = out.replace({pd.NA: None})
    out = out.where(pd.notna(out), None)
    return out


def existing_cols(df: pd.DataFrame, cols: list[str]) -> list[str]:
    return [c for c in cols if c in df.columns]


def friendly_table(df: pd.DataFrame, columns: list[str], labels: dict[str, str]) -> pd.DataFrame:
    cols = existing_cols(df, columns)
    out = df[cols].copy()
    return clean_display_df(out.rename(columns={c: labels.get(c, c) for c in cols}))


def sum_col(df: pd.DataFrame, col: str) -> float:
    if df.empty or col not in df.columns:
        return 0.0
    return float(pd.to_numeric(df[col], errors="coerce").fillna(0).sum())


def add_summary_metrics(metrics: list[tuple[str, float | None, str | None]]):
    cols = st.columns(len(metrics))
    for col, (label, value, help_text) in zip(cols, metrics):
        col.metric(label, money(value) if value is not None else "—", help=help_text)


def recommendation_period(row: pd.Series) -> str:
    start = clean_text(row.get("period_start"))
    end = clean_text(row.get("period_end"))
    if end == "—":
        return start
    return f"{start} → {end}"


def gap_recommendation(row: pd.Series) -> str:
    try:
        nights = int(row.get("gap_nights") or 0)
    except Exception:
        nights = 0
    bookable = bool(row.get("bookable"))

    if not bookable and nights == 1:
        return "Consider opening as premium 1-night stay"
    if not bookable and nights in {2, 3}:
        return f"Check min-stay / restriction override for {nights} nights"
    if bookable and nights == 1:
        return "Already bookable — check premium price"
    if bookable:
        return "Already bookable"
    return "Review"


def category_label(category: Any) -> str:
    mapping = {
        "occupancy_risk": "Occupancy risk",
        "price_protection": "Revenue protection",
        "protect_price_high_demand": "Revenue protection",
        "orphan_night_premium": "Orphan-night opportunity",
        "short_gap_restriction": "Gap-fill restriction",
        "data_quality_issue": "Data quality",
    }
    key = clean_text(category)
    return mapping.get(key, key.replace("_", " ").title())


def priority_order(value: Any) -> int:
    return {"high": 1, "medium": 2, "low": 3}.get(str(value).lower(), 99)


DISPLAY_LABELS = {
    "portfolio_id": "Portfolio",
    "listing_id": "Unit",
    "year_month": "Month",
    "booked_nights": "Booked nights",
    "available_nights": "Calendar nights",
    "occupancy_pct": "Occupancy %",
    "adr_accommodation": "ADR",
    "host_payout": "Host payout",
    "cleaning_fee_charged": "Cleaning charged",
    "actual_cleaning_cost": "Actual cleaning cost",
    "concierge_fee": "Concierge fee",
    "electricity_usage_cost": "Energy Usage cost",
    "water_usage_cost": "Water usage cost",
    "booking_associated_costs_total": "Booking costs",
    "rental_contribution": "Rental contribution",
    "loan_payment": "Loan payment",
    "copro_charges": "Copro charges",
    "insurance": "Insurance",
    "cfe": "CFE",
    "property_tax": "Property tax",
    "electricity_subscription": "Electricity subscription",
    "accounting": "Accounting",
    "garden": "Garden",
    "software": "Software",
    "other_attributable_fixed_costs": "Other fixed costs",
    "attributable_fixed_costs_total": "Attributable fixed costs",
    "attributed_profit": "Attributed profit",
    "short_term_rental_contribution": "STR rental contribution",
    "short_term_fixed_allocated_costs": "STR fixed costs",
    "short_term_attributed_profit": "STR attributed profit",
    "long_term_rent_gross": "Long-term rent gross",
    "long_term_rent_adjustments": "Long-term adjustments",
    "long_term_rent_net": "Long-term rent net",
    "fixed_costs_long_term_units": "Long-term unit costs",
    "fixed_costs_vacant_units": "Vacant unit costs",
    "unit_fixed_costs_total": "Other unit fixed costs",
    "portfolio_cash_result": "Portfolio cash result",
    "horizon_days": "Horizon",
    "period_start": "From",
    "period_end": "To",
    "open_nights": "Open nights",
    "open_pct": "Open %",
    "secured_host_payout": "Secured payout",
    "gap_start": "Gap start",
    "gap_end": "Gap end",
    "gap_nights": "Nights",
    "bookable": "Bookable now?",
    "offer_price": "Offer price",
    "effective_price_per_night": "Price/night",
    "units_available": "Units available",
    "gap_recommendation": "Recommendation",
    "current_month": "Current month",
    "current_month_host_payout": "This month revenue",
    "current_month_target_host_payout": "This month target",
    "current_month_vs_target": "Vs target",
    "current_month_target_pct": "Progress %",
    "ytd_host_payout": "YTD revenue",
    "target_host_payout": "Annual target",
    "host_payout_target_pct": "Annual progress %",
    "host_payout_remaining_to_target": "Remaining to target",
    "host_payout_required_per_remaining_month": "Required/month",
    "current_month_operating_profit": "This month STR profit",
    "current_month_portfolio_cash_result": "This month cash result",
    "ytd_operating_profit": "YTD STR profit",
    "ytd_portfolio_cash_result": "YTD cash result",
    "source_booking_id": "Booking ID",
    "arrival": "Arrival",
    "departure": "Departure",
    "channel": "Channel",
    "rule_id": "Rule",
    "expense_amount": "Amount",
    "severity": "Severity",
    "category": "Category",
    "issue": "Issue",
    "affected_count": "Count",
    "details": "Details",
    "energy_usage_cost": "Energy usage",
    "variable_period_costs_total": "Variable usage costs",
    "booking_contribution": "Booking contribution",
}


# ---------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------
monthly = load_csv("monthly_metrics.csv")
forward = load_csv("forward_position.csv")
recommendations = load_csv("recommendations.csv")
gap_offers = load_csv("gap_offers.csv")
quality = load_csv("data_quality_issues.csv")

dashboard_kpis = load_csv("dashboard_kpis.csv")
cleaner_due = load_csv("cleaner_payment_due.csv")
listing_financials = load_csv("listing_month_financials.csv")
portfolio_financials = load_csv("portfolio_month_financials.csv")


st.title("🏡 Rental Intelligence Cockpit")

if listing_financials.empty:
    st.error("No listing financials found. Run build_financial_views first.")
    st.stop()


# ---------------------------------------------------------------------
# Sidebar filters
# ---------------------------------------------------------------------
st.sidebar.header("Filters")

portfolio_options = sorted(
    [x for x in listing_financials["portfolio_id"].dropna().astype(str).unique()]
)
selected_portfolios = st.sidebar.multiselect(
    "Portfolio",
    options=portfolio_options,
    default=portfolio_options,
)

filtered_listing_financials = listing_financials[
    listing_financials["portfolio_id"].astype(str).isin(selected_portfolios)
].copy()

listing_options = sorted(
    [x for x in filtered_listing_financials["listing_id"].dropna().astype(str).unique()]
)
selected_listings = st.sidebar.multiselect(
    "Unit",
    options=listing_options,
    default=listing_options,
)

filtered_listing_financials = filtered_listing_financials[
    filtered_listing_financials["listing_id"].astype(str).isin(selected_listings)
].copy()

if not portfolio_financials.empty:
    filtered_portfolio_financials = portfolio_financials[
        portfolio_financials["portfolio_id"].astype(str).isin(selected_portfolios)
    ].copy()
else:
    filtered_portfolio_financials = pd.DataFrame()

if not forward.empty:
    filtered_forward = forward[
        forward["listing_id"].astype(str).isin(selected_listings)
        & forward["portfolio_id"].astype(str).isin(selected_portfolios)
    ].copy()
    if "horizon_days" in filtered_forward.columns:
        filtered_forward["horizon_label"] = filtered_forward["horizon_days"].astype(int).astype(str) + "d"
else:
    filtered_forward = pd.DataFrame()

if not recommendations.empty:
    filtered_recs = recommendations[
        recommendations["listing_id"].astype(str).isin(selected_listings)
        & recommendations["portfolio_id"].astype(str).isin(selected_portfolios)
    ].copy()
    if not filtered_recs.empty:
        filtered_recs["priority_sort"] = filtered_recs["priority"].map(priority_order)
        filtered_recs = filtered_recs.sort_values(["priority_sort", "category", "listing_id", "period_start"])
else:
    filtered_recs = pd.DataFrame()

if not gap_offers.empty:
    filtered_gaps = gap_offers[
        gap_offers["listing_id"].astype(str).isin(selected_listings)
        & gap_offers["portfolio_id"].astype(str).isin(selected_portfolios)
    ].copy()
    if not filtered_gaps.empty:
        filtered_gaps["gap_recommendation"] = filtered_gaps.apply(gap_recommendation, axis=1)
else:
    filtered_gaps = pd.DataFrame()


# ---------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------
tabs = st.tabs(
    [
        "Home",
        "Actions",
        "Forward position",
        "Rental performance",
        "Unit profitability",
        "Portfolio cashflow",
        "Gaps",
        "Data quality",
    ]
)


# ---------------------------------------------------------------------
# Home tab
# ---------------------------------------------------------------------
with tabs[0]:
    st.subheader("Executive summary")
    st.caption(
        "A management view of the month, the annual target, recommended actions, and the trust status of the data."
    )

    if dashboard_kpis.empty:
        st.warning("No dashboard KPI data found. Run build_dashboard_kpis first.")
    else:
        kpi_view = dashboard_kpis[
            dashboard_kpis["portfolio_id"].astype(str).isin(selected_portfolios)
        ].copy()

        current_revenue = sum_col(kpi_view, "current_month_host_payout")
        current_month_target = sum_col(kpi_view, "current_month_target_host_payout")
        current_vs_target = current_revenue - current_month_target
        current_target_pct = (
            current_revenue / current_month_target * 100
            if current_month_target
            else None
        )

        ytd_revenue = sum_col(kpi_view, "ytd_host_payout")
        annual_target = sum_col(kpi_view, "target_host_payout")
        remaining_to_target = annual_target - ytd_revenue if annual_target else None
        annual_target_pct = (
            ytd_revenue / annual_target * 100
            if annual_target
            else None
        )

        current_profit = sum_col(kpi_view, "current_month_operating_profit")
        current_cash = sum_col(kpi_view, "current_month_portfolio_cash_result")
        required_per_remaining_month = sum_col(kpi_view, "host_payout_required_per_remaining_month")

        cleaner_total = (
            cleaner_due[
                cleaner_due["portfolio_id"].astype(str).isin(selected_portfolios)
                & cleaner_due["listing_id"].astype(str).isin(selected_listings)
            ]["expense_amount"].sum()
            if not cleaner_due.empty
            else 0
        )

        st.markdown("### This month")
        c1, c2, c3, c4 = st.columns(4)
        c1.metric(
            "Revenue",
            money(current_revenue),
            delta=money(current_vs_target) if current_month_target else None,
            help="Host payout for the current month, compared with the monthly target.",
        )
        c2.metric(
            "Target progress",
            pct(current_target_pct),
            help="This month revenue as a percentage of this month target.",
        )
        c3.metric(
            "STR attributed profit",
            money(current_profit),
            help="Short-term rental profit after booking-associated costs and attributable fixed costs.",
        )
        c4.metric(
            "Portfolio cash result",
            money(current_cash),
            help="Whole portfolio cash result, including long-term rents and vacant-unit costs.",
        )

        st.markdown("### Year target")
        c5, c6, c7, c8 = st.columns(4)
        c5.metric(
            "YTD revenue",
            money(ytd_revenue),
            delta=pct(annual_target_pct),
            help="Year-to-date host payout compared with the annual target.",
        )
        c6.metric("Annual target", money(annual_target))
        c7.metric("Remaining to target", money(remaining_to_target))
        c8.metric(
            "Cleaner to pay",
            money(cleaner_total),
            help="Cleaning actual cost for bookings arriving this month.",
        )

        if required_per_remaining_month:
            st.caption(
                f"Required average revenue per remaining month to hit annual target: "
                f"**{money(required_per_remaining_month)}**"
            )

        st.markdown("### Target tracking by portfolio")
        target_cols = [
            "portfolio_id",
            "current_month",
            "current_month_host_payout",
            "current_month_target_host_payout",
            "current_month_vs_target",
            "current_month_target_pct",
            "ytd_host_payout",
            "target_host_payout",
            "host_payout_target_pct",
            "host_payout_remaining_to_target",
            "host_payout_required_per_remaining_month",
            "current_month_operating_profit",
            "current_month_portfolio_cash_result",
        ]
        st.dataframe(
            friendly_table(kpi_view, target_cols, DISPLAY_LABELS),
            use_container_width=True,
            hide_index=True,
        )

    st.markdown("### What needs attention")
    if filtered_recs.empty:
        st.success("No active recommendations for the selected units.")
    else:
        for _, row in filtered_recs.head(3).iterrows():
            with st.container(border=True):
                st.markdown(
                    f"**{str(row.get('priority', '')).title()} — {category_label(row.get('category'))} — {clean_text(row.get('listing_id'))}**"
                )
                st.write(clean_text(row.get("problem")))
                st.caption(f"Evidence: {clean_text(row.get('evidence'))}")
                st.write(f"**Suggested action:** {clean_text(row.get('suggested_action'))}")

    st.markdown("### Cleaner payment detail")
    if cleaner_due.empty:
        st.info("No cleaner payment due for the current month.")
    else:
        cleaner_view = cleaner_due[
            cleaner_due["portfolio_id"].astype(str).isin(selected_portfolios)
            & cleaner_due["listing_id"].astype(str).isin(selected_listings)
        ].copy()
        if cleaner_view.empty:
            st.info("No cleaner payment due for the selected filters.")
        else:
            cleaner_cols = [
                "portfolio_id",
                "listing_id",
                "source_booking_id",
                "arrival",
                "departure",
                "channel",
                "rule_id",
                "expense_amount",
            ]
            st.dataframe(
                friendly_table(cleaner_view, cleaner_cols, DISPLAY_LABELS),
                use_container_width=True,
                hide_index=True,
            )

    st.markdown("### Data quality status")
    if quality.empty:
        st.success("Data quality: no issues detected.")
    else:
        q = quality.copy()
        issue_count = len(q)
        high_count = int((q["severity"].astype(str).str.lower() == "high").sum()) if "severity" in q.columns else 0
        medium_count = int((q["severity"].astype(str).str.lower() == "medium").sum()) if "severity" in q.columns else 0
        if high_count:
            st.error(f"Data quality: {high_count} high issue(s), {medium_count} medium issue(s), {issue_count} total.")
        elif medium_count:
            st.warning(f"Data quality: {medium_count} medium issue(s), {issue_count} total.")
        else:
            st.info(f"Data quality: {issue_count} low-level issue(s).")


# ---------------------------------------------------------------------
# Actions tab
# ---------------------------------------------------------------------
with tabs[1]:
    st.subheader("Actions")
    st.caption(
        "Recommendations are grouped by business purpose. For now actions are manual; future versions can prepare or apply Beds24 changes."
    )

    if filtered_recs.empty:
        st.success("No current recommendations for the selected units.")
    else:
        priorities = sorted(filtered_recs["priority"].dropna().astype(str).unique(), key=priority_order)
        priority_filter = st.multiselect("Priority", options=priorities, default=priorities)
        recs_view = filtered_recs[filtered_recs["priority"].astype(str).isin(priority_filter)].copy()

        recs_view["action_group"] = recs_view["category"].apply(category_label)

        for group, group_df in recs_view.groupby("action_group", sort=False):
            st.markdown(f"### {group}")
            for _, row in group_df.iterrows():
                with st.container(border=True):
                    st.markdown(
                        f"#### {str(row.get('priority', '')).title()} — {clean_text(row.get('listing_id'))}"
                    )
                    st.write(f"**Period:** {recommendation_period(row)}")
                    st.write(f"**Problem:** {clean_text(row.get('problem'))}")
                    st.write(f"**Evidence:** {clean_text(row.get('evidence'))}")
                    st.write(f"**Suggested action:** {clean_text(row.get('suggested_action'))}")
                    if pd.notna(row.get("suggested_price")):
                        st.write(f"**Suggested price:** {money(row.get('suggested_price'))}")

                    action_col1, action_col2, action_col3 = st.columns([1, 1, 4])
                    with action_col1:
                        st.button("Mark reviewed", key=f"review_{row.get('recommendation_id', row.name)}", disabled=True)
                    with action_col2:
                        st.button("Prepare action", key=f"prepare_{row.get('recommendation_id', row.name)}", disabled=True)
                    with action_col3:
                        st.caption("Buttons are placeholders until action logging / Beds24 write-back is added.")


# ---------------------------------------------------------------------
# Forward position tab
# ---------------------------------------------------------------------
with tabs[2]:
    st.subheader("Forward position")
    st.caption("What is already booked, what is still open, and where are we exposed over the next 14/30/60/90 days.")

    if filtered_forward.empty:
        st.info("No forward position data found.")
    else:
        next_30 = filtered_forward[filtered_forward["horizon_days"].astype(int) == 30].copy()
        if not next_30.empty:
            st.markdown("### Next 30 days snapshot")
            summary_lines = []
            for _, row in next_30.iterrows():
                booked = int(row.get("booked_nights", 0))
                open_nights = int(row.get("open_nights", 0))
                occ = row.get("occupancy_pct", 0)
                listing = clean_text(row.get("listing_id"))
                if occ < 20:
                    tone = "urgent"
                elif occ < 40:
                    tone = "watch"
                else:
                    tone = "ok"
                summary_lines.append(f"**{listing}**: {booked} booked / {open_nights} open — {pct(occ)} occupancy ({tone}).")
            st.info("  \n".join(summary_lines))

        col1, col2 = st.columns(2)
        with col1:
            fig = px.bar(
                filtered_forward,
                x="horizon_label" if "horizon_label" in filtered_forward.columns else "horizon_days",
                y="booked_nights",
                color="listing_id",
                barmode="group",
                title="Booked nights by horizon",
            )
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            fig = px.bar(
                filtered_forward,
                x="horizon_label" if "horizon_label" in filtered_forward.columns else "horizon_days",
                y="open_nights",
                color="listing_id",
                barmode="group",
                title="Open nights by horizon",
            )
            st.plotly_chart(fig, use_container_width=True)

        forward_cols = [
            "portfolio_id",
            "listing_id",
            "horizon_label" if "horizon_label" in filtered_forward.columns else "horizon_days",
            "period_start",
            "period_end",
            "booked_nights",
            "open_nights",
            "occupancy_pct",
            "open_pct",
            "secured_host_payout",
        ]
        labels = DISPLAY_LABELS | {"horizon_label": "Horizon"}
        st.dataframe(
            friendly_table(filtered_forward, forward_cols, labels),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Rental performance tab
# ---------------------------------------------------------------------
with tabs[3]:
    st.subheader("Rental performance — before attributable fixed costs")
    st.caption(
        "Revenue from bookings, minus costs caused by bookings such as actual cleaning cost, concierge fees and usage costs. This shows whether the rental activity itself is performing."
    )

    metrics = [
        ("Host payout", sum_col(filtered_listing_financials, "host_payout"), "Money expected after OTA/platform commission."),
        ("Booking costs", sum_col(filtered_listing_financials, "booking_associated_costs_total"), "Costs caused by bookings: cleaning actual cost, concierge, usage costs."),
        ("Rental contribution", sum_col(filtered_listing_financials, "rental_contribution"), "Host payout minus booking-associated costs."),
        ("Cleaner charged to guest", sum_col(filtered_listing_financials, "cleaning_fee_charged"), "Cleaning fee collected from guests."),
    ]
    add_summary_metrics(metrics)

    col1, col2 = st.columns(2)
    with col1:
        fig = px.bar(
            filtered_listing_financials,
            x="year_month",
            y="rental_contribution",
            color="listing_id",
            barmode="group",
            title="Rental contribution by unit/month",
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        fig = px.bar(
            filtered_listing_financials,
            x="year_month",
            y="booking_associated_costs_total",
            color="listing_id",
            barmode="group",
            title="Booking-associated costs",
        )
        st.plotly_chart(fig, use_container_width=True)

    rental_cols = [
        "portfolio_id",
        "listing_id",
        "year_month",
        "booked_nights",
        "occupancy_pct",
        "adr_accommodation",
        "host_payout",
        "cleaning_fee_charged",
        "actual_cleaning_cost",
        "cleaning_margin",
        "concierge_fee",
        "booking_associated_costs_total",
        "booking_contribution",
        "energy_usage_cost",
        "water_usage_cost",
        "variable_period_costs_total",
        "rental_contribution",
    ]
    st.dataframe(
        friendly_table(filtered_listing_financials, rental_cols, DISPLAY_LABELS),
        use_container_width=True,
        hide_index=True,
    )


# ---------------------------------------------------------------------
# Unit profitability tab
# ---------------------------------------------------------------------
with tabs[4]:
    st.subheader("Unit profitability — after attributable fixed costs")
    st.caption(
        "Adds ownership costs linked to each unit, such as loan payments, insurance, copro charges, taxes, subscriptions and accounting."
    )

    metrics = [
        ("Rental contribution", sum_col(filtered_listing_financials, "rental_contribution"), "Before attributable fixed costs."),
        ("Attributable fixed costs", sum_col(filtered_listing_financials, "attributable_fixed_costs_total"), "Fixed costs assigned to selected units."),
        ("Attributed profit", sum_col(filtered_listing_financials, "attributed_profit"), "Rental contribution minus attributable fixed costs."),
    ]
    add_summary_metrics(metrics)

    col1, col2 = st.columns(2)
    with col1:
        fig = px.bar(
            filtered_listing_financials,
            x="year_month",
            y="attributed_profit",
            color="listing_id",
            barmode="group",
            title="Attributed profit by unit/month",
        )
        st.plotly_chart(fig, use_container_width=True)

    fixed_breakdown_cols = existing_cols(
        filtered_listing_financials,
        [
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
        ],
    )
    with col2:
        if fixed_breakdown_cols:
            fixed_long = filtered_listing_financials.melt(
                id_vars=["portfolio_id", "listing_id", "year_month"],
                value_vars=fixed_breakdown_cols,
                var_name="Cost type",
                value_name="Amount",
            )
            fixed_long = fixed_long[pd.to_numeric(fixed_long["Amount"], errors="coerce").fillna(0) != 0]
            fixed_long["Cost type"] = fixed_long["Cost type"].map(lambda c: DISPLAY_LABELS.get(c, c))
            fig = px.bar(
                fixed_long,
                x="year_month",
                y="Amount",
                color="Cost type",
                title="Fixed cost breakdown",
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No fixed cost breakdown available.")

    profit_cols = [
        "portfolio_id",
        "listing_id",
        "year_month",
        "rental_contribution",
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
        "attributed_profit",
    ]
    st.dataframe(
        friendly_table(filtered_listing_financials, profit_cols, DISPLAY_LABELS),
        use_container_width=True,
        hide_index=True,
    )


# ---------------------------------------------------------------------
# Portfolio cashflow tab
# ---------------------------------------------------------------------
with tabs[5]:
    st.subheader("Portfolio cashflow — including long-term and vacant units")
    st.caption(
        "Whole-property view. It starts from short-term attributed profit, then adds long-term rents and deducts costs from long-term or vacant units."
    )

    if filtered_portfolio_financials.empty:
        st.warning("No portfolio financials found. Run build_financial_views first.")
    else:
        metrics = [
            ("STR attributed profit", sum_col(filtered_portfolio_financials, "short_term_attributed_profit"), "Profit from short-term units after their attributable fixed costs."),
            ("Long-term rent net", sum_col(filtered_portfolio_financials, "long_term_rent_net"), "Long-term rent after rent adjustments such as included electricity."),
            ("Vacant unit costs", sum_col(filtered_portfolio_financials, "fixed_costs_vacant_units"), "Fixed costs of units with no rental income."),
            ("Portfolio cash result", sum_col(filtered_portfolio_financials, "portfolio_cash_result"), "Whole portfolio / building cash result."),
        ]
        add_summary_metrics(metrics)

        col1, col2 = st.columns(2)
        with col1:
            fig = px.bar(
                filtered_portfolio_financials,
                x="year_month",
                y="portfolio_cash_result",
                color="portfolio_id",
                barmode="group",
                title="Portfolio cash result",
            )
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            portfolio_components = filtered_portfolio_financials.melt(
                id_vars=["portfolio_id", "year_month"],
                value_vars=existing_cols(
                    filtered_portfolio_financials,
                    [
                        "short_term_attributed_profit",
                        "long_term_rent_net",
                        "fixed_costs_long_term_units",
                        "fixed_costs_vacant_units",
                    ],
                ),
                var_name="Component",
                value_name="Amount",
            )
            portfolio_components["Component"] = portfolio_components["Component"].map(
                lambda c: DISPLAY_LABELS.get(c, c)
            )
            fig = px.bar(
                portfolio_components,
                x="year_month",
                y="Amount",
                color="Component",
                title="Portfolio cashflow components",
            )
            st.plotly_chart(fig, use_container_width=True)

        portfolio_cols = [
            "portfolio_id",
            "year_month",
            "short_term_rental_contribution",
            "short_term_fixed_allocated_costs",
            "short_term_attributed_profit",
            "long_term_rent_gross",
            "long_term_rent_adjustments",
            "long_term_rent_net",
            "fixed_costs_long_term_units",
            "fixed_costs_vacant_units",
            "unit_fixed_costs_total",
            "portfolio_cash_result",
        ]
        st.dataframe(
            friendly_table(filtered_portfolio_financials, portfolio_cols, DISPLAY_LABELS),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Gaps tab
# ---------------------------------------------------------------------
with tabs[6]:
    st.subheader("Short gaps and orphan nights")
    st.caption(
        "Small openings in the calendar. The strongest opportunities are gaps that are available but not currently bookable, or one-night gaps that could be opened at a premium."
    )

    if filtered_gaps.empty:
        st.info("No targeted gap offer data found.")
    else:
        gap_total = len(filtered_gaps)
        blocked = int((filtered_gaps["bookable"] == False).sum()) if "bookable" in filtered_gaps.columns else 0
        bookable = gap_total - blocked
        c1, c2, c3 = st.columns(3)
        c1.metric("Short gaps", str(gap_total))
        c2.metric("Bookable now", str(bookable))
        c3.metric("Need review", str(blocked))

        col1, col2 = st.columns(2)
        with col1:
            fig = px.bar(
                filtered_gaps,
                x="gap_start",
                y="effective_price_per_night",
                color="listing_id",
                title="Gap price per night",
            )
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            gap_status = (
                filtered_gaps.groupby(["listing_id", "bookable"])
                .size()
                .reset_index(name="count")
            )
            fig = px.bar(
                gap_status,
                x="listing_id",
                y="count",
                color="bookable",
                title="Gap bookability",
            )
            st.plotly_chart(fig, use_container_width=True)

        gap_cols = [
            "portfolio_id",
            "listing_id",
            "gap_start",
            "gap_end",
            "gap_nights",
            "bookable",
            "offer_price",
            "effective_price_per_night",
            "units_available",
            "gap_recommendation",
        ]
        st.dataframe(
            friendly_table(filtered_gaps, gap_cols, DISPLAY_LABELS),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Data quality tab
# ---------------------------------------------------------------------
with tabs[7]:
    st.subheader("Data quality")
    st.caption("Trust layer for the cockpit: mapping issues, parser warnings, overlaps, missing data and other checks.")

    if quality.empty:
        st.success("No data quality issues detected.")
    else:
        q = quality.copy()
        high_count = int((q["severity"].astype(str).str.lower() == "high").sum()) if "severity" in q.columns else 0
        medium_count = int((q["severity"].astype(str).str.lower() == "medium").sum()) if "severity" in q.columns else 0
        low_count = int((q["severity"].astype(str).str.lower() == "low").sum()) if "severity" in q.columns else 0
        c1, c2, c3 = st.columns(3)
        c1.metric("High issues", str(high_count))
        c2.metric("Medium issues", str(medium_count))
        c3.metric("Low issues", str(low_count))

        quality_cols = ["severity", "category", "issue", "affected_count", "details"]
        st.dataframe(
            friendly_table(q, quality_cols, DISPLAY_LABELS),
            use_container_width=True,
            hide_index=True,
        )
