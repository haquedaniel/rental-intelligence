from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go

from rental_intel.ui.labels import LISTING_LABELS, label_value


def portfolio_price_chart(
    own: pd.DataFrame,
    market: pd.DataFrame,
    goyen: pd.DataFrame,
    market_set_id: str,
    scenario_id: str,
) -> go.Figure:
    fig = go.Figure()

    own_f = own[
        (own["market_set_id"].astype(str) == str(market_set_id))
        & (own["scenario_id"].astype(str) == str(scenario_id))
    ].copy()

    market_f = market[
        (market["market_set_id"].astype(str) == str(market_set_id))
        & (market["scenario_id"].astype(str) == str(scenario_id))
    ].copy()

    if not own_f.empty:
        own_f["check_in_dt"] = pd.to_datetime(own_f["check_in"], errors="coerce")
        own_f = own_f.sort_values(["listing_id", "check_in_dt"])

        for listing_id, group in own_f.groupby("listing_id", dropna=False):
            fig.add_trace(
                go.Scatter(
                    x=group["check_in_dt"],
                    y=group["own_nightly_amount"],
                    mode="lines+markers",
                    name=label_value(listing_id, LISTING_LABELS),
                    hovertemplate=(
                        "<b>%{fullData.name}</b><br>"
                        "Date: %{x|%d/%m/%Y}<br>"
                        "Notre prix: %{y:.0f} €/nuit"
                        "<extra></extra>"
                    ),
                )
            )

    if not market_f.empty:
        market_f["check_in_dt"] = pd.to_datetime(market_f["check_in"], errors="coerce")

        available_mask = market_f["available"].astype(bool)

        if "status" in market_f.columns:
            available_mask = available_mask | market_f["status"].astype(str).eq(
                "success_available"
            )

        market_f = market_f[
            available_mask
            & market_f["normalised_competitor_nightly"].notna()
        ].copy()

        for competitor_id, group in market_f.groupby("competitor_id", dropna=False):
            name = str(competitor_id)
            fig.add_trace(
                go.Scatter(
                    x=group["check_in_dt"],
                    y=group["normalised_competitor_nightly"],
                    mode="markers",
                    name=name,
                    marker=dict(size=9, opacity=0.8),
                    hovertemplate=(
                        "<b>%{fullData.name}</b><br>"
                        "Date: %{x|%d/%m/%Y}<br>"
                        "Prix normalisé: %{y:.0f} €/nuit"
                        "<extra></extra>"
                    ),
                )
            )

        market_median = (
            market_f.groupby("check_in_dt", dropna=False)["normalised_competitor_nightly"]
            .median()
            .reset_index()
            .sort_values("check_in_dt")
        )

        if not market_median.empty:
            fig.add_trace(
                go.Scatter(
                    x=market_median["check_in_dt"],
                    y=market_median["normalised_competitor_nightly"],
                    mode="lines+markers",
                    name="Médiane marché",
                    line=dict(width=3, dash="dash"),
                    hovertemplate=(
                        "<b>Médiane marché</b><br>"
                        "Date: %{x|%d/%m/%Y}<br>"
                        "%{y:.0f} €/nuit"
                        "<extra></extra>"
                    ),
                )
            )

    if not goyen.empty:
        g = goyen.copy()
        g["date_dt"] = pd.to_datetime(g["date"], errors="coerce")
        g = g[g["available"] & g["price"].notna()].sort_values("date_dt")

        if not g.empty:
            fig.add_trace(
                go.Scatter(
                    x=g["date_dt"],
                    y=g["price"],
                    mode="lines",
                    name="Le Goyen",
                    line=dict(width=2, dash="dot"),
                    opacity=0.55,
                    hovertemplate=(
                        "<b>Le Goyen</b><br>"
                        "Date: %{x|%d/%m/%Y}<br>"
                        "Prix: %{y:.0f} €/nuit"
                        "<extra></extra>"
                    ),
                )
            )

    fig.update_layout(
        height=520,
        margin=dict(l=20, r=20, t=40, b=20),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="left",
            x=0,
        ),
        xaxis_title="Date de séjour",
        yaxis_title="Prix / nuit",
        hovermode="closest",
    )

    return fig

def market_tension_chart(benchmark: pd.DataFrame, market_set_id: str, scenario_id: str) -> go.Figure:
    df = benchmark[
        (benchmark["market_set_id"].astype(str) == str(market_set_id))
        & (benchmark["scenario_id"].astype(str) == str(scenario_id))
    ].copy()

    fig = go.Figure()

    if df.empty:
        fig.update_layout(height=260)
        return fig

    df["check_in_dt"] = pd.to_datetime(df["check_in"], errors="coerce")
    df = df.sort_values("check_in_dt")

    fig.add_trace(
        go.Bar(
            x=df["check_in_dt"],
            y=df["market_availability_rate"],
            name="Disponibilité marché",
            text=[
                f"{int(a)}/{int(c)}"
                if pd.notna(a) and pd.notna(c)
                else ""
                for a, c in zip(df["competitors_available"], df["competitors_checked"])
            ],
            textposition="outside",
            hovertemplate=(
                "Date: %{x|%d/%m/%Y}<br>"
                "Disponibilité: %{y:.0f}%<br>"
                "<extra></extra>"
            ),
        )
    )

    fig.update_layout(
        height=260,
        margin=dict(l=20, r=20, t=30, b=20),
        yaxis_title="% concurrents disponibles",
        xaxis_title="Date de séjour",
        yaxis=dict(range=[0, 110]),
        showlegend=False,
    )

    return fig


def goyen_daily_chart(goyen: pd.DataFrame) -> go.Figure:
    fig = go.Figure()

    if goyen.empty:
        fig.update_layout(height=320)
        return fig

    g = goyen.copy()
    g["date_dt"] = pd.to_datetime(g["date"], errors="coerce")
    g = g.sort_values("date_dt")

    available = g[g["available"] & g["price"].notna()]
    unavailable = g[~g["available"]]

    if not available.empty:
        fig.add_trace(
            go.Scatter(
                x=available["date_dt"],
                y=available["price"],
                mode="lines+markers",
                name="Prix Le Goyen",
                hovertemplate=(
                    "Date: %{x|%d/%m/%Y}<br>"
                    "Prix: %{y:.0f} €"
                    "<extra></extra>"
                ),
            )
        )

    if not unavailable.empty:
        fig.add_trace(
            go.Scatter(
                x=unavailable["date_dt"],
                y=[available["price"].median() if not available.empty else 0] * len(unavailable),
                mode="markers",
                name="Indisponible",
                marker=dict(size=10, symbol="x"),
                hovertemplate="Date indisponible: %{x|%d/%m/%Y}<extra></extra>",
            )
        )

    fig.update_layout(
        height=360,
        margin=dict(l=20, r=20, t=35, b=20),
        xaxis_title="Date",
        yaxis_title="Prix / nuit",
        legend=dict(orientation="h"),
    )

    return fig

def profitability_trend_chart(trend: pd.DataFrame) -> go.Figure:
    fig = go.Figure()

    if trend.empty:
        fig.update_layout(height=320)
        return fig

    df = trend.copy()
    df["year_month_dt"] = pd.to_datetime(df["year_month"].astype(str) + "-01", errors="coerce")

    for col, name in [
        ("gross", "Brut"),
        ("after_variables", "Après variables"),
        ("after_fixed", "Après fixes"),
    ]:
        if col in df.columns:
            fig.add_trace(
                go.Scatter(
                    x=df["year_month_dt"],
                    y=df[col],
                    mode="lines+markers",
                    name=name,
                    hovertemplate=(
                        "<b>%{fullData.name}</b><br>"
                        "%{x|%m/%Y}<br>"
                        "%{y:.0f} €"
                        "<extra></extra>"
                    ),
                )
            )

    fig.update_layout(
        height=340,
        margin=dict(l=20, r=20, t=35, b=20),
        legend=dict(orientation="h"),
        xaxis_title="Mois",
        yaxis_title="Montant",
        hovermode="x unified",
    )

    return fig


def cost_breakdown_chart(costs: pd.DataFrame) -> go.Figure:
    fig = go.Figure()

    if costs.empty:
        fig.update_layout(height=320)
        return fig

    df = costs.copy().sort_values("amount", ascending=True)

    fig.add_trace(
        go.Bar(
            x=df["amount"],
            y=df["category"],
            orientation="h",
            text=df["amount"].round(0),
            textposition="auto",
            hovertemplate=(
                "<b>%{y}</b><br>"
                "%{x:.0f} €"
                "<extra></extra>"
            ),
        )
    )

    fig.update_layout(
        height=max(320, 32 * len(df)),
        margin=dict(l=20, r=20, t=20, b=20),
        xaxis_title="Montant",
        yaxis_title="",
        showlegend=False,
    )

    return fig


def portfolio_cash_trend_chart(trend: pd.DataFrame) -> go.Figure:
    fig = go.Figure()

    if trend.empty:
        fig.update_layout(height=340)
        return fig

    df = trend.copy()
    df["year_month_dt"] = pd.to_datetime(df["year_month"].astype(str) + "-01", errors="coerce")

    for col, name in [
        ("short_term_host_payout", "CA court séjour"),
        ("short_term_profit", "Résultat court séjour"),
        ("long_term_rent_net", "Loyers longue durée"),
        ("portfolio_cash_result", "Résultat portefeuille"),
    ]:
        if col in df.columns:
            fig.add_trace(
                go.Scatter(
                    x=df["year_month_dt"],
                    y=df[col],
                    mode="lines+markers",
                    name=name,
                    hovertemplate=(
                        "<b>%{fullData.name}</b><br>"
                        "%{x|%m/%Y}<br>"
                        "%{y:.0f} €"
                        "<extra></extra>"
                    ),
                )
            )

    fig.update_layout(
        height=360,
        margin=dict(l=20, r=20, t=35, b=20),
        legend=dict(orientation="h"),
        xaxis_title="Mois",
        yaxis_title="Montant",
        hovermode="x unified",
    )

    return fig