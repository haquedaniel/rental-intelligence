from __future__ import annotations


MARKET_TENSION_LABELS = {
    "tight_market": "Marché tendu",
    "moderate_market": "Marché mixte",
    "open_market": "Marché ouvert",
    "thin_sample": "Échantillon faible",
    "insufficient_sample": "Données insuffisantes",
    "technical_failure": "Erreur technique",
    "no_market_data": "Pas de données marché",
}


PRICE_POSITION_LABELS = {
    "well_below_market": "Très sous marché",
    "below_market": "Sous marché",
    "near_market": "Proche marché",
    "above_market": "Au-dessus",
    "well_above_market": "Très au-dessus",
    "no_comparison": "Pas de comparaison fiable",
}


SCENARIO_LABELS = {
    "rolling_7n_family": "7 nuits famille · prochaines dates",
    "rolling_7n_couple": "7 nuits couple · prochaines dates",
    "anchor_7n_family": "7 nuits famille · dates repères",
    "anchor_7n_couple": "7 nuits couple · dates repères",
}


PORTFOLIO_LABELS = {
    "voilerie": "La Voilerie",
    "peskerezh": "La Peskerezh",
}


LISTING_LABELS = {
    "apt2": "Apt 2",
    "apt4": "Apt 4",
    "apt5": "Apt 5",
    "peskerezh_house": "La Peskerezh",
}


def label_value(value: object, mapping: dict[str, str]) -> str:
    if value is None:
        return ""

    text = str(value)
    return mapping.get(text, text)


def money(value: object, decimals: int = 0) -> str:
    try:
        if value != value:
            return "—"
        return f"{float(value):,.{decimals}f} €".replace(",", " ")
    except Exception:
        return "—"


def pct(value: object, decimals: int = 0) -> str:
    try:
        if value != value:
            return "—"
        return f"{float(value):.{decimals}f}%"
    except Exception:
        return "—"