from __future__ import annotations

import streamlit as st

from rental_intel.ui.components import inject_css
from rental_intel.ui.page_modules.cockpit import render_cockpit_page
from rental_intel.ui.page_modules.competitors import render_competitor_deep_dive_page
from rental_intel.ui.page_modules.market import render_market_page
from rental_intel.ui.page_modules.operations import render_operations_page
from rental_intel.ui.page_modules.outlook import render_outlook_page
from rental_intel.ui.page_modules.profitability import render_profitability_page


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