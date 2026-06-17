from __future__ import annotations

import streamlit as st

from rental_intel.ui.components import inject_css
from rental_intel.ui.page_modules.cockpit import render_cockpit_page
from rental_intel.ui.page_modules.competitors import render_competitor_deep_dive_page
from rental_intel.ui.page_modules.market import render_market_page
from rental_intel.ui.page_modules.operations import render_operations_page
from rental_intel.ui.page_modules.outlook import render_outlook_page
from rental_intel.ui.page_modules.profitability import render_profitability_page
from rental_intel.ui.page_modules.cleaning_reports import render_cleaning_reports_page
from rental_intel.ui.page_modules.web_analytics import render_web_analytics_page


st.set_page_config(
    page_title="Rental Intelligence",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

inject_css()


PAGES = {
    "01 · Cockpit": render_cockpit_page,
    "02 · Outlook": render_outlook_page,
    "03 · Analyse marché": render_market_page,
    "04 · Drill-down concurrents": render_competitor_deep_dive_page,
    "05 · Rentabilité": render_profitability_page,
    "06 · Opérations": render_operations_page,
    "07 · Rapports ménage": render_cleaning_reports_page,
    "08 · Web analytics": render_web_analytics_page,
}


with st.sidebar:
    st.markdown("## Rental Intelligence")
    st.caption("Cockpit propriétaire / manager")

    page_name = st.radio(
        "Navigation",
        list(PAGES.keys()),
        index=0,
        label_visibility="collapsed",
    )

    st.divider()

    st.caption(
        "Les calculs restent dans les pipelines Python. "
        "Streamlit affiche les vues propriétaire / manager."
    )


PAGES[page_name]()