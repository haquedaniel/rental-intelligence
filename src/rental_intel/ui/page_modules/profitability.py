from __future__ import annotations

from datetime import timedelta

import pandas as pd
import streamlit as st

from rental_intel.ui.analysis.profitability import (
    build_portfolio_global_view,
    build_profitability_view,
    current_month_range,
    date_bounds_from_monthly,
)
from rental_intel.ui.charts import (
    cost_breakdown_chart,
    portfolio_cash_trend_chart,
    profitability_trend_chart,
)
from rental_intel.ui.components import (
    listing_contribution_card,
    metric_card,
    page_header,
    section_title,
    soft_note,
)
from rental_intel.ui.data import read_processed_csv
from rental_intel.ui.labels import LISTING_LABELS, label_value, money, pct


def _money0(value: object) -> str:
    return money(value, decimals=0)


def _pct0(value: object) -> str:
    if value is None or pd.isna(value):
        return "—"
    return pct(value, decimals=0)


def render_profitability_page() -> None:
    page_header(
        eyebrow="05 · Rentabilité",
        title="Comprendre ce qui reste vraiment",
        subtitle=(
            "Une vue par période : brut, contribution après variables, résultat après fixes, "
            "coûts et prix planchers."
        ),
    )

    monthly = read_processed_csv("listing_month_financials.csv")
    if monthly.empty:
        monthly = read_processed_csv("monthly_profitability.csv")

    floors = read_processed_csv("monthly_price_floors.csv")
    fixed_expenses = read_processed_csv("fixed_expenses.csv")
    variable_costs = read_processed_csv("variable_period_costs.csv")

    portfolio_monthly = read_processed_csv("portfolio_month_financials.csv")
    long_term_income = read_processed_csv("long_term_income.csv")
    unit_fixed_costs = read_processed_csv("unit_fixed_costs.csv")

    if monthly.empty:
        st.warning("Pas de données financières mensuelles disponibles.")
        return

    min_date, max_date = date_bounds_from_monthly(monthly)
    default_start, default_end = current_month_range(min_date, max_date)

    st.caption(
        "La vue s’ouvre sur le mois en cours. Déplacez les poignées pour analyser une saison ou une période longue."
    )

    period_start, period_end = st.slider(
        "Période analysée",
        min_value=min_date,
        max_value=max_date + timedelta(days=365),
        value=(default_start, default_end),
        format="DD/MM/YYYY",
    )

    if period_end <= period_start:
        st.error("La date de fin doit être après la date de début.")
        return
    
    view_mode = st.segmented_control(
        "Vue",
        ["Location saisonnière", "Portefeuille global"],
        default="Location saisonnière",
    )

    if view_mode == "Location saisonnière":
        view = build_profitability_view(
            monthly=monthly,
            floors=floors,
            fixed_expenses=fixed_expenses,
            variable_costs=variable_costs,
            period_start=period_start,
            period_end=period_end,
        )

        summary = view["summary"]

        k1, k2, k3, k4 = st.columns(4)

        with k1:
            metric_card("CA brut période", _money0(summary["gross"]), view["period_label"])

        with k2:
            metric_card(
                "Après variables",
                _money0(summary["after_variables"]),
                f"Marge {_pct0(summary['margin_after_variables'])}",
            )

        with k3:
            metric_card(
                "Après fixes",
                _money0(summary["after_fixed"]),
                f"Marge {_pct0(summary['margin_after_fixed'])}",
            )

        with k4:
            metric_card(
                "Coûts totaux",
                _money0(summary["variable_cost_total"] + summary["fixed_cost_total"]),
                f"Variables {_money0(summary['variable_cost_total'])} · fixes {_money0(summary['fixed_cost_total'])}",
            )


        left, right = st.columns([1.05, 1], gap="large")

        with left:
            section_title(
                "Performance par logement",
                "brut → après variables → après fixes",
            )

            rows = view["listing_rows"]

            if not rows:
                st.info("Pas de ligne logement sur cette période.")
            else:
                for row in rows:
                    listing_id = str(row.get("listing_id", ""))
                    listing_label = label_value(listing_id, LISTING_LABELS)

                    occupancy = ""
                    if pd.notna(row.get("occupancy_pct")):
                        occupancy = (
                            f"Occupation {float(row.get('occupancy_pct')):.0f}% · "
                            f"{int(row.get('booked_nights', 0))} nuits"
                        )

                    listing_contribution_card(
                        listing=listing_label,
                        gross=_money0(row.get("gross", 0)),
                        after_variables=_money0(row.get("after_variables", 0)),
                        after_fixed=_money0(row.get("after_fixed", 0)),
                        occupancy=occupancy,
                    )

        with right:
            section_title("Coûts de la période", "variables et fixes attribués")

            costs = view["cost_breakdown"]

            if costs.empty:
                st.info("Pas de coûts détaillés pour cette période.")
            else:
                st.plotly_chart(cost_breakdown_chart(costs), use_container_width=True)

            soft_note(
                "Lecture",
                (
                    "Cette page sert à distinguer ce qui génère du chiffre d’affaires de ce qui génère réellement du résultat. "
                    "Le brut aide à piloter les réservations ; l’après variables et l’après fixes disent si cela vaut le coup."
                ),
            )

        section_title("Tendance mensuelle", "brut, après variables, après fixes")

        st.plotly_chart(
            profitability_trend_chart(view["trend"]),
            use_container_width=True,
        )

        section_title("Prix planchers", "utile pour éviter les ventes à perte")

        floor_rows = view["floors"]

        if floor_rows.empty:
            st.info("Pas de données de prix plancher pour cette période.")
        else:
            display_cols = [
                "listing_id",
                "year_month",
                "plancher_accommodation_nightly_excl_cleaning",
                "min_total_nightly_1n_incl_cleaning",
                "min_total_nightly_3n_incl_cleaning",
                "min_total_nightly_7n_incl_cleaning",
                "cleaning_fee_assumption",
                "variable_cost_per_night",
            ]

            display_cols = [c for c in display_cols if c in floor_rows.columns]

            display = floor_rows[display_cols].copy()

            if "listing_id" in display.columns:
                display["listing"] = display["listing_id"].apply(
                    lambda x: label_value(x, LISTING_LABELS)
                )
                display = display.drop(columns=["listing_id"])
                display = display[["listing"] + [c for c in display.columns if c != "listing"]]

            st.dataframe(
                display,
                use_container_width=True,
                hide_index=True,
            )

        with st.expander("Données financières de la période"):
            st.dataframe(
                view["period_monthly"],
                use_container_width=True,
                hide_index=True,
            )

    else:
        global_view = build_portfolio_global_view(
            portfolio_monthly=portfolio_monthly,
            long_term_income=long_term_income,
            unit_fixed_costs=unit_fixed_costs,
            period_start=period_start,
            period_end=period_end,
        )

        summary = global_view["summary"]

        total_revenue = (
            summary["short_term_host_payout"]
            + summary["long_term_rent_net"]
        )

        k1, k2, k3, k4 = st.columns(4)

        with k1:
            metric_card(
                "Revenus portefeuille",
                _money0(total_revenue),
                global_view["period_label"],
            )

        with k2:
            metric_card(
                "CA court séjour",
                _money0(summary["short_term_host_payout"]),
                "locations saisonnières",
            )

        with k3:
            metric_card(
                "Loyers longue durée",
                _money0(summary["long_term_rent_net"]),
                "net période",
            )

        with k4:
            metric_card(
                "Résultat portefeuille",
                _money0(summary["portfolio_cash_result"]),
                "court séjour + longue durée - coûts",
            )
        left, right = st.columns([1.05, 1], gap="large")

        with left:
            section_title("Résultat par portefeuille", "inclut court séjour, longue durée et lots vacants")

            rows = global_view["portfolio_rows"]

            if not rows:
                st.info("Pas de lignes portefeuille pour cette période.")
            else:
                for row in rows:
                    portfolio_id = str(row.get("portfolio_id", ""))

                    listing_contribution_card(
                        listing=portfolio_id,
                        gross=_money0(row.get("short_term_host_payout", 0) + row.get("long_term_rent_net", 0)),
                        after_variables=_money0(row.get("short_term_profit", 0) + row.get("long_term_rent_net", 0)),
                        after_fixed=_money0(row.get("portfolio_cash_result", 0)),
                        occupancy=(
                            f"Longue durée {_money0(row.get('long_term_rent_net', 0))} · "
                            f"vacant {_money0(row.get('fixed_costs_vacant_units', 0))}"
                        ),
                    )

        with right:
            section_title("Lots longue durée / vacants", "ce qui n’apparaît pas dans le court séjour")

            long_rows = global_view["long_term_rows"]
            unit_rows = global_view["unit_cost_rows"]

            if long_rows:
                st.markdown("**Loyers longue durée**")
                st.dataframe(
                    pd.DataFrame(long_rows).rename(
                        columns={
                            "portfolio_id": "Portefeuille",
                            "unit_id": "Lot",
                            "rent": "Loyer",
                        }
                    ),
                    use_container_width=True,
                    hide_index=True,
                )

            if unit_rows:
                st.markdown("**Coûts par lot hors court séjour**")
                st.dataframe(
                    pd.DataFrame(unit_rows).rename(
                        columns={
                            "portfolio_id": "Portefeuille",
                            "unit_id": "Lot",
                            "unit_type": "Type",
                            "cost": "Coût",
                        }
                    ),
                    use_container_width=True,
                    hide_index=True,
                )

            if not long_rows and not unit_rows:
                st.info("Pas de loyers longue durée ou coûts de lots pour cette période.")

        section_title("Tendance portefeuille", "court séjour, longue durée, résultat global")

        st.plotly_chart(
            portfolio_cash_trend_chart(global_view["trend"]),
            use_container_width=True,
        )

        with st.expander("Données portefeuille de la période"):
            st.dataframe(
                global_view["period_portfolio_monthly"],
                use_container_width=True,
                hide_index=True,
            )


