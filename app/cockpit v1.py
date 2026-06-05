from __future__ import annotations

from pathlib import Path

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


def load_csv(name: str) -> pd.DataFrame:
    path = DATA / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def money(value) -> str:
    try:
        if value is None or pd.isna(value):
            return "—"
        return f"€{float(value):,.0f}".replace(",", " ")
    except Exception:
        return "—"


def pct(value) -> str:
    try:
        if value is None or pd.isna(value):
            return "—"
        return f"{float(value):.1f}%"
    except Exception:
        return "—"


def clean_display_df(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out = out.replace({pd.NA: None})
    out = out.replace({"nan": None, "NaN": None})
    return out


def existing_cols(df: pd.DataFrame, cols: list[str]) -> list[str]:
    return [c for c in cols if c in df.columns]


def empty_chart_warning(label: str) -> None:
    st.info(f"No {label} data available for the selected filters.")


# ---------------------------------------------------------------------
# Data loads
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
    "Listing",
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
else:
    filtered_forward = pd.DataFrame()

if not recommendations.empty:
    filtered_recs = recommendations[
        recommendations["listing_id"].astype(str).isin(selected_listings)
        & recommendations["portfolio_id"].astype(str).isin(selected_portfolios)
    ].copy()
else:
    filtered_recs = pd.DataFrame()

if not gap_offers.empty:
    filtered_gaps = gap_offers[
        gap_offers["listing_id"].astype(str).isin(selected_listings)
        & gap_offers["portfolio_id"].astype(str).isin(selected_portfolios)
    ].copy()
else:
    filtered_gaps = pd.DataFrame()


tabs = st.tabs(
    [
        "Home",
        "Rental business",
        "Apartment profit",
        "Portfolio cash",
        "Forward position",
        "Recommendations",
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
        "The dashboard separates the short-term rental business, the fixed costs attributable "
        "to each apartment, and the full portfolio cash view including long-term rentals and vacant units."
    )

    if dashboard_kpis.empty:
        st.warning("No dashboard KPI data found. Run build_dashboard_kpis first.")
    else:
        kpi_view = dashboard_kpis[
            dashboard_kpis["portfolio_id"].astype(str).isin(selected_portfolios)
        ].copy()

        current_revenue = kpi_view["current_month_host_payout"].sum()
        current_month_target = kpi_view["current_month_target_host_payout"].sum()
        current_vs_target = current_revenue - current_month_target
        current_target_pct = (
            current_revenue / current_month_target * 100
            if current_month_target
            else None
        )

        ytd_revenue = kpi_view["ytd_host_payout"].sum()
        annual_target = kpi_view["target_host_payout"].sum()
        remaining_to_target = annual_target - ytd_revenue if annual_target else None
        annual_target_pct = (
            ytd_revenue / annual_target * 100
            if annual_target
            else None
        )

        current_profit = kpi_view["current_month_operating_profit"].sum()
        current_cash = kpi_view["current_month_portfolio_cash_result"].sum()

        cleaner_total = (
            cleaner_due[
                cleaner_due["portfolio_id"].astype(str).isin(selected_portfolios)
                & cleaner_due["listing_id"].astype(str).isin(selected_listings)
            ]["expense_amount"].sum()
            if not cleaner_due.empty
            else 0
        )

        c1, c2, c3, c4 = st.columns(4)
        c1.metric(
            "This month revenue",
            money(current_revenue),
            delta=money(current_vs_target) if current_month_target else None,
            help="Host payout for the current month, compared with monthly target.",
        )
        c2.metric(
            "This month target",
            money(current_month_target),
            delta=f"{current_target_pct:.1f}%" if current_target_pct is not None else None,
            help="Combined target for the selected portfolios.",
        )
        c3.metric(
            "YTD revenue",
            money(ytd_revenue),
            delta=f"{annual_target_pct:.1f}%" if annual_target_pct is not None else None,
            help="Year-to-date host payout versus annual target.",
        )
        c4.metric(
            "Remaining to annual target",
            money(remaining_to_target),
            help="Annual target less year-to-date host payout.",
        )

        c5, c6, c7 = st.columns(3)
        c5.metric(
            "This month STR attributed profit",
            money(current_profit),
            help="Short-term rental profit after booking-associated and attributable fixed costs.",
        )
        c6.metric(
            "This month portfolio cash result",
            money(current_cash),
            help="Portfolio cash result including long-term rents and vacant-unit costs.",
        )
        c7.metric(
            "Cleaner to pay this month",
            money(cleaner_total),
            help="Cleaning actual cost for bookings arriving this month.",
        )

        required_per_remaining_month = (
            kpi_view["host_payout_required_per_remaining_month"].sum()
            if "host_payout_required_per_remaining_month" in kpi_view.columns
            else None
        )
        if required_per_remaining_month is not None:
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
        target_cols = existing_cols(kpi_view, target_cols)

        st.dataframe(
            clean_display_df(kpi_view[target_cols]),
            use_container_width=True,
            hide_index=True,
        )

    st.markdown("### Top recommendations")

    if filtered_recs.empty:
        st.success("No active recommendations for selected listings.")
    else:
        for _, row in filtered_recs.head(5).iterrows():
            with st.container(border=True):
                st.markdown(
                    f"**{str(row.get('priority', '')).title()} — {row.get('category')} — {row.get('listing_id')}**"
                )
                st.write(f"{row.get('problem')}")
                st.caption(f"Evidence: {row.get('evidence')}")
                st.write(f"**Suggested action:** {row.get('suggested_action')}")

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
            cleaner_cols = existing_cols(cleaner_view, cleaner_cols)

            st.dataframe(
                clean_display_df(cleaner_view[cleaner_cols]),
                use_container_width=True,
                hide_index=True,
            )


# ---------------------------------------------------------------------
# Rental business tab
# ---------------------------------------------------------------------
with tabs[1]:
    st.subheader("Rental business — before attributable fixed costs")

    st.caption(
        "Level 1. This shows the short-term rental operation itself: host payout minus booking-associated costs "
        "such as actual cleaning cost, concierge fee and usage costs. It excludes mortgage, copro, insurance, tax and other fixed ownership costs."
    )

    if filtered_listing_financials.empty:
        empty_chart_warning("rental business")
    else:
        col1, col2 = st.columns(2)

        with col1:
            fig = px.bar(
                filtered_listing_financials,
                x="year_month",
                y="rental_contribution",
                color="listing_id",
                barmode="group",
                title="Rental contribution by listing/month",
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
            "concierge_fee",
            "electricity_usage_cost",
            "booking_associated_costs_total",
            "rental_contribution",
        ]
        rental_cols = existing_cols(filtered_listing_financials, rental_cols)

        st.dataframe(
            clean_display_df(filtered_listing_financials[rental_cols]),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Apartment profit tab
# ---------------------------------------------------------------------
with tabs[2]:
    st.subheader("Apartment profitability — after attributable fixed costs")

    st.caption(
        "Level 2. This adds fixed costs that can be attributed to the apartment: loan payment, copro charges, insurance, CFE, property tax, subscriptions and accounting."
    )

    if filtered_listing_financials.empty:
        empty_chart_warning("apartment profitability")
    else:
        col1, col2 = st.columns(2)

        with col1:
            fig = px.bar(
                filtered_listing_financials,
                x="year_month",
                y="attributed_profit",
                color="listing_id",
                barmode="group",
                title="Attributed profit by listing/month",
            )
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            fig = px.bar(
                filtered_listing_financials,
                x="year_month",
                y="attributable_fixed_costs_total",
                color="listing_id",
                barmode="group",
                title="Attributable fixed costs",
            )
            st.plotly_chart(fig, use_container_width=True)

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
        profit_cols = existing_cols(filtered_listing_financials, profit_cols)

        st.dataframe(
            clean_display_df(filtered_listing_financials[profit_cols]),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Portfolio cash tab
# ---------------------------------------------------------------------
with tabs[3]:
    st.subheader("Portfolio cash view — including long-term and vacant units")

    st.caption(
        "Level 3. This is the whole-property view. It starts from short-term attributed profit, then adds long-term rents and deducts fixed costs from long-term or vacant units."
    )

    if filtered_portfolio_financials.empty:
        st.warning("No portfolio financials found. Run build_financial_views first.")
    else:
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
            fig = px.bar(
                filtered_portfolio_financials,
                x="year_month",
                y="long_term_rent_net",
                color="portfolio_id",
                barmode="group",
                title="Long-term rent net",
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
        portfolio_cols = existing_cols(filtered_portfolio_financials, portfolio_cols)

        st.dataframe(
            clean_display_df(filtered_portfolio_financials[portfolio_cols]),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Forward position tab
# ---------------------------------------------------------------------
with tabs[4]:
    st.subheader("Forward position")

    if filtered_forward.empty:
        st.info("No forward position data found.")
    else:
        col1, col2 = st.columns(2)

        with col1:
            fig = px.bar(
                filtered_forward,
                x="horizon_days",
                y="booked_nights",
                color="listing_id",
                barmode="group",
                title="Booked nights by horizon",
            )
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            fig = px.bar(
                filtered_forward,
                x="horizon_days",
                y="open_nights",
                color="listing_id",
                barmode="group",
                title="Open nights by horizon",
            )
            st.plotly_chart(fig, use_container_width=True)

        forward_cols = [
            "portfolio_id",
            "listing_id",
            "horizon_days",
            "period_start",
            "period_end",
            "booked_nights",
            "open_nights",
            "occupancy_pct",
            "open_pct",
            "secured_host_payout",
        ]
        forward_cols = existing_cols(filtered_forward, forward_cols)

        st.dataframe(
            clean_display_df(filtered_forward[forward_cols]),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Recommendations tab
# ---------------------------------------------------------------------
with tabs[5]:
    st.subheader("Recommendations")

    if filtered_recs.empty:
        st.success("No current recommendations for the selected listings.")
    else:
        priority_filter = st.multiselect(
            "Priority",
            options=sorted(filtered_recs["priority"].dropna().astype(str).unique()),
            default=sorted(filtered_recs["priority"].dropna().astype(str).unique()),
        )

        recs_view = filtered_recs[
            filtered_recs["priority"].astype(str).isin(priority_filter)
        ].copy()

        for _, row in recs_view.iterrows():
            with st.container(border=True):
                st.markdown(
                    f"### {str(row.get('priority', '')).title()} — {row.get('category')} — {row.get('listing_id')}"
                )
                st.write(f"**Period:** {row.get('period_start')} → {row.get('period_end')}")
                st.write(f"**Problem:** {row.get('problem')}")
                st.write(f"**Evidence:** {row.get('evidence')}")
                st.write(f"**Suggested action:** {row.get('suggested_action')}")
                if pd.notna(row.get("suggested_price")):
                    st.write(f"**Suggested price:** {money(row.get('suggested_price'))}")
                st.write(f"**Actionable in Beds24:** {row.get('actionable_in_beds24')}")


# ---------------------------------------------------------------------
# Gaps tab
# ---------------------------------------------------------------------
with tabs[6]:
    st.subheader("Short gaps")

    if filtered_gaps.empty:
        st.info("No targeted gap offer data found.")
    else:
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
        ]
        gap_cols = existing_cols(filtered_gaps, gap_cols)

        st.dataframe(
            clean_display_df(filtered_gaps[gap_cols]),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Data quality tab
# ---------------------------------------------------------------------
with tabs[7]:
    st.subheader("Data quality")

    if quality.empty:
        st.success("No data quality issues detected.")
    else:
        st.dataframe(clean_display_df(quality), use_container_width=True, hide_index=True)
