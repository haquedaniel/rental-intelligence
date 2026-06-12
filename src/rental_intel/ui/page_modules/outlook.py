from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import streamlit as st

from rental_intel.ui.analysis.outlook import build_outlook, normalise_daily_calendar
from rental_intel.ui.components import (
    adaptive_calendar_html,
    metric_card,
    page_header,
    section_title,
    watch_card,
)

from rental_intel.ui.data import load_market_benchmark, read_processed_csv
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


def _safe_int(value: object) -> int:
    try:
        if pd.isna(value):
            return 0
        return int(value)
    except Exception:
        return 0


def _gap_priority(row: pd.Series) -> int:
    tension = str(row.get("market_tension", ""))
    position = str(row.get("price_position", ""))

    if position in ["well_below_market", "below_market"]:
        return 1

    if tension == "tight_market":
        return 2

    if position in ["well_above_market", "above_market"]:
        return 3

    return 5


def _date_defaults(daily_raw: pd.DataFrame) -> tuple[date, date, date, date]:
    daily = normalise_daily_calendar(daily_raw)

    today = date.today()

    if daily.empty:
        return today, today + timedelta(days=56), today, today + timedelta(days=365)

    min_date = min(daily["date"])
    max_date = max(daily["date"])

    default_start = max(today, min_date)
    default_end = min(default_start + timedelta(days=56), max_date + timedelta(days=1))

    if default_end <= default_start:
        default_end = default_start + timedelta(days=56)

    return default_start, default_end, min_date, max_date + timedelta(days=1)


def render_outlook_page() -> None:
    page_header(
        eyebrow="Outlook",
        title="Prochaines semaines : trous, marché et actions",
        subtitle=(
            "Cette page relie le calendrier réel aux signaux marché. "
            "L’objectif est de savoir où agir, où attendre, et où vérifier un blocage."
        ),
    )

    daily_raw = read_processed_csv("daily_calendar.csv")
    benchmark = load_market_benchmark()

    if daily_raw.empty:
        st.warning("Pas encore de daily_calendar.csv.")
        return

    default_start, default_end, min_allowed, max_allowed = _date_defaults(daily_raw)

    st.caption(
        "Choisissez la période à analyser. Le calendrier, les trous et les opportunités se recalculent automatiquement."
    )

    start_date, end_date = st.slider(
        "Période affichée",
        min_value=min_allowed,
        max_value=max_allowed + timedelta(days=365),
        value=(default_start, default_end),
        format="DD/MM/YYYY",
    )

    if end_date <= start_date:
        st.error("La date de fin doit être après la date de début.")
        return

    outlook = build_outlook(
        daily_raw=daily_raw,
        benchmark=benchmark,
        start_date=start_date,
        end_date=end_date,
    )

    daily = outlook["daily"]
    weekly = outlook["weekly"]
    gaps = outlook["gaps"]

    if daily.empty:
        st.warning("Le daily_calendar.csv existe, mais je n’ai pas réussi à reconnaître ses colonnes.")
        with st.expander("Voir colonnes disponibles"):
            st.write(list(daily_raw.columns))
        return

    k1, k2, k3, k4 = st.columns(4)

    total_nights = len(daily)
    booked_nights = int(daily["occupied"].sum())
    available_nights = int(daily["available"].sum())
    blocked_nights = int(daily["blocked"].sum())
    occ = booked_nights / total_nights * 100 if total_nights else 0

    with k1:
        metric_card("Occupation", pct(occ), f"{booked_nights}/{total_nights} nuits")
    with k2:
        metric_card("Nuits ouvertes", str(available_nights), "réservables")
    with k3:
        metric_card("Nuits bloquées", str(blocked_nights), "à vérifier si anormal")
    with k4:
        metric_card("Trous détectés", str(len(gaps)), "≥ 2 nuits")

    range_days = (end_date - start_date).days
    view_label = "vue journalière" if range_days <= 70 else "vue hebdomadaire"

    section_title(
        "Calendrier synthétique",
        f"{view_label} · vert = réservé · jaune = ouvert · rouge = bloqué",
    )


    st.markdown(
        adaptive_calendar_html(daily, listing_labels=LISTING_LABELS),
        unsafe_allow_html=True,
    )

    left, right = st.columns([1.25, 1], gap="large")

    with left:
        section_title("Trous et opportunités", "priorisés avec le signal marché")

        if gaps.empty:
            st.success("Aucun trou significatif détecté sur la période choisie.")
        else:
            gaps = gaps.copy()
            gaps["priority"] = gaps.apply(_gap_priority, axis=1)
            gaps = gaps.sort_values(["priority", "gap_start", "nights"]).head(12)

            for _, row in gaps.iterrows():
                listing = label_value(row.get("listing_id"), LISTING_LABELS)
                start = row.get("gap_start")
                end = row.get("gap_end")
                nights = _safe_int(row.get("nights"))

                own_price = money(row.get("own_nightly_amount"))
                market_price = money(row.get("competitor_normalised_median_nightly"))

                competitors_available = _safe_int(row.get("competitors_available"))
                competitors_checked = _safe_int(row.get("competitors_checked"))

                tension = str(row.get("market_tension", ""))
                position = str(row.get("price_position", ""))

                recommendation = str(row.get("pricing_guidance", ""))

                if not recommendation or recommendation == "nan":
                    recommendation = "À analyser : le signal marché est encore incomplet."

                watch_card(
                    title=f"{listing} · {start} → {end} · {nights} nuits",
                    meta=(
                        f"Prix actuel {own_price} / nuit · marché {market_price} · "
                        f"{competitors_available}/{competitors_checked} concurrents disponibles"
                    ),
                    recommendation=recommendation,
                    badges=[
                        (label_value(position, PRICE_POSITION_LABELS), _badge_kind_for_position(position)),
                        (label_value(tension, MARKET_TENSION_LABELS), _badge_kind_for_tension(tension)),
                    ],
                )

    with right:
        section_title("Résumé hebdomadaire", "par logement")

        if weekly.empty:
            st.info("Pas de résumé hebdomadaire disponible.")
        else:
            display = weekly.copy()
            display["listing"] = display["listing_id"].apply(
                lambda x: label_value(x, LISTING_LABELS)
            )
            display["week_start"] = display["week_start"].astype(str)

            display["occupancy_label"] = display["occupancy_rate"].apply(
                lambda x: f"{float(x):.0f}%" if pd.notna(x) else "—"
            )

            display["summary"] = display.apply(
                lambda r: f'{int(r["booked_nights"])} réservé · {int(r["available_nights"])} ouvert · {int(r["blocked_nights"])} bloqué',
                axis=1,
            )

            display = display[
                [
                    "listing",
                    "week_start",
                    "summary",
                    "occupancy_label",
                    "revenue",
                ]
            ].rename(
                columns={
                    "listing": "Logement",
                    "week_start": "Semaine",
                    "summary": "Résumé",
                    "occupancy_label": "Occupation",
                    "revenue": "CA",
                }
            )
            st.dataframe(
                display,
                use_container_width=True,
                hide_index=True,
            )

    with st.expander("Données calendrier reconnues"):
        st.dataframe(daily, use_container_width=True, hide_index=True)

def progress_metric_card(
    label: str,
    value: str,
    target: str = "",
    pct_value: float | None = None,
    kind: str = "green",
) -> None:
    pct_display = "—" if pct_value is None else f"{pct_value:.0f}%"
    pct_width = 0 if pct_value is None else max(0, min(float(pct_value), 125))
    bar_width = min(pct_width, 100)

    color = {
        "green": "#1f8a5b",
        "blue": "#3867a6",
        "amber": "#c98219",
        "red": "#bf4a45",
    }.get(kind, "#1f8a5b")

    st.markdown(
        f"""
        <div class="ri-card">
            <div class="ri-kpi-label">{label}</div>
            <div class="ri-kpi-value">{value}</div>
            <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:center;">
                <div class="ri-kpi-sub">{target}</div>
                <div class="ri-kpi-sub" style="font-weight:850;">{pct_display}</div>
            </div>
            <div style="height:10px;background:#ebe6dd;border-radius:999px;margin-top:0.75rem;overflow:hidden;">
                <div style="height:100%;width:{bar_width}%;background:{color};border-radius:999px;"></div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def listing_contribution_card(
    listing: str,
    gross: str,
    after_variables: str,
    after_fixed: str,
    occupancy: str = "",
) -> None:
    st.markdown(
        f"""
        <div class="ri-card" style="margin-bottom:0.75rem;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:0.85rem;">
                <div>
                    <div style="font-size:1.05rem;font-weight:900;color:#172124;">{listing}</div>
                    <div class="ri-small">{occupancy}</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;">
                <div style="background:#fbfaf7;border:1px solid #e5dfd5;border-radius:14px;padding:0.75rem;">
                    <div class="ri-kpi-label">Brut</div>
                    <div style="font-size:1.2rem;font-weight:850;">{gross}</div>
                </div>
                <div style="background:#fbfaf7;border:1px solid #e5dfd5;border-radius:14px;padding:0.75rem;">
                    <div class="ri-kpi-label">Après variables</div>
                    <div style="font-size:1.2rem;font-weight:850;">{after_variables}</div>
                </div>
                <div style="background:#fbfaf7;border:1px solid #e5dfd5;border-radius:14px;padding:0.75rem;">
                    <div class="ri-kpi-label">Après fixes</div>
                    <div style="font-size:1.2rem;font-weight:850;">{after_fixed}</div>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def cost_chip(label: str, value: str) -> None:
    st.markdown(
        f"""
        <div class="ri-card-soft" style="min-height:112px;">
            <div class="ri-kpi-label">{label}</div>
            <div style="font-size:1.45rem;font-weight:900;color:#172124;letter-spacing:-0.04em;">{value}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def operation_card(
    date_label: str,
    title: str,
    detail: str,
    badge_text: str,
    badge_kind: str = "blue",
) -> None:
    st.markdown(
        f"""
        <div class="ri-watch">
            <div style="display:grid;grid-template-columns:74px 1fr auto;gap:0.75rem;align-items:center;">
                <div class="ri-small" style="font-weight:850;">{date_label}</div>
                <div>
                    <div class="ri-watch-title">{title}</div>
                    <div class="ri-watch-meta">{detail}</div>
                </div>
                <div>{badge(badge_text, badge_kind)}</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )