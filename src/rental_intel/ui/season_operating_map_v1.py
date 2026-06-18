from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from html import escape
from typing import Iterable, Optional

import pandas as pd
import streamlit as st
from streamlit.components.v1 import html as components_html


FR_MONTHS = {
    1: "Janvier",
    2: "Février",
    3: "Mars",
    4: "Avril",
    5: "Mai",
    6: "Juin",
    7: "Juillet",
    8: "Août",
    9: "Septembre",
    10: "Octobre",
    11: "Novembre",
    12: "Décembre",
}

CANCELLED_STATUSES = {
    "cancelled",
    "canceled",
    "annulee",
    "annulée",
    "annulation",
    "no_show",
    "noshow",
}


@dataclass(frozen=True)
class ListingRow:
    listing_id: str
    listing_name: str
    subtitle: str = ""
    image_url: str = ""


def _to_date(value) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return pd.to_datetime(value).date()


def _pct(day: date, start: date, total_days: int) -> float:
    return max(0.0, min(100.0, ((day - start).days / max(total_days, 1)) * 100.0))


def _segment_style(start_day: date, end_day: date, period_start: date, period_end: date) -> str:
    total_days = (period_end - period_start).days
    clipped_start = max(start_day, period_start)
    clipped_end = min(end_day, period_end)
    left = _pct(clipped_start, period_start, total_days)
    width = max(0.35, _pct(clipped_end, period_start, total_days) - left)
    return f"left:{left:.4f}%;width:{width:.4f}%;"


def _point_style(day: date, period_start: date, period_end: date) -> str:
    total_days = (period_end - period_start).days
    left = _pct(day, period_start, total_days)
    return f"left:{left:.4f}%;"


def _date_range(start_day: date, end_day: date) -> Iterable[date]:
    d = start_day
    while d < end_day:
        yield d
        d += timedelta(days=1)


def _status_is_active(status: object) -> bool:
    if status is None or pd.isna(status):
        return True
    value = str(status).strip().lower().replace(" ", "_")
    return value not in CANCELLED_STATUSES


def _first_existing_col(df: pd.DataFrame, names: list[str]) -> Optional[str]:
    for name in names:
        if name in df.columns:
            return name
    return None


def _normalise_reservations(reservations_df: pd.DataFrame) -> pd.DataFrame:
    if reservations_df is None or reservations_df.empty:
        return pd.DataFrame(columns=["listing_id", "listing_name", "arrival", "departure", "status"])

    df = reservations_df.copy()
    required = {"listing_id", "arrival", "departure"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"reservations_df is missing required columns: {sorted(missing)}")

    if "listing_name" not in df.columns:
        df["listing_name"] = df["listing_id"].astype(str)
    if "status" not in df.columns:
        df["status"] = "confirmed"

    df["arrival"] = pd.to_datetime(df["arrival"]).dt.date
    df["departure"] = pd.to_datetime(df["departure"]).dt.date
    df["listing_id"] = df["listing_id"].astype(str)
    df = df[df["status"].map(_status_is_active)]
    df = df[df["departure"] > df["arrival"]]
    return df


def _normalise_listing_rows(
    reservations_df: pd.DataFrame,
    listing_meta_df: Optional[pd.DataFrame],
) -> list[ListingRow]:
    rows: list[ListingRow] = []

    if listing_meta_df is not None and not listing_meta_df.empty:
        meta = listing_meta_df.copy()
        if "listing_id" not in meta.columns:
            raise ValueError("listing_meta_df must contain listing_id when provided")
        if "listing_name" not in meta.columns:
            meta["listing_name"] = meta["listing_id"].astype(str)
        for _, r in meta.drop_duplicates("listing_id").iterrows():
            rows.append(
                ListingRow(
                    listing_id=str(r.get("listing_id", "")),
                    listing_name=str(r.get("listing_name", r.get("name", r.get("listing_id", "")))),
                    subtitle=str(r.get("subtitle", r.get("capacity_label", "")) or ""),
                    image_url=str(r.get("image_url", r.get("photo_url", "")) or ""),
                )
            )

    known_ids = {r.listing_id for r in rows}
    if reservations_df is not None and not reservations_df.empty:
        for _, r in reservations_df[["listing_id", "listing_name"]].drop_duplicates("listing_id").iterrows():
            lid = str(r["listing_id"])
            if lid not in known_ids:
                rows.append(ListingRow(lid, str(r["listing_name"]), "", ""))

    return rows


def _normalise_blocks(blocked_df: Optional[pd.DataFrame]) -> pd.DataFrame:
    if blocked_df is None or blocked_df.empty:
        return pd.DataFrame(columns=["listing_id", "start", "end", "reason"])
    df = blocked_df.copy()
    start_col = _first_existing_col(df, ["start", "from", "date_start", "arrival"])
    end_col = _first_existing_col(df, ["end", "to", "date_end", "departure"])
    if "listing_id" not in df.columns or not start_col or not end_col:
        raise ValueError("blocked_df must contain listing_id and start/end date columns")
    df["listing_id"] = df["listing_id"].astype(str)
    df["start"] = pd.to_datetime(df[start_col]).dt.date
    df["end"] = pd.to_datetime(df[end_col]).dt.date
    df["reason"] = df.get("reason", "Blocage")
    return df[df["end"] > df["start"]]


def _normalise_price_signals(pricing_signals_df: Optional[pd.DataFrame]) -> pd.DataFrame:
    if pricing_signals_df is None or pricing_signals_df.empty:
        return pd.DataFrame(columns=["listing_id", "start", "end", "signal", "label"])

    df = pricing_signals_df.copy()
    start_col = _first_existing_col(df, ["start", "date_start", "arrival", "period_start"])
    end_col = _first_existing_col(df, ["end", "date_end", "departure", "period_end"])
    signal_col = _first_existing_col(df, ["signal", "signal_type", "price_signal", "tag"])
    if "listing_id" not in df.columns or not start_col or not end_col or not signal_col:
        raise ValueError("pricing_signals_df must contain listing_id, start/end, and signal columns")

    def clean_signal(value: object) -> str:
        s = str(value).lower().strip()
        if s in {"under", "underpriced", "below", "below_market", "sous_tarif", "sous-tarif", "très sous marché"}:
            return "under"
        if s in {"over", "overpriced", "above", "above_market", "sur_tarif", "sur-tarif", "trop cher"}:
            return "over"
        return s

    df["listing_id"] = df["listing_id"].astype(str)
    df["start"] = pd.to_datetime(df[start_col]).dt.date
    df["end"] = pd.to_datetime(df[end_col]).dt.date
    df["signal"] = df[signal_col].map(clean_signal)
    df["label"] = df.get("label", df["signal"])
    return df[df["end"] > df["start"]]


def _normalise_cleanings(cleaning_df: Optional[pd.DataFrame]) -> pd.DataFrame:
    if cleaning_df is None or cleaning_df.empty:
        return pd.DataFrame(columns=["listing_id", "date", "status", "label"])

    df = cleaning_df.copy()
    date_col = _first_existing_col(df, ["date", "cleaning_date", "scheduled_date", "mission_date", "departure"])
    status_col = _first_existing_col(df, ["status", "mission_status", "state"])
    if "listing_id" not in df.columns or not date_col:
        raise ValueError("cleaning_df must contain listing_id and a date column")
    df["listing_id"] = df["listing_id"].astype(str)
    df["date"] = pd.to_datetime(df[date_col]).dt.date
    df["status"] = df[status_col].astype(str) if status_col else "planned"
    df["label"] = df.get("label", "Ménage")
    return df


def _cleaning_status_kind(status: object) -> str:
    s = str(status).lower().strip()
    if any(token in s for token in ["confirm", "propose", "created", "pending", "todo", "à confirmer", "a confirmer"]):
        return "confirm"
    return "planned"


def _detect_one_night_gaps(listing_res: pd.DataFrame, period_start: date, period_end: date) -> list[tuple[date, date]]:
    if listing_res.empty:
        return []
    intervals = (
        listing_res[["arrival", "departure"]]
        .sort_values("arrival")
        .itertuples(index=False, name=None)
    )
    clipped = []
    for arr, dep in intervals:
        s = max(arr, period_start)
        e = min(dep, period_end)
        if e > s:
            clipped.append((s, e))
    gaps = []
    for (_, prev_end), (next_start, _) in zip(clipped, clipped[1:]):
        gap_nights = (next_start - prev_end).days
        if gap_nights == 1:
            gaps.append((prev_end, next_start))
    return gaps


def _same_day_turnovers(listing_res: pd.DataFrame) -> set[date]:
    departures = set(listing_res["departure"].tolist())
    arrivals = set(listing_res["arrival"].tolist())
    return departures & arrivals


def _build_css(n_weeks: int, total_days: int, single_listing: bool) -> str:
    row_height = 126 if single_listing else 96
    track_top = 34 if single_listing else 28
    event_top = 80 if single_listing else 62
    return f"""
<style>
.opmap-card {{
  --ri-ink:#13212b;
  --ri-muted:#62707c;
  --ri-line:#e6ebef;
  --ri-card:#ffffff;
  --ri-bg:#f7f3ec;
  --ri-green:#8fd6a3;
  --ri-green-strong:#27a66a;
  --ri-yellow:#ffe8a9;
  --ri-yellow-line:#f3c85c;
  --ri-grey:#d7dbe0;
  --ri-blue:#2f8df3;
  --ri-orange:#ff8a2a;
  --ri-red:#e44949;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--ri-card);
  border: 1px solid #dde4ea;
  border-radius: 24px;
  padding: 20px 20px 18px;
  box-shadow: 0 14px 36px rgba(20, 30, 40, .06);
  color: var(--ri-ink);
  overflow-x:auto;
}}
.opmap-titlebar {{
  display:flex;
  justify-content:space-between;
  gap:16px;
  align-items:flex-start;
  margin-bottom:12px;
}}
.opmap-title h3 {{margin:0 0 4px;font-size:23px;letter-spacing:-.02em;}}
.opmap-title p {{margin:0;color:var(--ri-muted);font-size:13px;}}
.opmap-toggle {{display:flex;align-items:center;gap:8px;color:var(--ri-muted);font-size:13px;white-space:nowrap;}}
.opmap-pill {{border:1px solid #d9e1e7;border-radius:12px;padding:7px 11px;background:#fff;color:#24323d;font-weight:650;}}
.opmap-pill.active {{background:#13243a;color:#fff;border-color:#13243a;}}
.opmap-legend {{display:flex;gap:15px;align-items:center;justify-content:center;flex-wrap:wrap;border-top:1px solid var(--ri-line);border-bottom:1px solid var(--ri-line);padding:10px 0 11px;margin-bottom:0;}}
.opmap-leg {{display:flex;align-items:center;gap:6px;color:#364653;font-size:13px;font-weight:600;white-space:nowrap;}}
.opmap-swatch {{width:16px;height:16px;border-radius:5px;display:inline-block;box-shadow:inset 0 0 0 2px rgba(255,255,255,.35);}}
.opmap-swatch.booked {{background:var(--ri-green);border:1px solid #6fc98d;}}
.opmap-swatch.open {{background:var(--ri-yellow);border:1px solid var(--ri-yellow-line);}}
.opmap-swatch.blocked {{background:var(--ri-grey);border:1px solid #bcc4cc;}}
.opmap-swatch.gap {{background:repeating-linear-gradient(135deg, #ffd8a8 0, #ffd8a8 3px, #fff2df 3px, #fff2df 7px);border:1px solid #ffad5b;}}
.opmap-signal-dot {{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:850;line-height:1;color:#fff;}}
.opmap-signal-dot.under {{background:var(--ri-blue);}}
.opmap-signal-dot.over {{background:var(--ri-orange);}}
.opmap-signal-dot.risk {{background:transparent;color:var(--ri-red);font-size:18px;}}
.opmap-grid {{min-width:1040px;}}
.opmap-week-head {{display:grid;grid-template-columns:220px 1fr;border-bottom:1px solid var(--ri-line);}}
.opmap-week-spacer {{border-right:1px solid var(--ri-line);}}
.opmap-weeks {{display:grid;grid-template-columns:repeat({n_weeks}, minmax(72px, 1fr));}}
.opmap-week {{position:relative;text-align:center;min-height:56px;border-right:1px solid var(--ri-line);padding:7px 4px 4px;}}
.opmap-week:last-child {{border-right:0;}}
.opmap-month {{font-weight:800;color:#647584;font-size:14px;line-height:18px;}}
.opmap-week-label {{font-size:12px;color:#6d7a85;font-weight:700;margin-top:2px;}}
.opmap-row {{display:grid;grid-template-columns:220px 1fr;border-bottom:1px solid var(--ri-line);min-height:{row_height}px;}}
.opmap-row:last-child {{border-bottom:0;}}
.opmap-listing {{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 0;border-right:1px solid var(--ri-line);}}
.opmap-thumb {{width:66px;height:52px;border-radius:10px;object-fit:cover;border:1px solid #dbe2e8;box-shadow:0 4px 12px rgba(30,40,50,.08);}}
.opmap-thumb-fallback {{width:66px;height:52px;border-radius:10px;background:linear-gradient(135deg,#e9f2fb,#f7efe0);display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:900;color:#25425f;border:1px solid #dbe2e8;}}
.opmap-listing-name {{font-weight:850;font-size:15px;letter-spacing:-.01em;line-height:1.1;}}
.opmap-listing-sub {{font-size:12px;color:var(--ri-muted);margin-top:4px;line-height:1.2;}}
.opmap-timeline {{position:relative;min-height:{row_height}px;background-image:linear-gradient(to right, rgba(30,50,70,.045) 1px, transparent 1px), linear-gradient(to right, rgba(30,50,70,.018) 1px, transparent 1px);background-size:calc(100% / {n_weeks}) 100%, calc(100% / {total_days}) 100%;}}
.opmap-track-base {{position:absolute;left:0;right:0;top:{track_top}px;height:28px;border-radius:3px;background:#fff4cf;border:1px solid #f1d98e;opacity:.88;}}
.opmap-seg {{position:absolute;top:{track_top}px;height:28px;border-radius:3px;border:1px solid transparent;box-sizing:border-box;}}
.opmap-seg.booked {{background:linear-gradient(180deg, rgba(160,222,176,.96), rgba(124,205,150,.96));border-color:#7bcf99;box-shadow:0 3px 8px rgba(41,150,96,.10);}}
.opmap-seg.blocked {{background:linear-gradient(180deg, #e1e5e9, #d1d7dd);border-color:#c2cad2;}}
.opmap-seg.gap {{background:repeating-linear-gradient(135deg,#ffcc8e 0,#ffcc8e 4px,#fff4df 4px,#fff4df 8px);border-color:#ff9f45;box-shadow:0 0 0 1px rgba(255,158,67,.15);}}
.opmap-price {{position:absolute;top:{track_top - 9}px;transform:translateX(-50%);width:22px;height:22px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:950;font-size:12px;border:2px solid #fff;box-shadow:0 5px 11px rgba(20,30,40,.14);z-index:8;}}
.opmap-price.under {{background:var(--ri-blue);}}
.opmap-price.over {{background:var(--ri-orange);}}
.opmap-risk {{position:absolute;top:{event_top - 21}px;transform:translateX(-50%);color:var(--ri-red);font-size:18px;font-weight:900;text-shadow:0 1px 0 #fff;z-index:9;}}
.opmap-event {{position:absolute;top:{event_top}px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;z-index:7;}}
.opmap-event .event-dot {{width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:950;border:2px solid #fff;box-shadow:0 4px 10px rgba(25,35,45,.10);}}
.opmap-event.arrival .event-dot {{background:#2fb96d;color:#fff;}}
.opmap-event.departure .event-dot {{background:#ff941f;color:#fff;}}
.opmap-event.cleaning .event-dot {{background:#fff;color:#9a6a32;border-color:#ead8c1;}}
.opmap-event.cleaning-confirm .event-dot {{background:#fff;color:#7b54be;border-color:#d9c7ff;}}
.opmap-event .event-label {{font-size:9px;color:#70808c;font-weight:750;background:rgba(255,255,255,.88);padding:1px 4px;border-radius:999px;white-space:nowrap;}}
.opmap-single .opmap-grid {{min-width:920px;}}
.opmap-single .opmap-listing {{align-items:flex-start;padding-top:24px;}}
@media (max-width: 760px) {{
  .opmap-card {{padding:14px;border-radius:18px;}}
  .opmap-titlebar {{flex-direction:column;}}
  .opmap-grid {{min-width:900px;}}
}}
</style>
"""


def render_season_operating_map(
    reservations_df: pd.DataFrame,
    start_date,
    end_date,
    *,
    listing_meta_df: Optional[pd.DataFrame] = None,
    cleaning_df: Optional[pd.DataFrame] = None,
    pricing_signals_df: Optional[pd.DataFrame] = None,
    blocked_df: Optional[pd.DataFrame] = None,
    title: str = "Carte opérationnelle de la saison",
    subtitle: str = "Réservations, disponibilités, trous, signaux prix et opérations sur une même ligne de temps.",
    show_event_labels: bool = False,
) -> None:
    """Render a day-accurate, week-grouped operating map in Streamlit.

    Required reservations_df columns:
        listing_id, arrival, departure

    Useful optional reservation columns:
        listing_name, status

    Optional listing_meta_df columns:
        listing_id, listing_name, subtitle, image_url

    Optional cleaning_df columns:
        listing_id, date/cleaning_date/scheduled_date, status

    Optional pricing_signals_df columns:
        listing_id, start/end, signal
        signal values are normalised from underpriced/below_market/sous_tarif and
        overpriced/above_market/sur_tarif.

    Optional blocked_df columns:
        listing_id, start/end, reason
    """
    period_start = _to_date(start_date)
    period_end = _to_date(end_date)
    if period_end <= period_start:
        raise ValueError("end_date must be after start_date")

    res = _normalise_reservations(reservations_df)
    res = res[(res["departure"] > period_start) & (res["arrival"] < period_end)]
    listings = _normalise_listing_rows(res, listing_meta_df)
    if not listings:
        st.info("Aucune réservation ou logement à afficher pour cette période.")
        return

    blocks = _normalise_blocks(blocked_df)
    blocks = blocks[(blocks["end"] > period_start) & (blocks["start"] < period_end)]
    price_signals = _normalise_price_signals(pricing_signals_df)
    price_signals = price_signals[(price_signals["end"] > period_start) & (price_signals["start"] < period_end)]
    cleanings = _normalise_cleanings(cleaning_df)
    cleanings = cleanings[(cleanings["date"] >= period_start) & (cleanings["date"] < period_end)]

    total_days = (period_end - period_start).days
    week_starts = [period_start + timedelta(days=i) for i in range(0, total_days, 7)]
    n_weeks = len(week_starts)
    single_listing = len(listings) == 1

    css = _build_css(n_weeks=n_weeks, total_days=total_days, single_listing=single_listing)

    legend = """
    <div class="opmap-legend">
      <span class="opmap-leg"><span class="opmap-swatch booked"></span>Réservé</span>
      <span class="opmap-leg"><span class="opmap-swatch open"></span>Ouvert</span>
      <span class="opmap-leg"><span class="opmap-swatch blocked"></span>Blocage</span>
      <span class="opmap-leg"><span class="opmap-swatch gap"></span>Trou (1 nuit)</span>
      <span class="opmap-leg"><span class="opmap-signal-dot under">€</span>Sous-tarif</span>
      <span class="opmap-leg"><span class="opmap-signal-dot over">€</span>Sur-tarif</span>
      <span class="opmap-leg"><span class="opmap-signal-dot risk">▲</span>Risque opé.</span>
    </div>
    """

    week_cells = []
    prev_month = None
    for ws in week_starts:
        we = min(ws + timedelta(days=7), period_end)
        month = FR_MONTHS[ws.month] if ws.month != prev_month else ""
        prev_month = ws.month
        label = f"{ws:%d}–{(we - timedelta(days=1)):%d}"
        week_cells.append(
            f"<div class='opmap-week'><div class='opmap-month'>{escape(month)}</div><div class='opmap-week-label'>{label}</div></div>"
        )

    rows_html = []
    for listing in listings:
        lid = listing.listing_id
        listing_res = res[res["listing_id"] == lid].sort_values("arrival")
        listing_blocks = blocks[blocks["listing_id"] == lid]
        listing_prices = price_signals[price_signals["listing_id"] == lid]
        listing_cleanings = cleanings[cleanings["listing_id"] == lid]

        segs = ["<div class='opmap-track-base' title='Nuits ouvertes'></div>"]
        for _, b in listing_blocks.iterrows():
            segs.append(
                f"<div class='opmap-seg blocked' style='{_segment_style(b['start'], b['end'], period_start, period_end)}' title='Blocage'></div>"
            )
        for _, r in listing_res.iterrows():
            nights = (min(r["departure"], period_end) - max(r["arrival"], period_start)).days
            title_attr = escape(f"{r['listing_name']} · {r['arrival']} → {r['departure']} · {nights} nuit(s)")
            segs.append(
                f"<div class='opmap-seg booked' style='{_segment_style(r['arrival'], r['departure'], period_start, period_end)}' title='{title_attr}'></div>"
            )
        for gs, ge in _detect_one_night_gaps(listing_res, period_start, period_end):
            segs.append(
                f"<div class='opmap-seg gap' style='{_segment_style(gs, ge, period_start, period_end)}' title='Trou de 1 nuit'></div>"
            )

        markers = []
        for _, p in listing_prices.iterrows():
            mid = p["start"] + timedelta(days=max(0, (p["end"] - p["start"]).days // 2))
            cls = "under" if p["signal"] == "under" else "over" if p["signal"] == "over" else "under"
            label = "Sous-tarif" if cls == "under" else "Sur-tarif"
            markers.append(
                f"<div class='opmap-price {cls}' style='{_point_style(mid, period_start, period_end)}' title='{escape(label)}'>€</div>"
            )

        for d in _same_day_turnovers(listing_res):
            if period_start <= d < period_end:
                markers.append(
                    f"<div class='opmap-risk' style='{_point_style(d, period_start, period_end)}' title='Risque opérationnel : départ et arrivée le même jour'>▲</div>"
                )

        events = []
        # arrivals and departures from reservations
        for _, r in listing_res.iterrows():
            arr = r["arrival"]
            dep = r["departure"]
            if period_start <= arr < period_end:
                events.append((arr, "arrival", "↑", "Arr."))
            if period_start <= dep < period_end:
                events.append((dep, "departure", "↓", "Dép."))

        # cleaning: if explicit cleaning exists, show status; otherwise derive a "to confirm" cleaning on each departure date
        explicit_cleaning_dates = set(listing_cleanings["date"].tolist())
        for _, c in listing_cleanings.iterrows():
            kind = _cleaning_status_kind(c["status"])
            cls = "cleaning-confirm" if kind == "confirm" else "cleaning"
            label = "À confirmer" if kind == "confirm" else "Ménage"
            events.append((c["date"], cls, "🧹", label))
        for dep in sorted(set(listing_res["departure"].tolist())):
            if period_start <= dep < period_end and dep not in explicit_cleaning_dates:
                events.append((dep, "cleaning-confirm", "🧹", "À confirmer"))

        for d, cls, icon, label in events:
            label_html = f"<span class='event-label'>{escape(label)}</span>" if show_event_labels else ""
            markers.append(
                f"<div class='opmap-event {cls}' style='{_point_style(d, period_start, period_end)}' title='{escape(label)}'><span class='event-dot'>{icon}</span>{label_html}</div>"
            )

        if listing.image_url:
            thumb = f"<img class='opmap-thumb' src='{escape(listing.image_url)}' alt=''>"
        else:
            initial = escape(listing.listing_name[:1].upper() or "L")
            thumb = f"<div class='opmap-thumb-fallback'>{initial}</div>"

        rows_html.append(
            f"""
            <div class="opmap-row">
              <div class="opmap-listing">
                {thumb}
                <div>
                  <div class="opmap-listing-name">{escape(listing.listing_name)}</div>
                  <div class="opmap-listing-sub">{escape(listing.subtitle)}</div>
                </div>
              </div>
              <div class="opmap-timeline">
                {''.join(segs)}
                {''.join(markers)}
              </div>
            </div>
            """
        )

    card_class = "opmap-card opmap-single" if single_listing else "opmap-card"
    html = f"""
    {css}
    <div class="{card_class}">
      <div class="opmap-titlebar">
        <div class="opmap-title">
          <h3>{escape(title)}</h3>
          <p>{escape(subtitle)}</p>
        </div>
        <div class="opmap-toggle">
          <span>Affichage</span>
          <span class="opmap-pill active">Semaines</span>
          <span class="opmap-pill">Jours</span>
        </div>
      </div>
      {legend}
      <div class="opmap-grid">
        <div class="opmap-week-head">
          <div class="opmap-week-spacer"></div>
          <div class="opmap-weeks">{''.join(week_cells)}</div>
        </div>
        {''.join(rows_html)}
      </div>
      <div class="opmap-legend" style="justify-content:center;border-bottom:0;margin-top:8px;padding-bottom:0;">
        <span class="opmap-leg"><span class="opmap-signal-dot" style="background:#2fb96d">↑</span>Arrivée</span>
        <span class="opmap-leg"><span class="opmap-signal-dot" style="background:#ff941f">↓</span>Départ</span>
        <span class="opmap-leg"><span class="opmap-signal-dot" style="background:#fff;color:#9a6a32;border:1px solid #ead8c1">🧹</span>Ménage planifié</span>
        <span class="opmap-leg"><span class="opmap-signal-dot" style="background:#fff;color:#7b54be;border:1px solid #d9c7ff">🧹</span>Ménage à confirmer</span>
      </div>
    </div>
    """
    # Render in a Streamlit HTML component rather than st.markdown.
    # Some Streamlit/theme combinations display large HTML strings as escaped
    # text/code blocks; the component iframe reliably renders the CSS grid.
    row_height = 126 if single_listing else 96
    component_height = min(900, max(360, 210 + (row_height * len(listings))))
    components_html(html, height=component_height, scrolling=True)
