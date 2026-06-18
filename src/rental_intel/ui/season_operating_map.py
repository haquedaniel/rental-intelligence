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

FR_MONTHS_SHORT = {
    1: "janv.",
    2: "févr.",
    3: "mars",
    4: "avr.",
    5: "mai",
    6: "juin",
    7: "juil.",
    8: "août",
    9: "sept.",
    10: "oct.",
    11: "nov.",
    12: "déc.",
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


def _optional_date(value) -> Optional[date]:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    try:
        return _to_date(value)
    except Exception:
        return None


def _week_floor(day: date) -> date:
    """Return Monday of the week containing day."""
    return day - timedelta(days=day.weekday())


def _week_ceil_exclusive(day: date) -> date:
    """Return the Monday after the week containing day, for exclusive ranges."""
    floored = _week_floor(day)
    if day == floored:
        return day
    return floored + timedelta(days=7)


def _pct(day: date, start: date, total_days: int) -> float:
    return max(0.0, min(100.0, ((day - start).days / max(total_days, 1)) * 100.0))


def _segment_style(start_day: date, end_day: date, period_start: date, period_end: date, *, min_width: float = 0.35) -> str:
    total_days = (period_end - period_start).days
    clipped_start = max(start_day, period_start)
    clipped_end = min(end_day, period_end)
    left = _pct(clipped_start, period_start, total_days)
    width = max(min_width, _pct(clipped_end, period_start, total_days) - left)
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
    if df is None or df.empty:
        return None
    for name in names:
        if name in df.columns:
            return name
    return None


def _clean_text(value: object) -> str:
    try:
        if value is None or pd.isna(value):
            return ""
    except Exception:
        pass
    text = str(value or "").strip()
    return "" if text.lower() in {"nan", "none", "nat"} else text


def _reservation_label(row: pd.Series) -> str:
    direct = _clean_text(row.get("guest_name", ""))
    if direct:
        return direct

    first = _clean_text(row.get("guest_first_name", ""))
    last = _clean_text(row.get("guest_last_name", ""))
    name = " ".join(part for part in [first, last] if part).strip()
    if name:
        return name

    channel = _clean_text(row.get("source_system", ""))
    booking_id = _clean_text(row.get("source_booking_id", ""))
    if channel and booking_id:
        return f"{channel} · {booking_id}"
    if channel:
        return channel
    if booking_id:
        return booking_id
    return "Réservation"


def _normalise_reservations(reservations_df: pd.DataFrame) -> pd.DataFrame:
    if reservations_df is None or reservations_df.empty:
        return pd.DataFrame(columns=["listing_id", "listing_name", "arrival", "departure", "status", "reservation_label"])

    df = reservations_df.copy()
    required = {"listing_id", "arrival", "departure"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"reservations_df is missing required columns: {sorted(missing)}")

    if "listing_name" not in df.columns:
        df["listing_name"] = df["listing_id"].astype(str)
    if "status" not in df.columns:
        df["status"] = "confirmed"

    df["arrival"] = pd.to_datetime(df["arrival"], errors="coerce").dt.date
    df["departure"] = pd.to_datetime(df["departure"], errors="coerce").dt.date
    df["listing_id"] = df["listing_id"].astype(str)
    df = df[df["status"].map(_status_is_active)]
    df = df[df["arrival"].notna() & df["departure"].notna()]
    df = df[df["departure"] > df["arrival"]]
    df["reservation_label"] = df.apply(_reservation_label, axis=1)
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
                    image_url=str(r.get("image_url", r.get("photo_url", r.get("thumbnail_url", ""))) or ""),
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
    df["start"] = pd.to_datetime(df[start_col], errors="coerce").dt.date
    df["end"] = pd.to_datetime(df[end_col], errors="coerce").dt.date
    df["reason"] = df.get("reason", "Blocage")
    df = df[df["start"].notna() & df["end"].notna()]
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
        if s in {"under", "underpriced", "below", "below_market", "sous_tarif", "sous-tarif", "très sous marché", "tres sous marche"}:
            return "under"
        if s in {"over", "overpriced", "above", "above_market", "sur_tarif", "sur-tarif", "trop cher"}:
            return "over"
        return s

    df["listing_id"] = df["listing_id"].astype(str)
    df["start"] = pd.to_datetime(df[start_col], errors="coerce").dt.date
    df["end"] = pd.to_datetime(df[end_col], errors="coerce").dt.date
    df["signal"] = df[signal_col].map(clean_signal)
    df["label"] = df.get("label", df["signal"])
    df = df[df["start"].notna() & df["end"].notna()]
    return df[df["end"] > df["start"]]


def _normalise_cleanings(cleaning_df: Optional[pd.DataFrame]) -> pd.DataFrame:
    cols = [
        "listing_id",
        "date",
        "status",
        "label",
        "cleaner_name",
        "window_start",
        "window_end",
        "cleaning_request_id",
        "public_token",
        "total_cost_eur",
    ]
    if cleaning_df is None or cleaning_df.empty:
        return pd.DataFrame(columns=cols)

    df = cleaning_df.copy()
    listing_col = _first_existing_col(df, ["listing_id", "property_id", "property", "listing_name", "property_name"])
    date_col = _first_existing_col(df, ["date", "cleaning_date", "scheduled_date", "mission_date", "departure", "due_date"])
    status_col = _first_existing_col(df, ["status", "mission_status", "state", "badge", "kind"])
    label_col = _first_existing_col(df, ["label", "title", "mission_type", "type"])
    cleaner_col = _first_existing_col(df, ["cleaner_name", "cleaner", "assignee", "assigned_to", "provider_name"])
    window_start_col = _first_existing_col(df, ["window_start", "start", "earliest_date", "available_from", "from_date"])
    window_end_col = _first_existing_col(df, ["window_end", "deadline", "latest_date", "available_until", "to_date", "next_arrival"])
    request_id_col = _first_existing_col(df, ["cleaning_request_id", "request_id", "mission_id", "id"])
    token_col = _first_existing_col(df, ["public_token", "mission_token", "token"])
    total_cost_col = _first_existing_col(df, ["total_cost_eur", "total_cost", "price", "amount"])

    if not listing_col or not date_col and not window_start_col:
        return pd.DataFrame(columns=cols)

    out = pd.DataFrame()
    out["listing_id"] = df[listing_col].astype(str)
    out["date"] = pd.to_datetime(df[date_col], errors="coerce").dt.date if date_col else pd.NaT
    out["status"] = df[status_col].astype(str) if status_col else "planned"
    out["label"] = df[label_col].astype(str) if label_col else "Ménage"
    out["cleaner_name"] = df[cleaner_col].astype(str) if cleaner_col else ""
    out["window_start"] = pd.to_datetime(df[window_start_col], errors="coerce").dt.date if window_start_col else out["date"]
    out["window_end"] = pd.to_datetime(df[window_end_col], errors="coerce").dt.date if window_end_col else pd.NaT
    out["cleaning_request_id"] = df[request_id_col].astype(str) if request_id_col else ""
    out["public_token"] = df[token_col].astype(str) if token_col else ""
    out["total_cost_eur"] = df[total_cost_col] if total_cost_col else ""

    # Fill useful defaults without making assumptions about the cleaner app schema.
    out["window_start"] = out.apply(lambda r: r["window_start"] if pd.notna(r["window_start"]) else r["date"], axis=1)
    out["date"] = out.apply(lambda r: r["date"] if pd.notna(r["date"]) else r["window_start"], axis=1)
    out["window_end"] = out.apply(
        lambda r: r["window_end"] if pd.notna(r["window_end"]) else (r["date"] + timedelta(days=1) if pd.notna(r["date"]) else pd.NaT),
        axis=1,
    )

    out = out[out["date"].notna() | out["window_start"].notna()]
    return out[cols]


def _cleaning_status_kind(status: object) -> str:
    s = str(status).lower().strip()
    pending_tokens = [
        "confirm",
        "propose",
        "created",
        "pending",
        "todo",
        "sent",
        "refused",
        "à confirmer",
        "a confirmer",
        "proposé",
        "proposee",
        "proposée",
    ]
    if any(token in s for token in pending_tokens):
        return "confirm"
    return "planned"


def _cleaner_phrase(cleaner_name: str) -> str:
    cleaner_name = str(cleaner_name or "").strip()
    return cleaner_name if cleaner_name and cleaner_name.lower() not in {"nan", "none"} else ""


def _pending_cleaning_title(status: object, cleaner_name: str, window_end: date) -> str:
    s = str(status or "").lower().strip()
    cleaner = _cleaner_phrase(cleaner_name)
    deadline = f" · échéance {window_end:%d/%m/%Y}" if window_end else ""
    if "sent" in s:
        return f"Ménage envoyé à {cleaner} · en attente d’acceptation{deadline}" if cleaner else f"Ménage envoyé · en attente d’acceptation{deadline}"
    if "refused" in s or "refus" in s:
        return f"Mission refusée par {cleaner}{deadline}" if cleaner else f"Mission refusée{deadline}"
    if "created" in s:
        return f"Ménage créé · à envoyer / confirmer{deadline}"
    return f"Ménage à confirmer{deadline}"


def _planned_cleaning_title(status: object, cleaner_name: str) -> str:
    s = str(status or "").lower().strip()
    cleaner = _cleaner_phrase(cleaner_name)
    suffix = f" · {cleaner}" if cleaner else ""
    if "accepted" in s:
        return f"Ménage accepté{suffix}"
    if "report_submitted" in s or "rapport" in s:
        return f"Rapport envoyé{suffix}"
    if "problem" in s or "probl" in s:
        return f"Problème signalé{suffix}"
    if "completed" in s or "done" in s or "termin" in s:
        return f"Ménage terminé{suffix}"
    return f"Ménage confirmé{suffix}"


def _detect_one_night_gaps(listing_res: pd.DataFrame, period_start: date, period_end: date) -> list[tuple[date, date]]:
    if listing_res.empty:
        return []
    intervals = listing_res[["arrival", "departure"]].sort_values("arrival").itertuples(index=False, name=None)
    clipped: list[tuple[date, date]] = []
    for arr, dep in intervals:
        s = max(arr, period_start)
        e = min(dep, period_end)
        if e > s:
            clipped.append((s, e))
    gaps: list[tuple[date, date]] = []
    for (_, prev_end), (next_start, _) in zip(clipped, clipped[1:]):
        gap_nights = (next_start - prev_end).days
        if gap_nights == 1:
            gaps.append((prev_end, next_start))
    return gaps


def _same_day_turnovers(listing_res: pd.DataFrame) -> set[date]:
    departures = set(listing_res["departure"].tolist())
    arrivals = set(listing_res["arrival"].tolist())
    return departures & arrivals


def _next_arrival_after(listing_res: pd.DataFrame, day: date, display_end: date) -> date:
    candidates = sorted(d for d in listing_res["arrival"].tolist() if d >= day)
    if not candidates:
        return min(day + timedelta(days=2), display_end)
    next_arrival = candidates[0]
    if next_arrival <= day:
        return min(day + timedelta(days=1), display_end)
    return min(next_arrival, display_end)


def _clean_window_end(listing_res: pd.DataFrame, start_day: date, raw_end: Optional[date], display_end: date) -> date:
    if raw_end and raw_end > start_day:
        return min(raw_end, display_end)
    return _next_arrival_after(listing_res, start_day, display_end)


def _week_month_label(ws: date, we_exclusive: date, prev_month: Optional[int]) -> tuple[str, int]:
    end = we_exclusive - timedelta(days=1)
    if ws.month != end.month:
        return f"{FR_MONTHS_SHORT[ws.month]} / {FR_MONTHS_SHORT[end.month]}", end.month
    if ws.month != prev_month:
        return FR_MONTHS[ws.month], ws.month
    return "", ws.month


def _build_css(n_weeks: int, total_days: int, single_listing: bool) -> str:
    row_height = 158 if single_listing else 128
    track_top = 38 if single_listing else 34
    event_top = 74 if single_listing else 68
    cleaning_top = event_top + 30
    return f"""
<style>
.opmap-card {{
  --ri-ink:#13212b;
  --ri-muted:#62707c;
  --ri-line:#e6ebef;
  --ri-line-strong:#d8e0e6;
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
  --ri-purple:#8057c8;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--ri-card);
  border: 1px solid #dde4ea;
  border-radius: 24px;
  padding: 20px 20px 18px;
  box-shadow: 0 14px 36px rgba(20, 30, 40, .06);
  color: var(--ri-ink);
  overflow-x:auto;
  overflow-y:visible;
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
.opmap-grid {{min-width:{max(1040, n_weeks * 86 + 240)}px;}}
.opmap-timeline-wrap {{min-width:0;}}
.opmap-mobile-weeks {{display:none;}}
.opmap-mobile-hint {{display:none;}}
.opmap-week-head {{display:grid;grid-template-columns:240px 1fr;border-bottom:1px solid var(--ri-line);}}
.opmap-week-spacer {{border-right:1px solid var(--ri-line);}}
.opmap-weeks {{display:grid;grid-template-columns:repeat({n_weeks}, minmax(86px, 1fr));}}
.opmap-week {{position:relative;text-align:center;min-height:60px;border-right:1px solid var(--ri-line);padding:8px 4px 4px;}}
.opmap-week:last-child {{border-right:0;}}
.opmap-month {{font-weight:850;color:#647584;font-size:13px;line-height:18px;min-height:18px;}}
.opmap-week-label {{font-size:12px;color:#6d7a85;font-weight:750;margin-top:2px;}}
.opmap-row {{display:grid;grid-template-columns:240px 1fr;border-bottom:1px solid var(--ri-line);min-height:{row_height}px;}}
.opmap-row:last-child {{border-bottom:0;}}
.opmap-listing {{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 0;border-right:1px solid var(--ri-line);}}
.opmap-thumb {{width:76px;height:58px;border-radius:12px;object-fit:cover;border:1px solid #dbe2e8;box-shadow:0 4px 12px rgba(30,40,50,.08);}}
.opmap-thumb-fallback {{width:76px;height:58px;border-radius:12px;background:linear-gradient(135deg,#e9f2fb,#f7efe0);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#25425f;border:1px solid #dbe2e8;}}
.opmap-listing-name {{font-weight:850;font-size:15px;letter-spacing:-.01em;line-height:1.1;}}
.opmap-listing-sub {{font-size:12px;color:var(--ri-muted);margin-top:4px;line-height:1.2;}}
.opmap-timeline {{position:relative;min-height:{row_height}px;background-image:linear-gradient(to right, rgba(30,50,70,.07) 1px, transparent 1px), linear-gradient(to right, rgba(30,50,70,.026) 1px, transparent 1px);background-size:calc(100% / {n_weeks}) 100%, calc(100% / {total_days}) 100%;}}
.opmap-track-base {{position:absolute;left:0;right:0;top:{track_top}px;height:30px;border-radius:6px;background:#fff4cf;border:1px solid #f1d98e;opacity:.92;box-shadow:inset 0 0 0 1px rgba(255,255,255,.52);}}
.opmap-seg {{position:absolute;top:{track_top}px;height:30px;border-radius:6px;border:1px solid transparent;box-sizing:border-box;overflow:hidden;}}
.opmap-seg.booked {{background:linear-gradient(180deg, rgba(160,222,176,.96), rgba(124,205,150,.96));border-color:#70c98f;box-shadow:0 3px 8px rgba(41,150,96,.10), inset 1px 0 0 rgba(255,255,255,.72), inset -1px 0 0 rgba(255,255,255,.72);}}
.opmap-seg.blocked {{background:linear-gradient(180deg, #e1e5e9, #d1d7dd);border-color:#c2cad2;}}
.opmap-seg.gap {{background:repeating-linear-gradient(135deg,#ffcc8e 0,#ffcc8e 4px,#fff4df 4px,#fff4df 8px);border-color:#ff9f45;box-shadow:0 0 0 1px rgba(255,158,67,.15);}}
.opmap-res-label {{position:absolute;left:8px;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:800;color:#145637;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 0 rgba(255,255,255,.55);pointer-events:none;}}
.opmap-boundary {{position:absolute;top:{track_top - 2}px;height:34px;width:2px;transform:translateX(-1px);background:rgba(255,255,255,.92);box-shadow:0 0 0 1px rgba(47,85,110,.08);z-index:7;}}
.opmap-turnover-line {{position:absolute;top:{track_top - 4}px;height:38px;width:3px;transform:translateX(-1.5px);background:#244055;border-radius:999px;box-shadow:0 0 0 2px rgba(255,255,255,.82);z-index:8;}}
.opmap-price {{position:absolute;top:{track_top - 11}px;transform:translateX(-50%);width:24px;height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:950;font-size:12px;border:2px solid #fff;box-shadow:0 5px 11px rgba(20,30,40,.14);z-index:12;}}
.opmap-price.under {{background:var(--ri-blue);}}
.opmap-price.over {{background:var(--ri-orange);}}
.opmap-risk {{position:absolute;top:{event_top - 24}px;transform:translateX(-50%);color:var(--ri-red);font-size:18px;font-weight:900;text-shadow:0 1px 0 #fff;z-index:11;}}
.opmap-clean-window {{position:absolute;top:{cleaning_top + 5}px;height:10px;border-radius:999px;background:rgba(128,87,200,.11);border:1px dashed rgba(128,87,200,.45);box-sizing:border-box;z-index:3;}}
.opmap-event {{position:absolute;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;z-index:13;}}
.opmap-event.arrival,.opmap-event.departure,.opmap-event.turnover {{top:{event_top}px;}}
.opmap-event.cleaning,.opmap-event.cleaning-confirm {{top:{cleaning_top}px;}}
.opmap-event .event-dot {{width:22px;height:22px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:950;border:2px solid #fff;box-shadow:0 5px 14px rgba(25,35,45,.14);}}
.opmap-event.arrival .event-dot {{background:#2fb96d;color:#fff;}}
.opmap-event.departure .event-dot {{background:#ff941f;color:#fff;}}
.opmap-event.turnover .event-dot {{background:#17283f;color:#fff;font-size:13px;}}
.opmap-event.cleaning .event-dot {{background:#e9f8ef;color:#1c8f55;border-color:#a9e4bf;}}
.opmap-event.cleaning-confirm .event-dot {{background:#fff;color:var(--ri-purple);border-color:#d9c7ff;border-style:dashed;}}
.opmap-event .event-label {{font-size:9px;color:#70808c;font-weight:750;background:rgba(255,255,255,.90);padding:1px 4px;border-radius:999px;white-space:nowrap;}}
.opmap-single .opmap-grid {{min-width:{max(1080, n_weeks * 94 + 240)}px;}}
.opmap-single .opmap-listing {{align-items:flex-start;padding-top:26px;}}
@media (max-width: 760px) {{
  .opmap-card {{
    padding:14px;
    border-radius:18px;
    overflow-x:hidden;
    box-shadow:0 10px 28px rgba(20,30,40,.055);
  }}
  .opmap-titlebar {{
    flex-direction:column;
    gap:10px;
    margin-bottom:10px;
  }}
  .opmap-title h3 {{font-size:22px;line-height:1.05;}}
  .opmap-title p {{font-size:12.5px;line-height:1.35;}}
  .opmap-toggle {{gap:7px;font-size:12px;}}
  .opmap-pill {{padding:7px 10px;border-radius:11px;}}
  .opmap-legend {{
    justify-content:flex-start !important;
    flex-wrap:nowrap;
    overflow-x:auto;
    gap:8px;
    padding:9px 0;
    margin:0;
    scrollbar-width:none;
    -webkit-overflow-scrolling:touch;
  }}
  .opmap-legend::-webkit-scrollbar {{display:none;}}
  .opmap-leg {{
    font-size:11.5px;
    gap:5px;
    padding:5px 8px;
    border:1px solid #e2e8ee;
    background:#f8fafc;
    border-radius:999px;
  }}
  .opmap-swatch {{width:13px;height:13px;border-radius:4px;}}
  .opmap-signal-dot {{width:17px;height:17px;font-size:10px;}}
  .opmap-signal-dot.risk {{font-size:15px;}}
  .opmap-mobile-hint {{
    display:block;
    margin:9px 0 4px;
    color:#71808c;
    font-size:11.5px;
    font-weight:650;
  }}
  .opmap-grid {{
    min-width:0 !important;
    width:100%;
  }}
  .opmap-week-head {{display:none;}}
  .opmap-row {{
    display:block;
    min-height:0;
    border:1px solid var(--ri-line);
    border-radius:18px;
    margin:12px 0;
    overflow:hidden;
    background:#fff;
  }}
  .opmap-row:last-child {{border-bottom:1px solid var(--ri-line);}}
  .opmap-listing {{
    border-right:0;
    border-bottom:1px solid var(--ri-line);
    padding:11px 12px;
    gap:10px;
  }}
  .opmap-thumb,.opmap-thumb-fallback {{
    width:58px;
    height:44px;
    border-radius:12px;
    flex:0 0 auto;
  }}
  .opmap-thumb-fallback {{font-size:21px;}}
  .opmap-listing-name {{font-size:15px;}}
  .opmap-listing-sub {{font-size:11.5px;margin-top:2px;}}
  .opmap-timeline-wrap {{
    overflow-x:auto;
    overflow-y:hidden;
    -webkit-overflow-scrolling:touch;
    padding:0 0 11px;
    background:linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)) left top/18px 100% no-repeat,
               linear-gradient(270deg, rgba(255,255,255,1), rgba(255,255,255,0)) right top/18px 100% no-repeat;
  }}
  .opmap-timeline-wrap::-webkit-scrollbar {{height:5px;}}
  .opmap-timeline-wrap::-webkit-scrollbar-thumb {{background:#d5dde4;border-radius:999px;}}
  .opmap-mobile-weeks {{display:block;min-width:{max(700, n_weeks * 72)}px;}}
  .opmap-mobile-weeks .opmap-weeks {{
    display:grid;
    grid-template-columns:repeat({n_weeks}, minmax(72px, 1fr));
    min-width:{max(700, n_weeks * 72)}px;
    border-bottom:1px solid var(--ri-line);
  }}
  .opmap-mobile-weeks .opmap-week {{min-height:44px;padding:6px 3px 3px;}}
  .opmap-mobile-weeks .opmap-month {{font-size:11.5px;line-height:15px;min-height:15px;}}
  .opmap-mobile-weeks .opmap-week-label {{font-size:11px;}}
  .opmap-timeline {{
    min-width:{max(700, n_weeks * 72)}px;
    width:{max(700, n_weeks * 72)}px;
    min-height:112px;
  }}
  .opmap-track-base,.opmap-seg {{top:25px;height:26px;border-radius:6px;}}
  .opmap-boundary {{top:23px;height:30px;}}
  .opmap-turnover-line {{top:21px;height:34px;}}
  .opmap-price {{top:12px;width:21px;height:21px;font-size:10px;}}
  .opmap-risk {{top:55px;font-size:15px;}}
  .opmap-clean-window {{top:89px;height:8px;}}
  .opmap-event.arrival,.opmap-event.departure,.opmap-event.turnover {{top:61px;}}
  .opmap-event.cleaning,.opmap-event.cleaning-confirm {{top:80px;}}
  .opmap-event .event-dot {{width:20px;height:20px;font-size:11px;}}
  .opmap-event .event-label {{display:none;}}
  .opmap-res-label {{font-size:10.5px;left:6px;right:6px;}}
  .opmap-single .opmap-grid {{min-width:0 !important;}}
}}
</style>
"""


def _render_html_no_vertical_iframe(html: str, *, fallback_height: int) -> None:
    """Prefer Streamlit's native HTML when available to avoid an iframe scrollbar."""
    if hasattr(st, "html"):
        st.html(html)
    else:
        components_html(html, height=fallback_height, scrolling=False)


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
    snap_to_full_weeks: bool = True,
) -> None:
    """Render a day-accurate, week-grouped operating map in Streamlit.

    The visible frame is weekly, but every bar/icon is positioned by real day.
    If snap_to_full_weeks=True, the display expands to full Monday-Sunday weeks
    around the selected period so month boundaries never create partial fake weeks
    such as "29-30".
    """
    selected_start = _to_date(start_date)
    selected_end = _to_date(end_date)
    if selected_end <= selected_start:
        raise ValueError("end_date must be after start_date")

    display_start = _week_floor(selected_start) if snap_to_full_weeks else selected_start
    display_end = _week_ceil_exclusive(selected_end) if snap_to_full_weeks else selected_end
    if display_end <= display_start:
        display_end = display_start + timedelta(days=7)

    res = _normalise_reservations(reservations_df)
    res = res[(res["departure"] > display_start) & (res["arrival"] < display_end)]
    listings = _normalise_listing_rows(res, listing_meta_df)
    if not listings:
        st.info("Aucune réservation ou logement à afficher pour cette période.")
        return

    blocks = _normalise_blocks(blocked_df)
    blocks = blocks[(blocks["end"] > display_start) & (blocks["start"] < display_end)]
    price_signals = _normalise_price_signals(pricing_signals_df)
    price_signals = price_signals[(price_signals["end"] > display_start) & (price_signals["start"] < display_end)]
    cleanings = _normalise_cleanings(cleaning_df)
    cleanings = cleanings[(cleanings["date"] >= display_start) & (cleanings["date"] < display_end)]

    total_days = (display_end - display_start).days
    week_starts = [display_start + timedelta(days=i) for i in range(0, total_days, 7)]
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

    week_cells: list[str] = []
    prev_month: Optional[int] = None
    for ws in week_starts:
        we = min(ws + timedelta(days=7), display_end)
        month, prev_month = _week_month_label(ws, we, prev_month)
        end_day = we - timedelta(days=1)
        label = f"{ws:%d}–{end_day:%d}"
        title_attr = escape(f"{ws:%d/%m/%Y} → {end_day:%d/%m/%Y}")
        week_cells.append(
            f"<div class='opmap-week' title='{title_attr}'><div class='opmap-month'>{escape(month)}</div><div class='opmap-week-label'>{label}</div></div>"
        )

    rows_html: list[str] = []
    for listing in listings:
        lid = listing.listing_id
        listing_res = res[res["listing_id"] == lid].sort_values("arrival")
        listing_blocks = blocks[blocks["listing_id"] == lid]
        listing_prices = price_signals[price_signals["listing_id"] == lid]
        listing_cleanings = cleanings[cleanings["listing_id"] == lid]
        turnover_days = _same_day_turnovers(listing_res)

        segs = ["<div class='opmap-track-base' title='Nuits ouvertes'></div>"]
        markers: list[str] = []

        for _, b in listing_blocks.iterrows():
            segs.append(
                f"<div class='opmap-seg blocked' style='{_segment_style(b['start'], b['end'], display_start, display_end)}' title='{escape(str(b.get('reason', 'Blocage')))}'></div>"
            )

        for _, r in listing_res.iterrows():
            clipped_start = max(r["arrival"], display_start)
            clipped_end = min(r["departure"], display_end)
            nights = (clipped_end - clipped_start).days
            res_name = str(r.get("reservation_label", "Réservation") or "Réservation")
            full_title = f"{res_name} · {r['listing_name']} · {r['arrival']:%d/%m/%Y} → {r['departure']:%d/%m/%Y} · {nights} nuit(s)"
            label_html = f"<span class='opmap-res-label'>{escape(res_name)}</span>" if nights >= 2 else ""
            segs.append(
                f"<div class='opmap-seg booked' style='{_segment_style(r['arrival'], r['departure'], display_start, display_end)}' title='{escape(full_title)}'>{label_html}</div>"
            )
            # Subtle boundaries make consecutive reservations readable.
            if display_start <= r["arrival"] < display_end:
                markers.append(f"<div class='opmap-boundary' style='{_point_style(r['arrival'], display_start, display_end)}'></div>")
            if display_start <= r["departure"] < display_end:
                markers.append(f"<div class='opmap-boundary' style='{_point_style(r['departure'], display_start, display_end)}'></div>")

        for gs, ge in _detect_one_night_gaps(listing_res, display_start, display_end):
            segs.append(
                f"<div class='opmap-seg gap' style='{_segment_style(gs, ge, display_start, display_end)}' title='Trou de 1 nuit · {gs:%d/%m/%Y}'></div>"
            )

        for _, p in listing_prices.iterrows():
            mid = p["start"] + timedelta(days=max(0, (p["end"] - p["start"]).days // 2))
            cls = "under" if p["signal"] == "under" else "over" if p["signal"] == "over" else "under"
            label = "Sous-tarif" if cls == "under" else "Sur-tarif"
            detail = str(p.get("label", label) or label)
            markers.append(
                f"<div class='opmap-price {cls}' style='{_point_style(mid, display_start, display_end)}' title='{escape(label + ' · ' + detail)}'>€</div>"
            )

        for d in sorted(turnover_days):
            if display_start <= d < display_end:
                markers.append(f"<div class='opmap-turnover-line' style='{_point_style(d, display_start, display_end)}' title='Départ + arrivée le même jour'></div>")
                markers.append(
                    f"<div class='opmap-risk' style='{_point_style(d, display_start, display_end)}' title='Risque opérationnel : départ et arrivée le même jour'>▲</div>"
                )

        events: list[tuple[date, str, str, str]] = []

        # Arrivals and departures. Same-day turnover gets its own icon instead of overlapping arrows.
        for _, r in listing_res.iterrows():
            arr = r["arrival"]
            dep = r["departure"]
            res_name = str(r.get("reservation_label", "Réservation") or "Réservation")
            if display_start <= arr < display_end and arr not in turnover_days:
                events.append((arr, "arrival", "↑", f"Arrivée · {res_name}"))
            if display_start <= dep < display_end and dep not in turnover_days:
                events.append((dep, "departure", "↓", f"Départ · {res_name}"))

        for d in sorted(turnover_days):
            if display_start <= d < display_end:
                events.append((d, "turnover", "⇅", "Départ + arrivée le même jour"))

        # Cleaning: accepted/submitted/completed = fixed date.
        # Pending/sent missions only draw a window when Supabase gives a real deadline
        # after the proposed date; otherwise they appear as a single proposed-date marker.
        explicit_cleaning_dates: set[date] = set()
        explicit_window_starts: set[date] = set()

        if not listing_cleanings.empty:
            listing_cleanings = listing_cleanings.drop_duplicates(
                subset=[col for col in ["listing_id", "date", "status", "cleaning_request_id"] if col in listing_cleanings.columns]
            )

        for _, c in listing_cleanings.iterrows():
            kind = _cleaning_status_kind(c.get("status", "planned"))
            cleaning_date = _optional_date(c.get("date"))
            window_start = _optional_date(c.get("window_start")) or cleaning_date
            raw_window_end = _optional_date(c.get("window_end"))
            cleaner_name = str(c.get("cleaner_name", "") or "").strip()

            if cleaning_date:
                explicit_cleaning_dates.add(cleaning_date)
            if window_start:
                explicit_window_starts.add(window_start)

            if kind == "confirm":
                if not window_start:
                    continue

                has_real_window = bool(raw_window_end and raw_window_end > window_start)
                if has_real_window:
                    window_end = min(raw_window_end, display_end)
                    if display_start <= window_start < display_end and window_end > window_start:
                        window_title = _pending_cleaning_title(c.get("status", "planned"), cleaner_name, window_end)
                        markers.append(
                            f"<div class='opmap-clean-window' style='{_segment_style(window_start, window_end, display_start, display_end, min_width=0.8)}' title='{escape(window_title)}'></div>"
                        )
                    mid = window_start + timedelta(days=max(0, (window_end - window_start).days // 2))
                    event_title = _pending_cleaning_title(c.get("status", "planned"), cleaner_name, window_end)
                else:
                    mid = window_start
                    # Keep wording clear: this is a proposed/sent mission, not a confirmed cleaning.
                    event_title = _pending_cleaning_title(c.get("status", "planned"), cleaner_name, window_start)

                if display_start <= mid < display_end:
                    events.append((mid, "cleaning-confirm", "?", event_title))
            else:
                if not cleaning_date:
                    continue
                event_title = _planned_cleaning_title(c.get("status", "planned"), cleaner_name)
                events.append((cleaning_date, "cleaning", "✓", event_title))

        # Derived cleaning windows for departures without explicit cleaning data.
        # These are true unknowns: show the possible range up to the next arrival.
        for dep in sorted(set(listing_res["departure"].tolist())):
            if display_start <= dep < display_end and dep not in explicit_cleaning_dates and dep not in explicit_window_starts:
                window_end = _next_arrival_after(listing_res, dep, display_end)
                if window_end > dep:
                    markers.append(
                        f"<div class='opmap-clean-window' style='{_segment_style(dep, window_end, display_start, display_end, min_width=0.8)}' title='Ménage à confirmer · possible jusqu’au {window_end:%d/%m/%Y}'></div>"
                    )
                mid = dep + timedelta(days=max(0, (window_end - dep).days // 2))
                if display_start <= mid < display_end:
                    events.append((mid, "cleaning-confirm", "?", f"Ménage à confirmer · échéance {window_end:%d/%m/%Y}"))

        for d, cls, icon, label in events:
            if not (display_start <= d < display_end):
                continue
            label_html = f"<span class='event-label'>{escape(label)}</span>" if show_event_labels else ""
            markers.append(
                f"<div class='opmap-event {cls}' style='{_point_style(d, display_start, display_end)}' title='{escape(label)}'><span class='event-dot'>{escape(icon)}</span>{label_html}</div>"
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
              <div class="opmap-timeline-wrap">
                <div class="opmap-mobile-weeks"><div class="opmap-weeks">{''.join(week_cells)}</div></div>
                <div class="opmap-timeline">
                  {''.join(segs)}
                  {''.join(markers)}
                </div>
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
      <div class="opmap-mobile-hint">Glissez les lignes horizontalement pour voir la suite →</div>
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
        <span class="opmap-leg"><span class="opmap-signal-dot" style="background:#17283f">⇅</span>Départ + arrivée</span>
        <span class="opmap-leg"><span class="opmap-signal-dot" style="background:#e9f8ef;color:#1c8f55;border:1px solid #a9e4bf">✓</span>Ménage accepté / rapport</span>
        <span class="opmap-leg"><span class="opmap-signal-dot" style="background:#fff;color:#8057c8;border:1px dashed #d9c7ff">?</span>Envoyé / à confirmer</span>
      </div>
    </div>
    """

    row_height = 158 if single_listing else 128
    fallback_height = 245 + (row_height * len(listings))
    _render_html_no_vertical_iframe(html, fallback_height=fallback_height)
