import pandas as pd
import streamlit as st

from rental_intel.cleaning.db import get_supabase_client


st.set_page_config(
    page_title="Operations - Cleaning MVP",
    layout="wide",
)

st.title("🧹 Cleaning Operations MVP")

supabase = get_supabase_client()

requests = (
    supabase.table("cleaning_requests")
    .select(
        """
        id,
        status,
        urgent,
        scheduled_start_at,
        scheduled_end_at,
        estimated_hours,
        cleaning_cost_eur,
        travel_cost_eur,
        urgency_bonus_eur,
        total_cost_eur,
        properties(name),
        cleaners(first_name,last_name),
        property_cleaning_profiles(label)
        """
    )
    .order("scheduled_start_at")
    .execute()
    .data
)

if not requests:
    st.info("No cleaning requests yet.")
    st.stop()

rows = []

for r in requests:
    rows.append(
        {
            "Property": r["properties"]["name"] if r.get("properties") else "",
            "Cleaner": (
                r["cleaners"]["first_name"]
                if r.get("cleaners")
                else "Unassigned"
            ),
            "Profile": (
                r["property_cleaning_profiles"]["label"]
                if r.get("property_cleaning_profiles")
                else ""
            ),
            "Status": r["status"],
            "Urgent": "Yes" if r["urgent"] else "No",
            "Start": r["scheduled_start_at"],
            "Hours": r["estimated_hours"],
            "Cleaning €": r["cleaning_cost_eur"],
            "Travel €": r["travel_cost_eur"],
            "Bonus €": r["urgency_bonus_eur"],
            "Total €": r["total_cost_eur"],
        }
    )

df = pd.DataFrame(rows)

st.subheader("Upcoming cleaning requests")
st.dataframe(df, use_container_width=True)

st.subheader("Summary")

col1, col2, col3 = st.columns(3)

col1.metric("Requests", len(df))
col2.metric("Urgent", int((df["Urgent"] == "Yes").sum()))
col3.metric("Total estimated cost", f"{df['Total €'].sum():.2f} €")