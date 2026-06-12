from __future__ import annotations

import pandas as pd
import streamlit as st

from rental_intel.ui.charts import goyen_daily_chart
from rental_intel.ui.components import (
    metric_card,
    page_header,
    section_title,
    soft_note,
    watch_card,
)
from rental_intel.ui.data import (
    load_goyen_daily_latest,
    load_market_benchmark,
)
from rental_intel.ui.labels import (
    LISTING_LABELS,
    MARKET_TENSION_LABELS,
    PRICE_POSITION_LABELS,
    label_value,
    money,
    pct,
)


def _badge_kind_for_tension(value: str) -> str:
    if value == "tight_market":
        return "blue"
    if value == "moderate_market":
        return "amber"
    if value == "open_market":
        return "green"
    return "amber"


def _badge_kind_for_position(value: str) -> str:
    if value in ["well_below_market", "below_market"]:
        return "red"
    if value == "near_market":
        return "green"
    if value in ["above_market", "well_above_market"]:
        return "amber"
    return "blue"


def _interesting_market_rows(df: pd.DataFrame, limit: int = 5) -> pd.DataFrame:
    if df.empty:
        return df

    df = df.copy()

    priority = {
        "well_below_market": 1,
        "below_market": 2,
        "no_comparison": 3,
        "well_above_market": 4,
        "above_market": 5,
        "near_market": 6,
    }

    tension_priority = {
        "tight_market": 1,
        "moderate_market": 2,
        "open_market": 3,
        "thin_sample": 4,
    }

    df["priority"] = df["price_position"].map(priority).fillna(9)
    df["tension_priority"] = df["market_tension"].map(tension_priority).fillna(9)

    return df.sort_values(
        ["priority", "tension_priority", "check_in"],
        ascending=[True, True, True],
    ).head(limit)


def render_market_page() -> None:
    page_header(
        eyebrow="Analyse marché",
        title="Marché local, concurrence et périodes à surveiller",
        subtitle=(
            "La page principale reste volontairement synthétique : Le Goyen donne le baromètre local, "
            "Airbnb donne les comparables, et les recommandations restent actionnables."
        ),
    )

    benchmark = load_market_benchmark()
    goyen = load_goyen_daily_latest()

    left, right = st.columns([1, 1.15], gap="large")

    with left:
        section_title("Baromètre Le Goyen", "source dense · signal premium local")

        if goyen.empty:
            st.info("Pas encore de données Le Goyen.")
        else:
            available = goyen[goyen["available"] & goyen["price"].notna()]
            unavailable = goyen[~goyen["available"]]

            k1, k2, k3, k4 = st.columns(4)

            with k1:
                metric_card("Prix médian", money(available["price"].median()), "chambre/rate sélectionnés")
            with k2:
                metric_card("Pic visible", money(available["price"].max()), "prix journalier")
            with k3:
                metric_card("Indispo.", f"{len(unavailable)} j", "sur la période")
            with k4:
                if len(available) >= 14:
                    start_med = available.head(7)["price"].median()
                    end_med = available.tail(7)["price"].median()
                    trend = ((end_med / start_med) - 1) * 100 if start_med else 0
                    metric_card("Tendance", pct(trend), "fin vs début")
                else:
                    metric_card("Tendance", "—", "échantillon court")

            st.plotly_chart(goyen_daily_chart(goyen), use_container_width=True)

            soft_note(
                "Lecture opérationnelle",
                (
                    "Le Goyen n’est pas un comparable direct, mais il joue le rôle de baromètre. "
                    "S’il monte ou devient indisponible sur certaines dates, on évite de baisser nos prix trop tôt."
                ),
            )

    with right:
        section_title("Intelligence concurrentielle Airbnb", "comparables normalisés · résumé actionnable")

        if benchmark.empty:
            st.info("Pas encore de benchmark Airbnb.")
            return

        market_sets = sorted(benchmark["market_set_id"].dropna().unique().tolist())

        selected_market_set = st.selectbox(
            "Segment marché",
            market_sets,
            index=0,
            key="market_page_market_set",
        )

        b = benchmark[benchmark["market_set_id"] == selected_market_set].copy()

        k1, k2, k3, k4, k5 = st.columns(5)

        available_price = b["competitor_normalised_median_nightly"].dropna()
        own_price = b["own_nightly_amount"].dropna()

        with k1:
            metric_card("Notre prix", money(own_price.median()), "médiane testée")
        with k2:
            metric_card("Marché", money(available_price.median()), "normalisé Airbnb")
        with k3:
            checked = int(b["competitors_checked"].max()) if "competitors_checked" in b else 0
            metric_card("Concurrents", str(checked), "max testés")
        with k4:
            availability = b["market_availability_rate"].dropna()
            metric_card("Disponibilité", pct(availability.median()), "médiane")
        with k5:
            failures = b["competitors_failed"].fillna(0).sum()
            confidence = "Bonne" if failures == 0 and checked >= 3 else "Moy."
            metric_card("Fiabilité", confidence, "scrape + sample")

        section_title("Périodes à surveiller", "priorisées par utilité opérationnelle")

        rows = _interesting_market_rows(b, limit=5)

        for _, row in rows.iterrows():
            listing = label_value(row.get("listing_id"), LISTING_LABELS)
            period = f"{row.get('check_in')} → {row.get('check_out')}"
            own = money(row.get("own_nightly_amount"))
            market = money(row.get("competitor_normalised_median_nightly"))
            avail = row.get("competitors_available", 0)
            checked = row.get("competitors_checked", 0)

            tension = str(row.get("market_tension", ""))
            position = str(row.get("price_position", ""))

            watch_card(
                title=f"{listing} · {period}",
                meta=(
                    f"Notre prix {own} / nuit · Marché {market} · "
                    f"{int(avail)}/{int(checked)} concurrents disponibles"
                ),
                recommendation=str(row.get("pricing_guidance", "")),
                badges=[
                    (label_value(position, PRICE_POSITION_LABELS), _badge_kind_for_position(position)),
                    (label_value(tension, MARKET_TENSION_LABELS), _badge_kind_for_tension(tension)),
                ],
            )

        st.info(
            "Le détail complet par concurrent est disponible dans **Drill-down concurrents**. "
            "Cette page principale reste volontairement synthétique."
        )