from __future__ import annotations

from datetime import timedelta

import pandas as pd
import streamlit as st



from rental_intel.ui.analysis.operations import (
    build_operations_view,
    default_operations_range,
    operations_bounds,
)
from rental_intel.ui.components import (
    metric_card,
    operation_card,
    page_header,
    section_title,
    watch_card,
)
from rental_intel.ui.data import read_processed_csv
from rental_intel.ui.labels import LISTING_LABELS, label_value, money




def _money0(value: object) -> str:
    return money(value, decimals=0)


def _replace_listing_ids(text: str) -> str:
    result = str(text)

    for key, label in LISTING_LABELS.items():
        result = result.replace(key, label)

    return result


def _alert_kind(level: str) -> str:
    level = str(level).lower()

    if level in ["error", "critical"]:
        return "red"

    if level in ["warning", "warn"]:
        return "amber"

    return "blue"


def render_operations_page() -> None:
    page_header(
        eyebrow="06 · Opérations",
        title="Arrivées, départs et ménages",
        subtitle=(
            "Une vue opérationnelle simple pour voir ce qui doit se passer, "
            "ce qui manque, et ce qui devra être repris plus tard dans l’app cleaner."
        ),
    )

    reservations = read_processed_csv("normalized_reservations.csv")
    cleaner_due = read_processed_csv("cleaner_payment_due.csv")

    if reservations.empty:
        st.warning("Pas de fichier normalized_reservations.csv.")
        return

    min_date, max_date = operations_bounds(reservations)
    default_start, default_end = default_operations_range()

    slider_max_date = max_date + timedelta(days=14)

    default_start = max(default_start, min_date)
    default_end = min(default_end, slider_max_date)

    st.caption(
        "La vue s’ouvre sur les 14 prochains jours. Déplacez les poignées pour regarder une autre période."
    )

    period_start, period_end = st.slider(
        "Période opérationnelle",
        min_value=min_date,
        max_value=slider_max_date,
        value=(default_start, default_end),
        format="DD/MM/YYYY",
    )

    if period_end <= period_start:
        st.error("La date de fin doit être après la date de début.")
        return

    view = build_operations_view(
        reservations=reservations,
        cleaner_due=cleaner_due,
        period_start=period_start,
        period_end=period_end,
    )

    summary = view["summary"]

    k1, k2, k3, k4, k5 = st.columns(5)

    with k1:
        metric_card("Arrivées", str(summary["arrivals"]), "période sélectionnée")
    with k2:
        metric_card("Départs", str(summary["departures"]), "période sélectionnée")
    with k3:
        metric_card(
            "Ménages",
            str(summary["cleanings"]),
            f'{summary.get("cleanings_assigned", 0)} assignés · {summary.get("cleanings_unassigned", 0)} à assigner',
        )
    with k4:
        metric_card("Turnovers même jour", str(summary["same_day_turnovers"]), "à prioriser")
    with k5:
        metric_card("Coût ménage", _money0(summary["cleaning_cost_estimate"]), "estimé période")

    left, right = st.columns([1.2, 1], gap="large")

    with left:
        section_title("Timeline opérationnelle", "arrivées · départs · ménages")

        timeline = view["timeline"]

        if timeline.empty:
            st.success("Aucune opération sur cette période.")
        else:
            for _, row in timeline.iterrows():
                date_value = row.get("date")
                date_label = date_value.strftime("%d/%m") if hasattr(date_value, "strftime") else str(date_value)

                title = _replace_listing_ids(row.get("title", ""))
                detail = _replace_listing_ids(row.get("detail", ""))

                operation_card(
                    date_label=date_label,
                    title=title,
                    detail=detail,
                    badge_text=row.get("badge", ""),
                    badge_kind=row.get("kind", "blue"),
                )

    with right:
        section_title("Alertes", "ménages manquants, turnovers serrés, anomalies")

        alerts = view["alerts"]

        if not alerts:
            st.success("Aucune alerte opérationnelle détectée.")
        else:
            for alert in alerts:
                watch_card(
                    title=_replace_listing_ids(alert["title"]),
                    meta="Contrôle opérationnel",
                    recommendation=alert["detail"],
                    badges=[("À vérifier", _alert_kind(alert.get("level", "warning")))],
                )

        same_day = view["same_day"]

        if not same_day.empty:
            section_title("Turnovers même jour", "priorité ménage")

            for _, row in same_day.iterrows():
                date_value = row.get("date")
                date_label = date_value.strftime("%d/%m") if hasattr(date_value, "strftime") else str(date_value)

                watch_card(
                    title=f"{date_label} · {_replace_listing_ids(row.get('title', ''))}",
                    meta="Départ + arrivée le même jour",
                    recommendation=row.get("detail", ""),
                    badges=[("Prioritaire", "amber")],
                )

    section_title("Préparation app cleaner", "données qui alimenteront Next.js plus tard")

    st.info(
        "Cette page est volontairement propriétaire/manager. "
        "La future app cleaner utilisera les mêmes données, mais avec une interface mobile séparée : "
        "mes tâches, accepter, checklist, photos, anomalie, terminé."
    )

    with st.expander("Données opérationnelles détaillées"):
        tab1, tab2, tab3 = st.tabs(["Timeline", "Réservations", "Ménages"])

        with tab1:
            st.dataframe(view["timeline"], use_container_width=True, hide_index=True)

        with tab2:
            st.dataframe(view["arrivals"], use_container_width=True, hide_index=True)
            st.dataframe(view["departures"], use_container_width=True, hide_index=True)

        with tab3:
            st.dataframe(view["cleanings"], use_container_width=True, hide_index=True)