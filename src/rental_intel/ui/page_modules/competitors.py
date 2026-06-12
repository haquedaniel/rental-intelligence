from __future__ import annotations

import pandas as pd
import streamlit as st

from rental_intel.ui.charts import market_tension_chart, portfolio_price_chart
from rental_intel.ui.components import (
    badge,
    metric_card,
    page_header,
    section_title,
    soft_note,
)
from rental_intel.ui.data import (
    get_airbnb_url,
    load_goyen_daily_latest,
    load_market_benchmark,
    load_market_snapshots_latest,
    load_own_prices_latest,
)
from rental_intel.ui.labels import (
    SCENARIO_LABELS,
    label_value,
    money,
    pct,
)


def _safe_int(value: object) -> int:
    try:
        if pd.isna(value):
            return 0
        return int(value)
    except Exception:
        return 0


def _safe_money(value: object) -> str:
    try:
        if pd.isna(value):
            return "—"
        return money(float(value))
    except Exception:
        return "—"


def _format_airbnb_id(value: object) -> str:
    if pd.isna(value):
        return "—"

    text = str(value).strip()

    if text.endswith(".0"):
        text = text[:-2]

    return text


def _status_label(status: object, available: object) -> tuple[str, str]:
    status_text = str(status)

    if status_text == "success_available" or bool(available):
        return "Disponible", "green"

    if status_text == "success_unavailable":
        return "Indisponible", "blue"

    if "timeout" in status_text or "failed" in status_text:
        return "Erreur scrape", "red"

    return status_text, "amber"


def _filter_for_selection(
    df: pd.DataFrame,
    market_set_id: str,
    scenario_id: str,
) -> pd.DataFrame:
    if df.empty:
        return df

    return df[
        (df["market_set_id"].astype(str) == str(market_set_id))
        & (df["scenario_id"].astype(str) == str(scenario_id))
    ].copy()


def _render_source_card(row: pd.Series) -> None:
    competitor_id = str(row.get("competitor_id", "—"))
    airbnb_id = _format_airbnb_id(row.get("airbnb_id"))
    url = get_airbnb_url(row.get("airbnb_id"))

    observations = _safe_int(row.get("observations"))
    available = _safe_int(row.get("available"))
    unavailable = _safe_int(row.get("unavailable"))
    failures = _safe_int(row.get("failures"))
    median_price = _safe_money(row.get("median_price"))

    if observations > 0:
        availability_rate = available / observations * 100
    else:
        availability_rate = 0

    if failures > 0:
        quality_label = "À vérifier"
        quality_kind = "amber"
    elif observations >= 8:
        quality_label = "Bonne source"
        quality_kind = "green"
    else:
        quality_label = "Échantillon léger"
        quality_kind = "blue"

    st.markdown(
        f"""
        <div class="ri-source">
            <div class="ri-source-title">{competitor_id}</div>
            <div class="ri-small">
                Airbnb ID : {airbnb_id}<br>
                Observations : {observations} · disponibles : {available} · indisponibles : {unavailable} · erreurs : {failures}<br>
                Prix médian normalisé : {median_price} / nuit · disponibilité observée : {availability_rate:.0f}%
            </div>
            <div style="margin-top:0.55rem;">
                {badge("source Airbnb", "blue")}
                {badge(quality_label, quality_kind)}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if url:
        st.link_button("Ouvrir l’annonce Airbnb ↗", url, use_container_width=True)


def _build_source_summary(source: pd.DataFrame) -> pd.DataFrame:
    if source.empty:
        return source

    source = source.copy()

    if "normalised_competitor_nightly" not in source.columns:
        source["normalised_competitor_nightly"] = pd.NA

    if "available" not in source.columns:
        source["available"] = False

    source["available_bool"] = source["available"].astype(bool)
    source["is_unavailable"] = source["status"].astype(str).eq("success_unavailable")
    source["is_failure"] = source["status"].astype(str).str.contains(
        "failed|timeout|error",
        case=False,
        na=False,
    )

    summary = (
        source.groupby(["competitor_id", "airbnb_id"], dropna=False)
        .agg(
            observations=("competitor_id", "size"),
            available=("available_bool", "sum"),
            unavailable=("is_unavailable", "sum"),
            failures=("is_failure", "sum"),
            median_price=("normalised_competitor_nightly", "median"),
            first_check_in=("check_in", "min"),
            last_check_in=("check_in", "max"),
            last_status=("status", "last"),
        )
        .reset_index()
    )

    summary["availability_rate"] = (
        summary["available"] / summary["observations"] * 100
    ).round(0)

    return summary.sort_values(
        ["available", "observations", "median_price"],
        ascending=[False, False, True],
    )


def render_competitor_deep_dive_page() -> None:
    page_header(
        eyebrow="Drill-down concurrents",
        title="Traçabilité du benchmark marché",
        subtitle=(
            "Ici on ne cherche pas à faire joli seulement : on veut pouvoir vérifier chaque recommandation. "
            "Nos prix sont en lignes, les concurrents Airbnb en points, et Le Goyen donne le contexte marché local."
        ),
    )

    own = load_own_prices_latest()
    market = load_market_snapshots_latest()
    benchmark = load_market_benchmark()
    goyen = load_goyen_daily_latest()

    if own.empty:
        st.warning("Il manque les données de prix propres : own_price_scenarios.csv ou own_price_scenarios_history.csv.")
        return

    if market.empty:
        st.warning("Il manque les données concurrentes : market_price_snapshots.csv ou market_price_snapshots_latest.csv.")
        return

    market_sets = sorted(
        set(own["market_set_id"].dropna().astype(str))
        | set(market["market_set_id"].dropna().astype(str))
    )

    controls = st.columns([1.25, 1.25, 0.8, 0.8], gap="medium")

    with controls[0]:
        selected_market_set = st.selectbox(
            "Portefeuille / segment marché",
            market_sets,
            key="competitor_market_set",
        )

    available_scenarios = sorted(
        set(
            own.loc[
                own["market_set_id"].astype(str) == selected_market_set,
                "scenario_id",
            ]
            .dropna()
            .astype(str)
        )
        | set(
            market.loc[
                market["market_set_id"].astype(str) == selected_market_set,
                "scenario_id",
            ]
            .dropna()
            .astype(str)
        )
    )

    with controls[1]:
        selected_scenario = st.selectbox(
            "Scénario",
            available_scenarios,
            format_func=lambda x: label_value(x, SCENARIO_LABELS),
            key="competitor_scenario",
        )

    with controls[2]:
        show_goyen = st.toggle("Le Goyen", value=True)

    with controls[3]:
        show_raw = st.toggle("Données brutes", value=False)

    own_f = _filter_for_selection(own, selected_market_set, selected_scenario)
    market_f = _filter_for_selection(market, selected_market_set, selected_scenario)
    benchmark_f = _filter_for_selection(benchmark, selected_market_set, selected_scenario)

    available_market = market_f[
        market_f.get("available", False).astype(bool)
        & market_f["normalised_competitor_nightly"].notna()
    ].copy()

    k1, k2, k3, k4, k5 = st.columns(5)

    with k1:
        metric_card(
            "Nos logements",
            str(own_f["listing_id"].nunique()) if not own_f.empty else "0",
            "lignes affichées",
        )

    with k2:
        metric_card(
            "Concurrents",
            str(market_f["competitor_id"].nunique()) if not market_f.empty else "0",
            "sources Airbnb",
        )

    with k3:
        metric_card(
            "Prix marché",
            money(available_market["normalised_competitor_nightly"].median())
            if not available_market.empty
            else "—",
            "médiane normalisée",
        )

    with k4:
        if not benchmark_f.empty and "market_availability_rate" in benchmark_f.columns:
            metric_card(
                "Disponibilité",
                pct(benchmark_f["market_availability_rate"].median()),
                "médiane période",
            )
        else:
            metric_card("Disponibilité", "—", "pas de benchmark")

    with k5:
        failures = 0
        if "status" in market_f.columns:
            failures = market_f["status"].astype(str).str.contains(
                "failed|timeout|error",
                case=False,
                na=False,
            ).sum()

        if failures == 0:
            confidence = "Bonne"
        elif failures <= 2:
            confidence = "Moy."
        else:
            confidence = "Faible"

        metric_card("Fiabilité", confidence, f"{failures} erreurs scrape")

    section_title(
        "Prix dans le temps",
        "nos prix en lignes · concurrents en points · Le Goyen en sous-couche",
    )

    fig = portfolio_price_chart(
        own=own,
        market=market,
        goyen=goyen if show_goyen else pd.DataFrame(),
        market_set_id=selected_market_set,
        scenario_id=selected_scenario,
    )

    st.plotly_chart(fig, use_container_width=True)

    lower_left, lower_right = st.columns([1.3, 1], gap="large")

    with lower_left:
        section_title("Tension marché", "part des concurrents encore disponibles")

        st.plotly_chart(
            market_tension_chart(
                benchmark=benchmark,
                market_set_id=selected_market_set,
                scenario_id=selected_scenario,
            ),
            use_container_width=True,
        )

        soft_note(
            "Comment lire cette vue",
            (
                "Quand les points concurrents disparaissent mais que Le Goyen monte, le signal est souvent : "
                "marché tendu, ne pas déclencher de remise automatique. Quand beaucoup de concurrents sont encore "
                "disponibles et que notre prix est au-dessus, on peut envisager une correction."
            ),
        )

    with lower_right:
        section_title("Sources concurrentes", "liens + qualité de l’échantillon")

        summary = _build_source_summary(market_f)

        if summary.empty:
            st.info("Aucun concurrent pour ce filtre.")
        else:
            for _, row in summary.iterrows():
                _render_source_card(row)

    section_title("Table source", "utile pour audit / debug")

    if show_raw:
        display_cols = [
            "competitor_id",
            "airbnb_id",
            "check_in",
            "check_out",
            "nights",
            "adults",
            "children",
            "status",
            "available",
            "nightly_amount",
            "normalised_competitor_nightly",
            "expected_price_index",
            "guest_price_to_comparable_factor",
            "error_type",
            "error_summary",
        ]

        display_cols = [c for c in display_cols if c in market_f.columns]

        st.dataframe(
            market_f[display_cols].sort_values(["check_in", "competitor_id"]),
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.caption("Activez **Données brutes** en haut de page pour afficher toutes les observations.")