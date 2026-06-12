from __future__ import annotations

import streamlit as st
import pandas as pd


def inject_css() -> None:
    st.markdown(
        """
        <style>
        :root {
            --ri-bg: #f6f3ee;
            --ri-panel: #ffffff;
            --ri-soft: #fbfaf7;
            --ri-text: #1f2a2e;
            --ri-muted: #718086;
            --ri-line: #e5dfd5;
            --ri-green: #1f8a5b;
            --ri-green-soft: #e9f5ef;
            --ri-amber: #c98219;
            --ri-amber-soft: #fff3df;
            --ri-red: #bf4a45;
            --ri-red-soft: #fae9e8;
            --ri-blue: #3867a6;
            --ri-blue-soft: #e9f0fa;
            --ri-ink: #172124;
        }

        .stApp {
            background: var(--ri-bg);
        }

        .block-container {
            padding-top: 1.5rem;
            padding-bottom: 3rem;
            max-width: 1480px;
        }

        section[data-testid="stSidebar"] {
            background: #172124;
        }

        section[data-testid="stSidebar"] * {
            color: #f4f7f8;
        }

        section[data-testid="stSidebar"] .stRadio label {
            color: #f4f7f8 !important;
        }

        h1, h2, h3 {
            letter-spacing: -0.035em;
        }

        .ri-page-header {
            padding: 0.2rem 0 1.1rem 0;
        }

        .ri-eyebrow {
            color: var(--ri-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 0.78rem;
            font-weight: 800;
            margin-bottom: 0.35rem;
        }

        .ri-page-title {
            color: var(--ri-ink);
            font-size: 2.1rem;
            font-weight: 850;
            line-height: 1.05;
            margin-bottom: 0.35rem;
        }

        .ri-page-subtitle {
            color: var(--ri-muted);
            font-size: 0.96rem;
            max-width: 900px;
        }

        .ri-section-title {
            margin-top: 1.2rem;
            margin-bottom: 0.6rem;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 1rem;
        }

        .ri-section-title strong {
            font-size: 1.25rem;
            color: var(--ri-ink);
            letter-spacing: -0.03em;
        }

        .ri-section-title span {
            color: var(--ri-muted);
            font-size: 0.82rem;
        }

        .ri-card {
            border: 1px solid var(--ri-line);
            border-radius: 18px;
            padding: 18px;
            background: var(--ri-panel);
            box-shadow: 0 10px 26px rgba(31,42,46,0.06);
            height: 100%;
        }

        .ri-card-soft {
            border: 1px solid var(--ri-line);
            border-radius: 18px;
            padding: 18px;
            background: var(--ri-soft);
            height: 100%;
        }

        .ri-kpi-label {
            color: var(--ri-muted);
            font-size: 0.82rem;
            font-weight: 750;
            margin-bottom: 0.25rem;
        }

        .ri-kpi-value {
            color: var(--ri-ink);
            font-size: 1.75rem;
            font-weight: 850;
            letter-spacing: -0.05em;
            margin-bottom: 0.1rem;
        }

        .ri-kpi-sub {
            color: var(--ri-muted);
            font-size: 0.78rem;
        }

        .ri-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.55rem;
            border-radius: 999px;
            font-size: 0.74rem;
            font-weight: 800;
            margin-right: 0.25rem;
            margin-bottom: 0.25rem;
            white-space: nowrap;
        }

        .ri-badge-green {
            background: var(--ri-green-soft);
            color: var(--ri-green);
        }

        .ri-badge-amber {
            background: var(--ri-amber-soft);
            color: var(--ri-amber);
        }

        .ri-badge-red {
            background: var(--ri-red-soft);
            color: var(--ri-red);
        }

        .ri-badge-blue {
            background: var(--ri-blue-soft);
            color: var(--ri-blue);
        }

        .ri-muted {
            color: var(--ri-muted);
            font-size: 0.88rem;
        }

        .ri-small {
            font-size: 0.78rem;
            color: var(--ri-muted);
        }

        .ri-watch {
            border: 1px solid var(--ri-line);
            border-radius: 15px;
            padding: 14px;
            background: #ffffff;
            margin-bottom: 10px;
        }

        .ri-watch-title {
            font-weight: 850;
            color: var(--ri-ink);
            margin-bottom: 4px;
        }

        .ri-watch-meta {
            color: var(--ri-muted);
            font-size: 0.82rem;
            margin-bottom: 6px;
        }

        .ri-source {
            border: 1px solid var(--ri-line);
            border-radius: 15px;
            padding: 14px;
            background: #ffffff;
            margin-bottom: 10px;
        }

        .ri-source-title {
            font-weight: 850;
            color: var(--ri-ink);
        }

        div[data-testid="stMetric"] {
            background: #ffffff;
            border: 1px solid var(--ri-line);
            border-radius: 18px;
            padding: 1rem;
            box-shadow: 0 10px 26px rgba(31,42,46,0.04);
        }

        div[data-testid="stMetricLabel"] {
            color: var(--ri-muted);
        }

        .ri-divider {
            height: 1px;
            background: var(--ri-line);
            margin: 1rem 0;
        }

    /* ---------------- Mobile pass ---------------- */

    @media (max-width: 768px) {
        .block-container {
            padding-top: 1.1rem !important;
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
            padding-bottom: 2rem !important;
        }

        h1 {
            font-size: 1.65rem !important;
            line-height: 1.15 !important;
        }

        h2, h3 {
            line-height: 1.2 !important;
        }

        .ri-page-header {
            padding: 1rem !important;
            border-radius: 18px !important;
            margin-bottom: 1rem !important;
        }

        .ri-page-title {
            font-size: 1.65rem !important;
            line-height: 1.15 !important;
        }

        .ri-page-subtitle {
            font-size: 0.92rem !important;
        }

        .ri-section-title {
            margin-top: 1rem !important;
            margin-bottom: 0.55rem !important;
        }

        .ri-metric-card,
        .ri-watch-card,
        .ri-operation-card,
        .ri-listing-card {
            padding: 0.9rem !important;
            border-radius: 16px !important;
            margin-bottom: 0.65rem !important;
        }

        .ri-metric-label {
            font-size: 0.72rem !important;
        }

        .ri-metric-value {
            font-size: 1.45rem !important;
            line-height: 1.05 !important;
        }

        .ri-metric-caption {
            font-size: 0.78rem !important;
        }

        .ri-operation-date {
            font-size: 0.78rem !important;
            min-width: 3.2rem !important;
        }

        .ri-operation-title {
            font-size: 0.95rem !important;
        }

        .ri-operation-detail {
            font-size: 0.8rem !important;
        }

        .ri-badge {
            font-size: 0.68rem !important;
            padding: 0.18rem 0.45rem !important;
        }

        .ri-calendar-grid,
        .ri-week-grid {
            gap: 0.28rem !important;
        }

        .ri-calendar-day {
            min-height: 2.1rem !important;
            padding: 0.22rem !important;
            font-size: 0.68rem !important;
        }

        .ri-week-cell {
            min-height: 1.55rem !important;
            font-size: 0.65rem !important;
        }

        div[data-testid="stMetric"] {
            padding: 0.25rem 0 !important;
        }

        div[data-testid="stDataFrame"] {
            font-size: 0.75rem !important;
        }

        .stPlotlyChart {
            overflow-x: auto !important;
        }

        section[data-testid="stSidebar"] {
            min-width: 250px !important;
        }
    }

        </style>
        """,
        unsafe_allow_html=True,
    )


def page_header(eyebrow: str, title: str, subtitle: str = "") -> None:
    st.markdown(
        f"""
        <div class="ri-page-header">
            <div class="ri-eyebrow">{eyebrow}</div>
            <div class="ri-page-title">{title}</div>
            <div class="ri-page-subtitle">{subtitle}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def section_title(title: str, subtitle: str = "") -> None:
    st.markdown(
        f"""
        <div class="ri-section-title">
            <strong>{title}</strong>
            <span>{subtitle}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def badge(text: str, kind: str = "blue") -> str:
    kind_class = {
        "green": "ri-badge-green",
        "amber": "ri-badge-amber",
        "red": "ri-badge-red",
        "blue": "ri-badge-blue",
    }.get(kind, "ri-badge-blue")

    return f'<span class="ri-badge {kind_class}">{text}</span>'


def metric_card(label: str, value: str, sub: str = "") -> None:
    st.markdown(
        f"""
        <div class="ri-card">
            <div class="ri-kpi-label">{label}</div>
            <div class="ri-kpi-value">{value}</div>
            <div class="ri-kpi-sub">{sub}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def watch_card(
    title: str,
    meta: str,
    recommendation: str,
    badges: list[tuple[str, str]] | None = None,
) -> None:
    badges = badges or []
    badges_html = "".join(badge(text, kind) for text, kind in badges)

    st.markdown(
        f"""
        <div class="ri-watch">
            <div class="ri-watch-title">{title}</div>
            <div class="ri-watch-meta">{meta}</div>
            <div>{badges_html}</div>
            <div class="ri-muted" style="margin-top: 0.45rem;">{recommendation}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def soft_note(title: str, body: str) -> None:
    st.markdown(
        f"""
        <div class="ri-card-soft">
            <strong>{title}</strong>
            <div class="ri-muted" style="margin-top:0.35rem;">{body}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

def status_dot(status: str) -> str:
    color = {
        "booked": "#1f8a5b",
        "available": "#fff3df",
        "blocked": "#bf4a45",
        "unknown": "#e5dfd5",
    }.get(str(status), "#e5dfd5")

    border = "#e5dfd5" if status == "available" else color

    return (
        f'<span style="display:inline-block;width:11px;height:11px;'
        f'border-radius:999px;background:{color};border:1px solid {border};'
        f'margin-right:3px;"></span>'
    )


def compact_calendar_html(daily, listing_labels: dict[str, str] | None = None) -> str:
    if daily.empty:
        return "<div class='ri-muted'>Pas de données calendrier.</div>"

    listing_labels = listing_labels or {}

    df = daily.copy()
    dates = sorted(df["date"].unique().tolist())
    listings = sorted(df["listing_id"].astype(str).unique().tolist())

    header_cells = "".join(
        f"<th>{pd_date.strftime('%d/%m') if hasattr(pd_date, 'strftime') else pd_date}</th>"
        for pd_date in dates
    )

    rows = []

    for listing in listings:
        g = df[df["listing_id"].astype(str) == listing].set_index("date")
        cells = []

        for d in dates:
            if d in g.index:
                status = str(g.loc[d, "status"])
            else:
                status = "unknown"

            cells.append(f"<td title='{listing} · {d} · {status}'>{status_dot(status)}</td>")

        label = listing_labels.get(listing, listing)
        rows.append(f"<tr><td class='ri-cal-label'>{label}</td>{''.join(cells)}</tr>")

    return f"""
    <div style="overflow-x:auto;">
      <table class="ri-calendar">
        <thead>
          <tr><th></th>{header_cells}</tr>
        </thead>
        <tbody>
          {''.join(rows)}
        </tbody>
      </table>
    </div>
    <style>
      .ri-calendar {{
        border-collapse: separate;
        border-spacing: 3px;
        width: 100%;
        font-size: 0.72rem;
      }}
      .ri-calendar th {{
        color: #718086;
        font-weight: 650;
        text-align: center;
        min-width: 28px;
        white-space: nowrap;
      }}
      .ri-calendar td {{
        text-align: center;
        padding: 2px;
      }}
      .ri-calendar .ri-cal-label {{
        color: #172124;
        font-weight: 800;
        text-align: left;
        min-width: 110px;
        position: sticky;
        left: 0;
        background: #fbfaf7;
      }}
    </style>
    """

def adaptive_calendar_html(
    daily,
    listing_labels: dict[str, str] | None = None,
    daily_threshold_days: int = 70,
) -> str:
    if daily.empty:
        return "<div class='ri-muted'>Pas de données calendrier.</div>"

    listing_labels = listing_labels or {}

    df = daily.copy()
    unique_dates = sorted(df["date"].unique().tolist())
    day_count = len(unique_dates)

    if day_count <= daily_threshold_days:
        return compact_calendar_html(daily, listing_labels=listing_labels)

    return weekly_calendar_html(daily, listing_labels=listing_labels)


def weekly_calendar_html(daily, listing_labels: dict[str, str] | None = None) -> str:
    if daily.empty:
        return "<div class='ri-muted'>Pas de données calendrier.</div>"

    listing_labels = listing_labels or {}

    df = daily.copy()
    df["date_dt"] = pd.to_datetime(df["date"])
    df["week_start"] = df["date_dt"].dt.to_period("W-MON").dt.start_time.dt.date

    weekly = (
        df.groupby(["listing_id", "week_start"], dropna=False)
        .agg(
            nights=("date", "size"),
            booked_nights=("occupied", "sum"),
            available_nights=("available", "sum"),
            blocked_nights=("blocked", "sum"),
        )
        .reset_index()
    )

    weekly["occupancy_rate"] = weekly["booked_nights"] / weekly["nights"]

    week_starts = sorted(weekly["week_start"].unique().tolist())
    listings = sorted(weekly["listing_id"].astype(str).unique().tolist())

    header_cells = "".join(
        f"<th>{w.strftime('%d/%m') if hasattr(w, 'strftime') else w}</th>"
        for w in week_starts
    )

    rows = []

    for listing in listings:
        g = weekly[weekly["listing_id"].astype(str) == listing].set_index("week_start")
        cells = []

        for w in week_starts:
            if w in g.index:
                row = g.loc[w]
                occ = float(row["occupancy_rate"])
                booked = int(row["booked_nights"])
                nights = int(row["nights"])
                blocked = int(row["blocked_nights"])

                if blocked >= nights * 0.5:
                    cls = "ri-week-blocked"
                    label = f"{booked}/{nights}"
                elif occ > 0.5:
                    cls = "ri-week-strong"
                    label = f"{booked}/{nights}"
                elif occ > 0:
                    cls = "ri-week-light"
                    label = f"{booked}/{nights}"
                else:
                    cls = "ri-week-open"
                    label = "0"
            else:
                cls = "ri-week-unknown"
                label = "—"

            cells.append(
                f"<td title='{listing} · semaine {w}'>"
                f"<span class='ri-week-cell {cls}'>{label}</span>"
                f"</td>"
            )

        label = listing_labels.get(listing, listing)
        rows.append(f"<tr><td class='ri-cal-label'>{label}</td>{''.join(cells)}</tr>")

    return f"""
    <div class="ri-muted" style="margin-bottom:0.4rem;">
      Vue hebdomadaire automatique : vert foncé = &gt;50% réservé · vert clair = 1–50% réservé · jaune = ouvert.
    </div>
    <div style="overflow-x:auto;">
      <table class="ri-calendar ri-week-calendar">
        <thead>
          <tr><th></th>{header_cells}</tr>
        </thead>
        <tbody>
          {''.join(rows)}
        </tbody>
      </table>
    </div>
    <style>
      .ri-calendar {{
        border-collapse: separate;
        border-spacing: 4px;
        width: 100%;
        font-size: 0.72rem;
      }}
      .ri-calendar th {{
        color: #718086;
        font-weight: 650;
        text-align: center;
        min-width: 46px;
        white-space: nowrap;
      }}
      .ri-calendar td {{
        text-align: center;
        padding: 2px;
      }}
      .ri-calendar .ri-cal-label {{
        color: #172124;
        font-weight: 800;
        text-align: left;
        min-width: 110px;
        position: sticky;
        left: 0;
        background: #fbfaf7;
      }}
      .ri-week-cell {{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 42px;
        height: 26px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 850;
        border: 1px solid #e5dfd5;
      }}
      .ri-week-strong {{
        background: #1f8a5b;
        color: white;
        border-color: #1f8a5b;
      }}
      .ri-week-light {{
        background: #e9f5ef;
        color: #1f8a5b;
        border-color: #b8dfca;
      }}
      .ri-week-open {{
        background: #fff3df;
        color: #c98219;
        border-color: #f0d7ad;
      }}
      .ri-week-blocked {{
        background: #fae9e8;
        color: #bf4a45;
        border-color: #e4b7b4;
      }}
      .ri-week-unknown {{
        background: #f0ede7;
        color: #718086;
      }}
    </style>
    """

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