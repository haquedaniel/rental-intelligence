from __future__ import annotations

import os
from datetime import timedelta
from urllib.parse import urlparse

import pandas as pd
import requests
import streamlit as st

from rental_intel.ui.components import (
    page_header,
    section_title,
    metric_card,
    soft_note,
)


SITE = "leclosdelavoilerie"


def _get_secret(name: str) -> str:
    try:
        return st.secrets[name]
    except Exception:
        return os.environ.get(name, "")


@st.cache_data(ttl=300)
def _load_pageviews(site: str = SITE, limit: int = 5000) -> pd.DataFrame:
    supabase_url = _get_secret("SUPABASE_URL")
    supabase_key = _get_secret("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        return pd.DataFrame()

    url = f"{supabase_url.rstrip('/')}/rest/v1/site_pageviews"

    params = {
        "select": "*",
        "site": f"eq.{site}",
        "order": "created_at.desc",
        "limit": str(limit),
    }

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }

    response = requests.get(url, params=params, headers=headers, timeout=20)
    response.raise_for_status()

    df = pd.DataFrame(response.json())

    if df.empty:
        return df

    df["created_at"] = pd.to_datetime(df["created_at"])
    df["date"] = df["created_at"].dt.date

    def source_from_row(row: pd.Series) -> str:
        utm_source = row.get("utm_source")
        if pd.notna(utm_source) and str(utm_source).strip():
            return str(utm_source).strip()

        referrer = row.get("referrer")
        if not referrer or pd.isna(referrer):
            return "(direct)"

        try:
            host = urlparse(str(referrer)).netloc.replace("www.", "")
            if not host:
                return "(direct)"
            if "leclosdelavoilerie.com" in host:
                return "(internal)"
            return host
        except Exception:
            return "(unknown)"

    def locale_region(language: str | None) -> str:
        if not language or pd.isna(language):
            return "(unknown)"
        parts = str(language).split("-")
        if len(parts) >= 2:
            return parts[-1].upper()
        return "(no region)"

    df["source"] = df.apply(source_from_row, axis=1)
    df["browser_language"] = df["language"].fillna("(unknown)")
    df["locale_region"] = df["language"].apply(locale_region)

    return df


def _adaptive_date_filter(df: pd.DataFrame) -> pd.DataFrame:
    min_date = df["date"].min()
    max_date = df["date"].max()

    section_title(
        "Période d’analyse",
        "Sélection rapide ou exploration manuelle selon l’historique disponible.",
    )

    if min_date == max_date:
        st.caption(f"Données disponibles uniquement pour le {min_date:%d/%m/%Y}.")
        return df.copy()

    available_days = (max_date - min_date).days

    preset_options = ["7 jours", "30 jours", "90 jours", "Tout", "Personnalisé"]

    if available_days < 7:
        default_index = 3
    elif available_days < 30:
        default_index = 0
    else:
        default_index = 1

    preset = st.radio(
        "Vue rapide",
        options=preset_options,
        index=default_index,
        horizontal=True,
    )

    if preset == "7 jours":
        start_date = max(min_date, max_date - timedelta(days=7))
        end_date = max_date
    elif preset == "30 jours":
        start_date = max(min_date, max_date - timedelta(days=30))
        end_date = max_date
    elif preset == "90 jours":
        start_date = max(min_date, max_date - timedelta(days=90))
        end_date = max_date
    elif preset == "Tout":
        start_date = min_date
        end_date = max_date
    else:
        default_start = max(min_date, max_date - timedelta(days=min(30, available_days)))

        start_date, end_date = st.slider(
            "Sélectionner la période",
            min_value=min_date,
            max_value=max_date,
            value=(default_start, max_date),
            format="DD/MM/YYYY",
        )

    st.caption(f"Période affichée : {start_date:%d/%m/%Y} → {end_date:%d/%m/%Y}")

    return df[(df["date"] >= start_date) & (df["date"] <= end_date)].copy()


def render_web_analytics_page() -> None:
    page_header(
        eyebrow="Acquisition directe",
        title="Web analytics",
        subtitle=(
            "Suivi léger des vues de pages du site Le Clos de la Voilerie. "
            "Les chiffres représentent des vues de pages, pas encore des visiteurs uniques."
        ),
    )

    df = _load_pageviews()

    if df.empty:
        soft_note(
            "Aucune donnée pour l’instant",
            "Vérifiez que SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont bien configurés, "
            "et que le script pageview-tracker.js est présent sur les pages du site.",
        )
        st.stop()

    filtered = _adaptive_date_filter(df)

    section_title(
        "Vue d’ensemble",
        "Activité web sur la période sélectionnée.",
    )

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        metric_card(
            "Vues de pages",
            f"{len(filtered):,}".replace(",", " "),
            "Total des chargements de pages",
        )

    with col2:
        metric_card(
            "Pages vues",
            f"{filtered['path'].nunique()}",
            "Nombre d’URLs distinctes",
        )

    with col3:
        metric_card(
            "Sources",
            f"{filtered['source'].nunique()}",
            "UTM ou domaine référent",
        )

    with col4:
        metric_card(
            "Langues",
            f"{filtered['browser_language'].nunique()}",
            "Langues navigateur détectées",
        )

    section_title(
        "Origine du trafic",
        "Répartition par source et langue navigateur.",
    )

    left, right = st.columns(2)

    with left:
        source_summary = (
            filtered.groupby("source")
            .size()
            .reset_index(name="vues")
            .sort_values("vues", ascending=False)
        )

        st.markdown("#### Sources")
        st.bar_chart(source_summary.set_index("source"))

    with right:
        language_summary = (
            filtered.groupby("browser_language")
            .size()
            .reset_index(name="vues")
            .sort_values("vues", ascending=False)
        )

        st.markdown("#### Langues navigateur")
        st.bar_chart(language_summary.set_index("browser_language"))

    section_title(
        "Lecture géographique approximative",
        "Déduite de la langue navigateur, pas d’une géolocalisation IP.",
    )

    left, right = st.columns(2)

    with left:
        region_summary = (
            filtered.groupby("locale_region")
            .size()
            .reset_index(name="vues")
            .sort_values("vues", ascending=False)
        )

        st.dataframe(region_summary, use_container_width=True, hide_index=True)

    with right:
        page_summary = (
            filtered.groupby(["path", "page_title"])
            .size()
            .reset_index(name="vues")
            .sort_values("vues", ascending=False)
        )

        st.dataframe(page_summary, use_container_width=True, hide_index=True)

    section_title(
        "Évolution quotidienne",
        "Nombre de vues de pages par jour.",
    )

    daily = (
        filtered.groupby("date")
        .size()
        .reset_index(name="vues")
        .sort_values("date")
    )

    st.line_chart(daily.set_index("date"))

    section_title(
        "Dernières vues",
        "Données brutes utiles pour vérifier les UTM et les pages suivies.",
    )

    latest_cols = [
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

    latest = filtered[latest_cols].sort_values("created_at", ascending=False)

    st.dataframe(latest, use_container_width=True, hide_index=True)