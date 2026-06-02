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
        "Portfolio",
        "Forward position",
        "Recommendations",
        "Gaps",
        "Financials",
        "Data quality",
    ]
)


# ---------------------------------------------------------------------
# Portfolio tab
# ---------------------------------------------------------------------
with tabs[0]:
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
with tabs[1]:
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
with tabs[2]:
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
with tabs[3]:
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
with tabs[4]:
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

    st.dataframe(
        clean_display_df(
            financial[
                [
                    "portfolio_id",
                    "listing_id",
                    "year_month",
                    "gross_booking_value",
                    "accommodation_revenue",
                    "cleaning_fee",
                    "tourist_tax",
                    "channel_commission",
                    "host_payout",
                    "payout_less_cleaning",
                ]
            ]
        ),
        use_container_width=True,
        hide_index=True,
    )


# ---------------------------------------------------------------------
# Data quality tab
# ---------------------------------------------------------------------
with tabs[5]:
    st.subheader("Data quality")

    if quality.empty:
        st.success("No data quality issues detected.")
    else:
        st.dataframe(clean_display_df(quality), use_container_width=True, hide_index=True)
