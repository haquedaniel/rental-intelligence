import requests
import pandas as pd
import streamlit as st
from urllib.parse import urlparse

st.set_page_config(page_title="Web analytics", layout="wide")

SUPABASE_URL = st.secrets["SUPABASE_URL"]
SUPABASE_KEY = st.secrets["SUPABASE_KEY"]

SITE = "leclosdelavoilerie"


@st.cache_data(ttl=300)
def load_pageviews() -> pd.DataFrame:
    url = f"{SUPABASE_URL}/rest/v1/site_pageviews"

    params = {
        "select": "*",
        "site": f"eq.{SITE}",
        "order": "created_at.desc",
        "limit": "5000",
    }

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }

    r = requests.get(url, params=params, headers=headers, timeout=20)
    r.raise_for_status()

    df = pd.DataFrame(r.json())

    if df.empty:
        return df

    df["created_at"] = pd.to_datetime(df["created_at"])
    df["date"] = df["created_at"].dt.date

    def clean_source(row):
        if pd.notna(row.get("utm_source")) and row.get("utm_source"):
            return row["utm_source"]

        ref = row.get("referrer")
        if not ref:
            return "(direct)"

        try:
            host = urlparse(ref).netloc.replace("www.", "")
            if not host:
                return "(direct)"
            if "leclosdelavoilerie.com" in host:
                return "(internal)"
            return host
        except Exception:
            return "(unknown)"

    def locale_country(language):
        if not language or pd.isna(language):
            return "(unknown)"
        parts = str(language).split("-")
        if len(parts) >= 2:
            return parts[-1].upper()
        return "(no region)"

    df["source"] = df.apply(clean_source, axis=1)
    df["browser_language"] = df["language"].fillna("(unknown)")
    df["locale_region"] = df["language"].apply(locale_country)

    return df


df = load_pageviews()

st.title("Web analytics")
st.caption("Le Clos de la Voilerie — page views from Supabase")

if df.empty:
    st.info("No pageviews yet.")
    st.stop()

min_date = df["date"].min()
max_date = df["date"].max()

date_range = st.date_input(
    "Period",
    value=(min_date, max_date),
    min_value=min_date,
    max_value=max_date,
)

if isinstance(date_range, tuple) and len(date_range) == 2:
    start_date, end_date = date_range
    filtered = df[(df["date"] >= start_date) & (df["date"] <= end_date)]
else:
    filtered = df.copy()

col1, col2, col3, col4 = st.columns(4)

col1.metric("Page views", len(filtered))
col2.metric("Pages viewed", filtered["path"].nunique())
col3.metric("Sources", filtered["source"].nunique())
col4.metric("Languages", filtered["browser_language"].nunique())

st.divider()

left, right = st.columns(2)

with left:
    st.subheader("Page views by source")
    source_summary = (
        filtered.groupby("source")
        .size()
        .reset_index(name="pageviews")
        .sort_values("pageviews", ascending=False)
    )
    st.bar_chart(source_summary.set_index("source"))

with right:
    st.subheader("Page views by browser language")
    language_summary = (
        filtered.groupby("browser_language")
        .size()
        .reset_index(name="pageviews")
        .sort_values("pageviews", ascending=False)
    )
    st.bar_chart(language_summary.set_index("browser_language"))

left, right = st.columns(2)

with left:
    st.subheader("Page views by locale region")
    region_summary = (
        filtered.groupby("locale_region")
        .size()
        .reset_index(name="pageviews")
        .sort_values("pageviews", ascending=False)
    )
    st.dataframe(region_summary, use_container_width=True, hide_index=True)

with right:
    st.subheader("Top pages")
    page_summary = (
        filtered.groupby(["path", "page_title"])
        .size()
        .reset_index(name="pageviews")
        .sort_values("pageviews", ascending=False)
    )
    st.dataframe(page_summary, use_container_width=True, hide_index=True)

st.subheader("Daily page views")

daily = (
    filtered.groupby("date")
    .size()
    .reset_index(name="pageviews")
    .sort_values("date")
)

st.line_chart(daily.set_index("date"))

st.subheader("Latest page views")

latest = filtered[
    [
        "created_at",
        "path",
        "source",
        "browser_language",
        "locale_region",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "referrer",
        "viewport_width",
    ]
].sort_values("created_at", ascending=False)

st.dataframe(latest, use_container_width=True, hide_index=True)