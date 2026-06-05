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
        if pd.isna(value):
            return "—"
        return f"€{float(value):,.0f}".replace(",", " ")
    except Exception:
        return "—"


def pct(value) -> str:
    try:
        if pd.isna(value):
            return "—"
        return f"{float(value):.1f}%"
    except Exception:
        return "—"


def clean_display_df(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out = out.replace({pd.NA: None})
    return out


monthly = load_csv("monthly_metrics.csv")
forward = load_csv("forward_position.csv")
recommendations = load_csv("recommendations.csv")
gap_offers = load_csv("gap_offers.csv")
quality = load_csv("data_quality_issues.csv")
profitability = load_csv("monthly_profitability.csv")
portfolio_profitability = load_csv("portfolio_profitability.csv")
dashboard_kpis = load_csv("dashboard_kpis.csv")
cleaner_due = load_csv("cleaner_payment_due.csv")


st.title("🏡 Rental Intelligence Cockpit")

if monthly.empty:
    st.error("No monthly metrics found. Run the pipeline first.")
    st.stop()


# ---------------------------------------------------------------------
# Sidebar filters
# ---------------------------------------------------------------------
st.sidebar.header("Filters")

portfolio_options = sorted(
    [x for x in monthly["portfolio_id"].dropna().astype(str).unique()]
)
selected_portfolios = st.sidebar.multiselect(
    "Portfolio",
    options=portfolio_options,
    default=portfolio_options,
)

filtered_monthly = monthly[
    monthly["portfolio_id"].astype(str).isin(selected_portfolios)
].copy()

listing_options = sorted(
    [x for x in filtered_monthly["listing_id"].dropna().astype(str).unique()]
)

selected_listings = st.sidebar.multiselect(
    "Listing",
    options=listing_options,
    default=listing_options,
)

filtered_monthly = filtered_monthly[
    filtered_monthly["listing_id"].astype(str).isin(selected_listings)
].copy()

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


# ---------------------------------------------------------------------
# Top-level KPIs
# ---------------------------------------------------------------------
total_host_payout = filtered_monthly["host_payout"].sum()
total_accommodation = filtered_monthly["accommodation_revenue"].sum()
total_cleaning = filtered_monthly["cleaning_fee"].sum()
total_tax = filtered_monthly["tourist_tax"].sum()
total_booked_nights = filtered_monthly["booked_nights"].sum()

kpi1, kpi2, kpi3, kpi4, kpi5 = st.columns(5)

kpi1.metric("Host payout", money(total_host_payout))
kpi2.metric("Accommodation", money(total_accommodation))
kpi3.metric("Cleaning fees", money(total_cleaning))
kpi4.metric("Taxe de séjour", money(total_tax))
kpi5.metric("Booked nights", f"{int(total_booked_nights)}")


tabs = st.tabs(
    [
        "Home",
        "Portfolio",
        "Forward position",
        "Recommendations",
        "Gaps",
        "Financials",
        "Data quality",
    ]
)

with tabs[0]:
    st.subheader("Executive summary")

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

        current_profit = kpi_view["current_month_operating_profit"].sum()
        current_cash = kpi_view["current_month_portfolio_cash_result"].sum()

        ytd_revenue = kpi_view["ytd_host_payout"].sum()
        annual_target = kpi_view["target_host_payout"].sum()
        remaining_to_target = annual_target - ytd_revenue if annual_target else None
        annual_target_pct = (
            ytd_revenue / annual_target * 100
            if annual_target
            else None
        )

        required_per_remaining_month = (
            kpi_view["host_payout_required_per_remaining_month"].sum()
            if "host_payout_required_per_remaining_month" in kpi_view.columns
            else None
        )

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
            help="Host payout for the current month, compared with the current monthly target.",
        )
        c2.metric(
            "This month target",
            money(current_month_target),
            delta=f"{current_target_pct:.1f}%" if current_target_pct is not None else None,
            help="Combined monthly revenue target for the selected portfolios.",
        )
        c3.metric(
            "This month op. profit",
            money(current_profit),
            help="Estimated operating profit for active short-term rentals after booking-associated and fixed allocated costs.",
        )
        c4.metric(
            "Portfolio cash result",
            money(current_cash),
            help="Portfolio-level cash result including long-term units and vacant-unit costs.",
        )

        c5, c6, c7, c8 = st.columns(4)
        c5.metric(
            "YTD revenue",
            money(ytd_revenue),
            delta=f"{annual_target_pct:.1f}%" if annual_target_pct is not None else None,
            help="Year-to-date host payout compared with the annual target.",
        )
        c6.metric(
            "Annual target",
            money(annual_target),
            help="Sum of monthly listing revenue targets for the selected portfolios.",
        )
        c7.metric(
            "Remaining to annual target",
            money(remaining_to_target),
            help="Annual target less year-to-date host payout.",
        )
        c8.metric(
            "Cleaner to pay this month",
            money(cleaner_total),
            help="Sum of cleaning_actual_cost expense rules for bookings arriving this month.",
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
            "ytd_operating_profit",
            "ytd_portfolio_cash_result",
        ]
        target_cols = [c for c in target_cols if c in kpi_view.columns]

        st.dataframe(
            clean_display_df(kpi_view[target_cols]),
            use_container_width=True,
            hide_index=True,
        )

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
            cleaner_cols = [c for c in cleaner_cols if c in cleaner_view.columns]

            st.dataframe(
                clean_display_df(cleaner_view[cleaner_cols]),
                use_container_width=True,
                hide_index=True,
            )
# ---------------------------------------------------------------------
# Portfolio tab
# ---------------------------------------------------------------------
with tabs[1]:
    st.subheader("Monthly performance")

    col1, col2 = st.columns(2)

    with col1:
        chart_data = filtered_monthly.copy()
        fig = px.bar(
            chart_data,
            x="year_month",
            y="host_payout",
            color="listing_id",
            barmode="group",
            title="Host payout by month",
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        chart_data = filtered_monthly.copy()
        fig = px.bar(
            chart_data,
            x="year_month",
            y="occupancy_pct",
            color="listing_id",
            barmode="group",
            title="Occupancy by month",
        )
        st.plotly_chart(fig, use_container_width=True)

    st.dataframe(
        clean_display_df(
            filtered_monthly[
                [
                    "portfolio_id",
                    "listing_id",
                    "year_month",
                    "booked_nights",
                    "occupancy_pct",
                    "accommodation_revenue",
                    "cleaning_fee",
                    "tourist_tax",
                    "host_payout",
                    "host_payout_minus_cleaning",
                    "adr_accommodation",
                ]
            ]
        ),
        use_container_width=True,
        hide_index=True,
    )


# ---------------------------------------------------------------------
# Forward position tab
# ---------------------------------------------------------------------
with tabs[2]:
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

        st.dataframe(
            clean_display_df(
                filtered_forward[
                    [
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
                ]
            ),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Recommendations tab
# ---------------------------------------------------------------------
with tabs[3]:
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
                    f"### {row['priority'].title()} — {row['category']} — {row['listing_id']}"
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
with tabs[4]:
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

        st.dataframe(
            clean_display_df(
                filtered_gaps[
                    [
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
                ]
            ),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Financials tab
# ---------------------------------------------------------------------
with tabs[5]:
    st.subheader("Financial view")

    st.info(
        "This tab is the future home of the expense and profitability logic "
        "from the earlier email reports: fixed costs, variable costs, targets, "
        "cleaning costs, concierge fees, financing and portfolio profitability."
    )

    financial = filtered_monthly.copy()
    financial["payout_less_cleaning"] = (
        financial["host_payout"] - financial["cleaning_fee"]
    )

    col1, col2 = st.columns(2)

    with col1:
        fig = px.bar(
            financial,
            x="year_month",
            y="host_payout",
            color="listing_id",
            title="Host payout",
            barmode="group",
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        fig = px.bar(
            financial,
            x="year_month",
            y="payout_less_cleaning",
            color="listing_id",
            title="Payout less cleaning",
            barmode="group",
        )
        st.plotly_chart(fig, use_container_width=True)

    st.markdown("### Financial monthly table")

    if profitability.empty:
        st.warning("No profitability data found. Run build_profitability first.")
    else:
        filtered_profitability = profitability[
            profitability["listing_id"].astype(str).isin(selected_listings)
            & profitability["portfolio_id"].astype(str).isin(selected_portfolios)
        ].copy()

        st.markdown("### Estimated operating profit")

        col1, col2 = st.columns(2)

        with col1:
            fig = px.bar(
                filtered_profitability,
                x="year_month",
                y="estimated_operating_profit",
                color="listing_id",
                title="Estimated operating profit",
                barmode="group",
            )
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            fig = px.bar(
                filtered_profitability,
                x="year_month",
                y="booking_associated_costs",
                color="listing_id",
                title="Booking-associated costs",
                barmode="group",
            )
            st.plotly_chart(fig, use_container_width=True)

        st.dataframe(
            clean_display_df(
                filtered_profitability[
                    [
                        "portfolio_id",
                        "listing_id",
                        "year_month",
                        "host_payout",
                        "cleaning_fee",
                        "host_payout_minus_cleaning",
                        "booking_associated_costs",
                        "fixed_allocated_costs",
                        "estimated_operating_profit",
                    ]
                ]
            ),
            use_container_width=True,
            hide_index=True,
        )



    st.markdown("### Portfolio / investor cash view")

    if portfolio_profitability.empty:
        st.warning("No portfolio profitability data found. Run build_portfolio_profitability first.")
    else:
        filtered_portfolio_profitability = portfolio_profitability[
            portfolio_profitability["portfolio_id"].astype(str).isin(selected_portfolios)
        ].copy()

        col1, col2 = st.columns(2)

        with col1:
            fig = px.bar(
                filtered_portfolio_profitability,
                x="year_month",
                y="estimated_portfolio_cash_result",
                color="portfolio_id",
                title="Estimated portfolio cash result",
                barmode="group",
            )
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            fig = px.bar(
                filtered_portfolio_profitability,
                x="year_month",
                y="long_term_rent_net",
                color="portfolio_id",
                title="Long-term rent net contribution",
                barmode="group",
            )
            st.plotly_chart(fig, use_container_width=True)

        st.dataframe(
            clean_display_df(
                filtered_portfolio_profitability[
                    [
                        "portfolio_id",
                        "year_month",
                        "short_term_operating_profit",
                        "long_term_rent_gross",
                        "long_term_rent_adjustments",
                        "long_term_rent_net",
                        "fixed_costs_long_term_units",
                        "fixed_costs_vacant_units",
                        "estimated_portfolio_cash_result",
                    ]
                ]
            ),
            use_container_width=True,
            hide_index=True,
        )


# ---------------------------------------------------------------------
# Data quality tab
# ---------------------------------------------------------------------
with tabs[6]:
    st.subheader("Data quality")

    if quality.empty:
        st.success("No data quality issues detected.")
    else:
        st.dataframe(clean_display_df(quality), use_container_width=True, hide_index=True)
