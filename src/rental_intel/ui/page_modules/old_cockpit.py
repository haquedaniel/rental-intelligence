from __future__ import annotations

import pandas as pd
import streamlit as st
from datetime import date, timedelta

from rental_intel.ui.analysis.cockpit import build_cockpit_summary
from rental_intel.ui.components import (
    cost_chip,
    listing_contribution_card,
    metric_card,
    operation_card,
    page_header,
    progress_metric_card,
    section_title,
    watch_card,
)
from rental_intel.ui.data import load_market_benchmark, read_processed_csv
from rental_intel.ui.labels import LISTING_LABELS, label_value, money



def _safe_int(value: object) -> int:
    try:
        if pd.isna(value):
            return 0
        return int(float(value))
    except Exception:
        return 0


def _current_month_range() -> tuple[date, date]:
    today = date.today()
    start = today.replace(day=1)

    if today.month == 12:
        end = date(today.year + 1, 1, 1)
    else:
        end = date(today.year, today.month + 1, 1)

    return start, end


def _date_range_bounds(listing_financials: pd.DataFrame) -> tuple[date, date]:
    today = date.today()
    default_min = date(today.year, 1, 1)
    default_max = date(today.year, 12, 31)

    if listing_financials.empty or "year_month" not in listing_financials.columns:
        return default_min, default_max + timedelta(days=1)

    months = (
        listing_financials["year_month"]
        .dropna()
        .astype(str)
        .str[:7]
        .unique()
        .tolist()
    )

    if not months:
        return default_min, default_max + timedelta(days=1)

    months = sorted(months)
    first_year, first_month = [int(x) for x in months[0].split("-")]
    last_year, last_month = [int(x) for x in months[-1].split("-")]

    min_date = date(first_year, first_month, 1)

    if last_month == 12:
        max_date = date(last_year + 1, 1, 1)
    else:
        max_date = date(last_year, last_month + 1, 1)

    # Give the slider a bit of useful future room.
    max_date = max(max_date, default_max + timedelta(days=1))

    return min_date, max_date


def _month_options(listing_financials: pd.DataFrame) -> list[str]:
    if listing_financials.empty or "year_month" not in listing_financials.columns:
        return []

    return sorted(
        listing_financials["year_month"]
        .dropna()
        .astype(str)
        .str[:7]
        .unique()
        .tolist()
    )


def _money0(value: object) -> str:
    return money(value, decimals=0)


def _target_text(target: float) -> str:
    if not target:
        return ""
    return f"Objectif {_money0(target)}"


def render_cockpit_page() -> None:
    dashboard = read_processed_csv("dashboard_kpis.csv")
    listing_financials = read_processed_csv("listing_month_financials.csv")
    variable_costs = read_processed_csv("variable_period_costs.csv")
    reservations = read_processed_csv("normalized_reservations.csv")
    cleaner_due = read_processed_csv("cleaner_payment_due.csv")
    benchmark = load_market_benchmark()

    # fallbacks if local file names have suffixes in some test folders
    if listing_financials.empty:
        listing_financials = read_processed_csv("monthly_profitability.csv")

    page_header(
        eyebrow="01 · Cockpit",
        title="Vue d’accueil : où en est-on, que faut-il regarder maintenant ?",
        subtitle="Un résumé calme : trajectoire, mois en cours, coûts, logements et opérations à venir.",
    )

    min_date, max_date = _date_range_bounds(listing_financials)
    default_start, default_end = _current_month_range()

    default_start = max(default_start, min_date)
    default_end = min(default_end, max_date)

    st.caption(
        "La vue s’ouvre sur le mois en cours. Déplacez les poignées pour analyser une autre période."
    )

    period_start, period_end = st.slider(
        "Période analysée",
        min_value=min_date,
        max_value=max_date,
        value=(default_start, default_end),
        format="DD/MM/YYYY",
    )

    if period_end <= period_start:
        st.error("La date de fin doit être après la date de début.")
        return

    period_days = (period_end - period_start).days

    summary = build_cockpit_summary(
        dashboard=dashboard,
        listing_financials=listing_financials,
        variable_costs=variable_costs,
        reservations=reservations,
        cleaner_due=cleaner_due,
        market_benchmark=benchmark,
        period_start=period_start,
        period_end=period_end,
    )

    trajectory = summary["trajectory"]

    if "bonne" in trajectory.lower():
        st.success(trajectory)
    elif "surveiller" in trajectory.lower():
        st.warning(trajectory)
    else:
        st.info(trajectory)

    kpis = summary["top_kpis"]

    k1, k2, k3, k4 = st.columns(4)

    with k1:
        item = kpis["annual_on_books"]
        progress_metric_card(
            item["label"],
            _money0(item["value"]),
            _target_text(item["target"]),
            item["pct"],
            item["kind"],
        )

    with k2:
        item = kpis["actual_to_date"]
        progress_metric_card(
            item["label"],
            _money0(item["value"]),
            _target_text(item["target"]),
            item["pct"],
            item["kind"],
        )

    with k3:
        item = kpis["month_ca"]
        progress_metric_card(
            item["label"],
            _money0(item["value"]),
            _target_text(item["target"]),
            item["pct"],
            item["kind"],
        )

    with k4:
        item = kpis["month_after_variables"]
        progress_metric_card(
            item["label"],
            _money0(item["value"]),
            f"{period_days} jours · variables déduites",
            item["pct"],
            item["kind"],
        )

    left, right = st.columns([1.05, 1], gap="large")

    with left:
        section_title(
            "Coûts de la période",
            f"{summary['period_label']} · montants estimés / réservations connues",
        )
        costs = summary["costs"]

        c1, c2, c3, c4, c5 = st.columns(5)

        with c1:
            cost_chip("Conciergerie", _money0(costs.get("Conciergerie", 0)))
        with c2:
            cost_chip("Ménage", _money0(costs.get("Ménage", 0)))
        with c3:
            cost_chip("Énergie", _money0(costs.get("Énergie", 0)))
        with c4:
            cost_chip("Eau", _money0(costs.get("Eau", 0)))
        with c5:
            cost_chip("Autres variables", _money0(costs.get("Autres variables", 0)))

        section_title(
            "Performance par logement",
            f"{summary['period_label']} · brut → après variables → après fixes",
        )

        listing_rows = summary["listing_rows"]

        if not listing_rows:
            st.info("Pas encore de données logement pour ce mois.")
        else:
            for row in listing_rows:
                listing_id = str(row.get("listing_id", ""))
                listing_label = label_value(listing_id, LISTING_LABELS)

                occupancy = ""
                if pd.notna(row.get("occupancy_pct")):
                    occupancy = f"Occupation {float(row.get('occupancy_pct')):.0f}% · {int(row.get('booked_nights', 0))} nuits réservées"

                listing_contribution_card(
                    listing=listing_label,
                    gross=_money0(row.get("gross", 0)),
                    after_variables=_money0(row.get("after_variables", 0)),
                    after_fixed=_money0(row.get("after_fixed", 0)),
                    occupancy=occupancy,
                )

    with right:
        section_title("À surveiller", "3 signaux maximum sur l’accueil")

        attention = summary["attention"]

        if not attention:
            st.success("Aucun signal critique à afficher.")
        else:
            for item in attention[:3]:
                watch_card(
                    title=item["title"],
                    meta="Signal marché / prix",
                    recommendation=item["detail"],
                    badges=[(item["badge"], item["kind"])],
                )

        section_title("Arrivées, départs et ménages", "prochains 14 jours")

        operations = summary["operations"]

        if not operations:
            st.info("Aucune arrivée ou départ à venir dans les 14 prochains jours.")
        else:
            for op in operations:
                date_label = op["date"].strftime("%d/%m") if hasattr(op["date"], "strftime") else str(op["date"])

                title = op["title"]
                for key, label in LISTING_LABELS.items():
                    title = title.replace(key, label)

                operation_card(
                    date_label=date_label,
                    title=title,
                    detail=op["detail"],
                    badge_text=op["badge"],
                    badge_kind=op["kind"],
                )