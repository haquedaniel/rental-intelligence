from __future__ import annotations

import pandas as pd
import streamlit as st
from datetime import date, datetime, timedelta
from pathlib import Path
import os
import re
import unicodedata
from html import escape

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

try:
    # If season_operating_map.py is in src/rental_intel/ui/
    from rental_intel.ui.season_operating_map import render_season_operating_map
except ImportError:
    # If you later move it to src/rental_intel/ui/components/
    from rental_intel.ui.components.season_operating_map import render_season_operating_map

try:
    from rental_intel.ui.data_supabase import build_operating_map_inputs
except Exception:
    build_operating_map_inputs = None


def _render_inline_html(html: str) -> None:
    """Render small dashboard HTML without Streamlit turning indented blocks into code."""
    html = (html or "").strip()
    if hasattr(st, "html"):
        st.html(html)
    else:
        st.markdown(html, unsafe_allow_html=True)


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


def _repo_root_candidates() -> list[Path]:
    roots: list[Path] = []
    try:
        here = Path(__file__).resolve()
        roots.extend([here.parent, *here.parents])
    except Exception:
        pass
    try:
        cwd = Path.cwd().resolve()
        roots.extend([cwd, *cwd.parents])
    except Exception:
        pass

    unique: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        key = str(root)
        if key not in seen:
            unique.append(root)
            seen.add(key)
    return unique[:10]


def _find_processed_file(filename: str) -> Path | None:
    candidates: list[Path] = []
    for root in _repo_root_candidates():
        candidates.extend(
            [
                root / "outputs" / "processed" / filename,
                root / "data" / "processed" / filename,
                root / "processed" / filename,
            ]
        )
    for candidate in candidates:
        try:
            if candidate.exists() and candidate.is_file():
                return candidate
        except Exception:
            continue
    return None


def _latest_processed_file(patterns: list[str]) -> Path | None:
    matches: list[Path] = []
    for root in _repo_root_candidates():
        for base in [root / "outputs" / "processed", root / "data" / "processed", root / "processed"]:
            try:
                if base.exists():
                    for pattern in patterns:
                        matches.extend([p for p in base.glob(pattern) if p.is_file()])
            except Exception:
                continue
    if not matches:
        return None
    return max(matches, key=lambda p: p.stat().st_mtime)


def _file_mtime(path: Path | None) -> datetime | None:
    if path is None:
        return None
    try:
        return datetime.fromtimestamp(path.stat().st_mtime)
    except Exception:
        return None


def _parse_datetime(value: object) -> datetime | None:
    try:
        if value is None or pd.isna(value):
            return None
    except Exception:
        pass
    try:
        ts = pd.to_datetime(value, utc=False, errors="coerce")
        if pd.isna(ts):
            return None
        # Display in server/local time when possible; strip tz to keep comparisons simple.
        if getattr(ts, "tzinfo", None) is not None:
            try:
                ts = ts.tz_convert(None)
            except Exception:
                ts = ts.tz_localize(None)
        return ts.to_pydatetime()
    except Exception:
        return None


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return "non trouvé"
    return value.strftime("%d/%m %H:%M")


def _age_label(value: datetime | None) -> str:
    if value is None:
        return "à vérifier"
    delta = datetime.now() - value
    total_minutes = max(0, int(delta.total_seconds() // 60))
    if total_minutes < 2:
        return "à l’instant"
    if total_minutes < 60:
        return f"il y a {total_minutes} min"
    hours = total_minutes // 60
    if hours < 24:
        return f"il y a {hours} h"
    days = hours // 24
    if days == 1:
        return "hier"
    return f"il y a {days} j"


def _latest_datetime_from_df(df: pd.DataFrame, cols: list[str]) -> datetime | None:
    if df is None or df.empty:
        return None
    dates: list[datetime] = []
    for col in cols:
        if col not in df.columns:
            continue
        values = pd.to_datetime(df[col], errors="coerce", utc=False).dropna()
        for value in values.tolist():
            parsed = _parse_datetime(value)
            if parsed is not None:
                dates.append(parsed)
    return max(dates) if dates else None


def _has_streamlit_secret(name: str) -> bool:
    try:
        return bool(st.secrets.get(name))
    except Exception:
        return False


def _render_source_health_panel(
    *,
    reservations: pd.DataFrame,
    listing_financials: pd.DataFrame,
    variable_costs: pd.DataFrame,
    cleaner_due: pd.DataFrame,
    cleaning_events: pd.DataFrame,
    bridge_diagnostics: dict,
) -> None:
    reservation_mtime = _file_mtime(_find_processed_file("normalized_reservations.csv"))
    finance_mtime = max(
        [dt for dt in [
            _file_mtime(_find_processed_file("listing_month_financials.csv")),
            _file_mtime(_find_processed_file("monthly_profitability.csv")),
            _file_mtime(_find_processed_file("dashboard_kpis.csv")),
        ] if dt is not None],
        default=None,
    )
    costs_mtime = _file_mtime(_find_processed_file("variable_period_costs.csv"))
    local_ops_mtime = _file_mtime(_find_processed_file("cleaner_payment_due.csv"))
    market_mtime = _file_mtime(
        _latest_processed_file(["market_benchmark.csv", "*benchmark*.csv", "market*.csv", "competitor*.csv"])
    )
    ops_latest = _latest_datetime_from_df(cleaning_events, ["updated_at", "accepted_at", "date", "window_start"])

    web_analytics_ok = _has_streamlit_secret("SUPABASE_URL") and (
        _has_streamlit_secret("SUPABASE_SERVICE_ROLE_KEY") or _has_streamlit_secret("SUPABASE_KEY")
    )
    supabase_ok = bool(bridge_diagnostics.get("supabase_client", True)) if bridge_diagnostics else False

    rows = [
        ("Réservations", reservation_mtime, f"{len(reservations):,}".replace(",", " ") + " lignes"),
        ("Finances", finance_mtime, f"{len(listing_financials):,}".replace(",", " ") + " lignes"),
        ("Coûts", costs_mtime, f"{len(variable_costs):,}".replace(",", " ") + " lignes"),
        ("Marché", market_mtime, "benchmark" if market_mtime else "non trouvé"),
        ("Ops Supabase", ops_latest, "connecté" if supabase_ok else "non connecté"),
        ("Web analytics", None, "secrets OK" if web_analytics_ok else "secrets manquants"),
    ]

    cards: list[str] = []
    for label, updated_at, detail in rows:
        stamp = _format_dt(updated_at) if updated_at else ("configuré" if label == "Web analytics" and web_analytics_ok else "non trouvé")
        age = _age_label(updated_at) if updated_at else ("prêt" if label == "Web analytics" and web_analytics_ok else "à vérifier")
        cards.append(
            "<div class='ri-source-card'>"
            f"<div class='ri-source-label'>{escape(str(label))}</div>"
            f"<div class='ri-source-time'>{escape(str(stamp))}</div>"
            f"<div class='ri-source-meta'>{escape(str(age))} · {escape(str(detail))}</div>"
            "</div>"
        )

    _render_inline_html(
        """
<style>
.ri-source-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:8px 0 16px;}
.ri-source-card{background:#fff;border:1px solid #dde4ea;border-radius:16px;padding:12px 12px;box-shadow:0 8px 22px rgba(20,30,40,.045);}
.ri-source-label{font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.04em;color:#6c7a85;margin-bottom:5px;}
.ri-source-time{font-size:16px;font-weight:900;color:#13212b;letter-spacing:-.02em;}
.ri-source-meta{font-size:12px;color:#687782;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
@media(max-width:760px){.ri-source-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ri-source-card{padding:10px}.ri-source-time{font-size:14px}.ri-source-meta{font-size:11px;}}
</style>
"""
        + f"<div class='ri-source-grid'>{''.join(cards)}</div>"
    )


def _status_counts(df: pd.DataFrame) -> dict[str, int]:
    if df is None or df.empty or "status" not in df.columns:
        return {}
    return df["status"].fillna("").astype(str).str.lower().value_counts().to_dict()


def _render_proof_panel(
    *,
    reservations: pd.DataFrame,
    listing_meta: pd.DataFrame,
    cleaning_events: pd.DataFrame,
    bridge_diagnostics: dict,
    property_bridge_df: pd.DataFrame,
) -> None:
    diagnostics = bridge_diagnostics or {}
    if diagnostics.get("local_listings") is not None:
        local_listings = int(diagnostics.get("local_listings") or 0)
    elif reservations is not None and not reservations.empty and "listing_id" in reservations.columns:
        local_listings = int(reservations["listing_id"].nunique())
    else:
        local_listings = 0
    matched = int(diagnostics.get("matched_listings") or 0)
    alias_matches = int(diagnostics.get("matched_by_alias") or 0)
    source_matches = int(diagnostics.get("matched_by_source_booking_id") or 0)
    source_rows = int(diagnostics.get("supabase_reservations_loaded") or 0)
    covers = int(diagnostics.get("cover_photos") or 0)
    cleaning_mapped = int(diagnostics.get("cleaning_requests_mapped") or (len(cleaning_events) if cleaning_events is not None else 0))
    with_image = int(listing_meta.get("image_url", pd.Series(dtype=str)).fillna("").astype(str).str.len().gt(0).sum()) if listing_meta is not None and not listing_meta.empty else 0
    with_cleaner = int(cleaning_events.get("cleaner_name", pd.Series(dtype=str)).fillna("").astype(str).str.len().gt(0).sum()) if cleaning_events is not None and not cleaning_events.empty else 0
    statuses = _status_counts(cleaning_events)

    status_text = []
    for key, label in [("sent", "envoyés"), ("accepted", "acceptés"), ("report_submitted", "rapports"), ("completed", "terminés"), ("problem_reported", "problèmes")]:
        if statuses.get(key):
            status_text.append(f"{statuses[key]} {label}")
    status_line = " · ".join(status_text) if status_text else "aucun statut actif"

    bridge_quality = "Excellent" if matched and matched == local_listings and alias_matches == 0 else "Partiel"
    bridge_detail = f"{matched}/{local_listings} logements reliés"
    if alias_matches:
        bridge_detail += f" · {alias_matches} alias"
    else:
        bridge_detail += " · 0 alias"

    cards = [
        ("Pont propriétés", bridge_quality, bridge_detail, f"{source_matches} par source_booking_id · {source_rows} réservations Supabase"),
        ("Réservations", f"{len(reservations)}", "lignes normalisées", f"{reservations['source_booking_id'].notna().sum() if 'source_booking_id' in reservations.columns else 0} avec source_booking_id"),
        ("Photos", f"{with_image}/{local_listings}", "couvertures affichables", f"{covers} URLs signées Supabase"),
        ("Ménages", f"{cleaning_mapped}", "missions reliées", f"{with_cleaner} avec intervenant · {status_line}"),
    ]

    html_cards: list[str] = []
    for title, value, meta, detail in cards:
        html_cards.append(
            "<div class='ri-proof-card'>"
            f"<div class='ri-proof-title'>{escape(str(title))}</div>"
            f"<div class='ri-proof-value'>{escape(str(value))}</div>"
            f"<div class='ri-proof-meta'>{escape(str(meta))}</div>"
            f"<div class='ri-proof-detail'>{escape(str(detail))}</div>"
            "</div>"
        )

    badge = "OK" if diagnostics.get("supabase_client", True) else "hors ligne"
    _render_inline_html(
        """
<style>
.ri-proof-wrap{background:#fff;border:1px solid #dde4ea;border-radius:22px;padding:16px 16px 14px;margin:4px 0 18px;box-shadow:0 12px 30px rgba(20,30,40,.055);}
.ri-proof-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;}
.ri-proof-head h3{margin:0;font-size:19px;letter-spacing:-.02em;color:#13212b;}
.ri-proof-head p{margin:3px 0 0;color:#667580;font-size:13px;}
.ri-proof-badge{font-size:12px;font-weight:850;color:#1c6b42;background:#e9f8ef;border:1px solid #bfe8cc;border-radius:999px;padding:6px 10px;white-space:nowrap;}
.ri-proof-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
.ri-proof-card{background:linear-gradient(180deg,#fbfcfd,#ffffff);border:1px solid #e3e8ed;border-radius:16px;padding:13px 13px;}
.ri-proof-title{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.045em;color:#6d7a85;margin-bottom:6px;}
.ri-proof-value{font-size:22px;font-weight:950;color:#13212b;letter-spacing:-.03em;line-height:1.05;}
.ri-proof-meta{font-size:13px;color:#354653;font-weight:750;margin-top:3px;}
.ri-proof-detail{font-size:12px;color:#6a7883;margin-top:7px;line-height:1.25;}
@media(max-width:760px){.ri-proof-wrap{padding:14px;border-radius:18px}.ri-proof-head{flex-direction:column}.ri-proof-grid{grid-template-columns:1fr 1fr}.ri-proof-value{font-size:19px}.ri-proof-detail{font-size:11px}}
</style>
"""
        + "<div class='ri-proof-wrap'>"
        + "<div class='ri-proof-head'>"
        + "<div><h3>Preuve des données</h3><p>Ce que la carte opérationnelle relie réellement : réservations, propriétés, photos et missions ménage.</p></div>"
        + f"<div class='ri-proof-badge'>Bridge Supabase · {escape(badge)}</div>"
        + "</div>"
        + f"<div class='ri-proof-grid'>{''.join(html_cards)}</div>"
        + "</div>"
    )


def _first_existing_col(df: pd.DataFrame, names: list[str]) -> str | None:
    if df is None or df.empty:
        return None
    for name in names:
        if name in df.columns:
            return name
    return None


def _normalised_key(value: object) -> str:
    """Loose comparison key used to match Streamlit listings with Supabase properties."""
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("&", " et ")
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_")


def _alias_keys(*values: object) -> set[str]:
    """Return tolerant aliases for matching different naming systems.

    The Streamlit metrics often use compact labels such as `Apt 2`, while the
    cleaning app stores properties with richer names such as
    `Voilerie 2 · Un jardin sur la mer`. This creates bridge aliases for both.
    """
    aliases: set[str] = set()
    blob_parts: list[str] = []

    for value in values:
        raw = str(value or "").strip()
        if not raw or raw.lower() == "nan":
            continue
        blob_parts.append(raw)
        norm = _normalised_key(raw)
        if norm:
            aliases.add(norm)

        # Split rich names into useful pieces.
        for part in re.split(r"[·•|,/()\[\]—–-]+", raw):
            part_norm = _normalised_key(part)
            if part_norm:
                aliases.add(part_norm)

    blob = _normalised_key(" ".join(blob_parts))

    # Numeric apartment aliases: apt2, Apt 2, Voilerie 2, etc.
    numbers = set(re.findall(r"(?:apt|appartement|apartment|voilerie)?_?(\d+)\b", blob))
    for n in numbers:
        aliases.update({
            f"apt_{n}",
            f"apt{n}",
            f"appartement_{n}",
            f"apartment_{n}",
            f"voilerie_{n}",
            f"voilerie{n}",
            f"le_clos_de_la_voilerie_{n}",
        })

    # Known friendly names from the current portfolio. These are harmless for
    # other clients because they are only aliases, not displayed values.
    if "jardin" in blob or "apt_2" in aliases or "voilerie_2" in aliases:
        aliases.update({"un_jardin_sur_la_mer", "jardin_sur_la_mer", "apt_2", "voilerie_2", "voilerie2"})
    if "balcon" in blob or "apt_4" in aliases or "voilerie_4" in aliases:
        aliases.update({"un_balcon_sur_la_mer", "balcon_sur_la_mer", "apt_4", "voilerie_4", "voilerie4"})
    if "toits" in blob or "refuge" in blob or "apt_5" in aliases or "voilerie_5" in aliases:
        aliases.update({"le_refuge_sous_les_toits", "refuge_sous_les_toits", "sous_les_toits", "apt_5", "voilerie_5", "voilerie5"})
    if "peskerezh" in blob or "house" in blob:
        aliases.update({"la_peskerezh", "peskerezh", "peskerezh_house", "maison_peskerezh"})

    return {a for a in aliases if a}


def _listing_lookup(reservations: pd.DataFrame) -> dict[str, str]:
    """Return a tolerant lookup from labels / ids to canonical listing_id."""
    lookup: dict[str, str] = {}

    for listing_id, label in LISTING_LABELS.items():
        lookup[_normalised_key(listing_id)] = str(listing_id)
        lookup[_normalised_key(label)] = str(listing_id)

    if reservations is not None and not reservations.empty and "listing_id" in reservations.columns:
        cols = ["listing_id"]
        if "listing_name" in reservations.columns:
            cols.append("listing_name")
        for _, row in reservations[cols].drop_duplicates().iterrows():
            listing_id = str(row.get("listing_id", ""))
            if not listing_id:
                continue
            lookup[_normalised_key(listing_id)] = listing_id
            if "listing_name" in row:
                lookup[_normalised_key(row.get("listing_name"))] = listing_id
            lookup[_normalised_key(label_value(listing_id, LISTING_LABELS))] = listing_id

    return lookup


def _candidate_column(df: pd.DataFrame, names: list[str]) -> str | None:
    return _first_existing_col(df, names)


def _normalised_meta_key(value: object) -> str:
    return _normalised_key(value)


def _extract_listing_meta_rows(source: pd.DataFrame) -> pd.DataFrame:
    """Normalise possible listing/property metadata tables.

    The app may receive this from processed CSVs or from Supabase. We keep the
    adapter deliberately tolerant so the map can use thumbnail images when the
    source exists, but never breaks if the schema is different.
    """
    if source is None or source.empty:
        return pd.DataFrame(columns=["listing_id", "listing_name", "subtitle", "image_url"])

    id_col = _candidate_column(
        source,
        [
            "listing_id",
            "property_key",
            "property_slug",
            "slug",
            "id",
            "property_id",
            "source_property_id",
            "beds24_property_id",
            "room_id",
        ],
    )
    name_col = _candidate_column(source, ["listing_name", "name", "title", "property_name", "display_name"])
    subtitle_col = _candidate_column(source, ["subtitle", "capacity_label", "type", "category", "kind"])
    image_col = _candidate_column(
        source,
        [
            "image_url",
            "thumbnail_url",
            "thumb_url",
            "photo_url",
            "cover_image_url",
            "cover_photo_url",
            "main_photo_url",
            "image",
            "thumbnail",
            "photo",
        ],
    )

    if not id_col and not name_col:
        return pd.DataFrame(columns=["listing_id", "listing_name", "subtitle", "image_url"])

    rows: list[dict[str, str]] = []
    for _, row in source.iterrows():
        listing_id = str(row.get(id_col, "") if id_col else "").strip()
        listing_name = str(row.get(name_col, "") if name_col else listing_id).strip()
        if not listing_id and listing_name:
            listing_id = listing_name
        if not listing_id:
            continue
        rows.append(
            {
                "listing_id": listing_id,
                "listing_name": listing_name or listing_id,
                "subtitle": str(row.get(subtitle_col, "") if subtitle_col else "").strip(),
                "image_url": str(row.get(image_col, "") if image_col else "").strip(),
            }
        )
    return pd.DataFrame(rows, columns=["listing_id", "listing_name", "subtitle", "image_url"])


@st.cache_data(ttl=600, show_spinner=False)
def _load_supabase_listing_meta(cache_version: str = "thumb-v7-restore") -> pd.DataFrame:
    """Load listing thumbnails from Supabase reference photos.

    The cleaner/admin app stores cover photos in:
      - table: property_reference_photos
      - bucket: cleaning-reference-photos
      - columns: property_id, storage_bucket, storage_path, is_cover, is_active

    We build signed image URLs from storage_path, then try to map the Supabase
    property_id back to the Streamlit listing_id using common property/listing
    tables and fallback direct key matching.
    """
    empty = pd.DataFrame(columns=["listing_id", "listing_name", "subtitle", "image_url"])

    url = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    )
    key = (
        os.environ.get("SUPABASE_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )
    if not url or not key:
        return empty

    try:
        from supabase import create_client
    except Exception:
        return empty

    try:
        client = create_client(url, key)
    except Exception:
        return empty

    def _storage_url(bucket: str, storage_path: str) -> str:
        bucket = str(bucket or "cleaning-reference-photos").strip()
        storage_path = str(storage_path or "").strip()
        if not bucket or not storage_path:
            return ""

        # The bucket may be private, so prefer a signed URL. Fallback to public URL
        # if the bucket is public or if the installed supabase-py version differs.
        try:
            signed = client.storage.from_(bucket).create_signed_url(storage_path, 60 * 60 * 24 * 7)
            if isinstance(signed, dict):
                for key_name in ["signedURL", "signedUrl", "signed_url", "url"]:
                    value = signed.get(key_name)
                    if value:
                        return str(value)
                data = signed.get("data")
                if isinstance(data, dict):
                    for key_name in ["signedURL", "signedUrl", "signed_url", "url"]:
                        value = data.get(key_name)
                        if value:
                            return str(value)
            value = getattr(signed, "signed_url", None) or getattr(signed, "signedURL", None)
            if value:
                return str(value)
        except Exception:
            pass

        try:
            public_url = client.storage.from_(bucket).get_public_url(storage_path)
            if isinstance(public_url, str):
                return public_url
            if isinstance(public_url, dict):
                return str(public_url.get("publicURL") or public_url.get("publicUrl") or public_url.get("url") or "")
        except Exception:
            pass

        return ""

    # 1) Load cover photos exactly as saved by the Next.js admin app.
    photo_by_property: dict[str, str] = {}
    try:
        result = (
            client.table("property_reference_photos")
            .select("property_id,title,storage_bucket,storage_path,is_cover,is_active,display_order,updated_at")
            .eq("is_active", True)
            .execute()
        )
        photos = getattr(result, "data", None) or []
    except Exception:
        photos = []

    def _photo_sort_key(row: dict) -> tuple[int, int, str]:
        # Covers first, then explicit display order, then newest-ish string fallback.
        return (
            0 if bool(row.get("is_cover")) else 1,
            int(row.get("display_order") or 999),
            str(row.get("updated_at") or ""),
        )

    for row in sorted(photos, key=_photo_sort_key):
        property_id = str(row.get("property_id") or "").strip()
        if not property_id or property_id in photo_by_property:
            continue
        image_url = _storage_url(
            str(row.get("storage_bucket") or "cleaning-reference-photos"),
            str(row.get("storage_path") or ""),
        )
        if image_url:
            photo_by_property[property_id] = image_url

    if not photo_by_property:
        # Still try older/direct property metadata tables with image columns.
        frames: list[pd.DataFrame] = []
        for table in ["properties", "rental_properties", "listings", "rental_listings", "property_profiles"]:
            try:
                result = client.table(table).select("*").execute()
                data = getattr(result, "data", None) or []
                if data:
                    frames.append(_extract_listing_meta_rows(pd.DataFrame(data)))
            except Exception:
                continue
        frames = [f for f in frames if f is not None and not f.empty]
        if not frames:
            return empty
        return pd.concat(frames, ignore_index=True).drop_duplicates("listing_id")

    # 2) Build many match keys per property so it can join against either
    # listing_id, listing_name, source_property_id, source_room_id, slug, etc.
    rows: list[dict[str, str]] = []

    def _add_meta_row(key_value: object, *, name: object = "", subtitle: object = "", image_url: str = "") -> None:
        key_value = str(key_value or "").strip()
        if not key_value or not image_url:
            return
        rows.append(
            {
                "listing_id": key_value,
                "listing_name": str(name or key_value).strip() or key_value,
                "subtitle": str(subtitle or "").strip(),
                "image_url": image_url,
            }
        )

    # Direct fallback: if Supabase property_id is already your listing_id.
    for property_id, image_url in photo_by_property.items():
        _add_meta_row(property_id, name=property_id, image_url=image_url)

    property_tables = [
        "properties",
        "rental_properties",
        "listings",
        "rental_listings",
        "property_profiles",
        "cleaning_properties",
    ]
    key_cols = [
        "id",
        "property_id",
        "listing_id",
        "property_key",
        "property_slug",
        "slug",
        "source_property_id",
        "source_room_id",
        "beds24_property_id",
        "beds24_room_id",
        "room_id",
    ]
    name_cols = ["listing_name", "name", "title", "property_name", "display_name", "label"]
    subtitle_cols = ["subtitle", "capacity_label", "type", "category", "kind"]

    for table in property_tables:
        try:
            result = client.table(table).select("*").execute()
            data = getattr(result, "data", None) or []
        except Exception:
            continue
        if not data:
            continue

        df = pd.DataFrame(data)
        id_col = _candidate_column(df, ["id", "property_id"])
        name_col = _candidate_column(df, name_cols)
        subtitle_col = _candidate_column(df, subtitle_cols)

        for _, row in df.iterrows():
            supabase_property_id = str(row.get(id_col, "") if id_col else "").strip()
            image_url = photo_by_property.get(supabase_property_id)
            if not image_url:
                continue

            name = row.get(name_col, supabase_property_id) if name_col else supabase_property_id
            subtitle = row.get(subtitle_col, "") if subtitle_col else ""

            # Add every useful key as a possible match target.
            for col in key_cols:
                if col in df.columns:
                    _add_meta_row(row.get(col), name=name, subtitle=subtitle, image_url=image_url)
            if name:
                _add_meta_row(name, name=name, subtitle=subtitle, image_url=image_url)

    if not rows:
        return empty

    return pd.DataFrame(rows, columns=["listing_id", "listing_name", "subtitle", "image_url"]).drop_duplicates("listing_id")


def _load_processed_listing_meta() -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for filename in [
        "listing_meta.csv",
        "listing_profiles.csv",
        "property_profiles.csv",
        "properties.csv",
        "listings.csv",
        "rental_listings.csv",
    ]:
        try:
            df = read_processed_csv(filename)
        except Exception:
            df = pd.DataFrame()
        if df is not None and not df.empty:
            extracted = _extract_listing_meta_rows(df)
            if not extracted.empty:
                frames.append(extracted)

    if not frames:
        return pd.DataFrame(columns=["listing_id", "listing_name", "subtitle", "image_url"])
    return pd.concat(frames, ignore_index=True).drop_duplicates("listing_id")


def _build_listing_meta(reservations: pd.DataFrame) -> pd.DataFrame:
    """Build display metadata for the operating map, including thumbnails.

    Priority:
      1. Reservation/listing labels from normalized_reservations.csv.
      2. Processed metadata CSVs, if present.
      3. Supabase properties/listings tables, if configured and matching ids/names.
    """
    if reservations is None or reservations.empty or "listing_id" not in reservations.columns:
        return pd.DataFrame(columns=["listing_id", "listing_name", "subtitle", "image_url"])

    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for _, row in reservations.drop_duplicates("listing_id").iterrows():
        listing_id = str(row.get("listing_id", ""))
        if not listing_id or listing_id in seen:
            continue
        seen.add(listing_id)

        raw_name = str(row.get("listing_name", listing_id))
        listing_name = label_value(listing_id, LISTING_LABELS)
        if listing_name == listing_id and raw_name:
            listing_name = raw_name

        lowered = f"{listing_id} {listing_name}".lower()
        if "peskerezh" in lowered or "house" in lowered or "maison" in lowered:
            subtitle = "Maison"
        else:
            subtitle = "Appartement"

        rows.append(
            {
                "listing_id": listing_id,
                "listing_name": listing_name,
                "subtitle": subtitle,
                "image_url": "",
            }
        )

    meta = pd.DataFrame(rows)
    if meta.empty:
        return meta

    external = pd.concat(
        [_load_processed_listing_meta(), _load_supabase_listing_meta("thumb-v7-restore")],
        ignore_index=True,
    ).drop_duplicates("listing_id")

    if external.empty:
        return meta

    # Match external metadata by exact ids/names plus aliases. This is what
    # bridges compact metric labels like `Apt 2` to Supabase names like
    # `Voilerie 2 · Un jardin sur la mer`.
    by_key: dict[str, dict] = {}
    for _, row in external.iterrows():
        payload = row.to_dict()
        for key in _alias_keys(row.get("listing_id"), row.get("listing_name"), row.get("subtitle")):
            # Keep the first image-bearing match for deterministic behaviour.
            by_key.setdefault(key, payload)

    enriched: list[dict[str, str]] = []
    for _, row in meta.iterrows():
        out = row.to_dict()
        match = None
        for key in _alias_keys(row.get("listing_id"), row.get("listing_name"), label_value(row.get("listing_id"), LISTING_LABELS)):
            match = by_key.get(key)
            if match:
                break

        if match:
            if match.get("image_url"):
                out["image_url"] = str(match.get("image_url"))
            if match.get("subtitle") and not out.get("subtitle"):
                out["subtitle"] = str(match.get("subtitle"))
        enriched.append(out)

    return pd.DataFrame(enriched, columns=["listing_id", "listing_name", "subtitle", "image_url"])

def _pricing_signals_from_attention(
    attention: list[dict],
    reservations: pd.DataFrame,
) -> pd.DataFrame:
    """Convert the existing cockpit attention cards into map price markers.

    This avoids needing new variables such as pricing_signals_df. The current
    summary already contains the market periods shown in the right-hand cards.
    """
    import re

    lookup = _listing_lookup(reservations)
    rows: list[dict[str, object]] = []

    for item in attention or []:
        title = str(item.get("title", ""))
        detail = str(item.get("detail", ""))
        badge = str(item.get("badge", ""))
        kind = str(item.get("kind", ""))
        blob = f"{title} {detail} {badge} {kind}".lower()

        match = re.search(r"(\d{4}-\d{2}-\d{2})\s*(?:→|->|to|à)\s*(\d{4}-\d{2}-\d{2})", title)
        if not match:
            continue

        raw_listing = re.split(r"\s*[·•]\s*", title, maxsplit=1)[0].strip()
        listing_id = lookup.get(_normalised_key(raw_listing), raw_listing)

        if any(token in blob for token in ["sous", "below", "under", "well_below", "très sous"]):
            signal = "under"
        elif any(token in blob for token in ["sur", "above", "over", "trop cher", "overpriced"]):
            signal = "over"
        else:
            # No clear pricing direction; don't add a marker.
            continue

        rows.append(
            {
                "listing_id": listing_id,
                "start": match.group(1),
                "end": match.group(2),
                "signal": signal,
                "label": badge or signal,
            }
        )

    return pd.DataFrame(rows, columns=["listing_id", "start", "end", "signal", "label"])


def _cleaning_events_from_due(
    cleaner_due: pd.DataFrame,
    reservations: pd.DataFrame,
) -> pd.DataFrame:
    """Best-effort adapter for cleaner_payment_due.csv.

    The operating map now understands cleaner_name and optional cleaning windows.
    If the file does not contain compatible columns, we return an empty frame;
    the map will derive 'ménage à confirmer' windows from departures.
    """
    columns = ["listing_id", "date", "status", "label", "cleaner_name", "window_start", "window_end"]
    if cleaner_due is None or cleaner_due.empty:
        return pd.DataFrame(columns=columns)

    date_col = _first_existing_col(
        cleaner_due,
        ["date", "cleaning_date", "scheduled_date", "mission_date", "departure", "due_date"],
    )
    listing_col = _first_existing_col(cleaner_due, ["listing_id", "listing_name", "property", "property_name"])
    status_col = _first_existing_col(cleaner_due, ["status", "mission_status", "state", "badge", "kind"])
    cleaner_col = _first_existing_col(cleaner_due, ["cleaner_name", "cleaner", "assignee", "assigned_to", "provider_name"])
    window_start_col = _first_existing_col(cleaner_due, ["window_start", "start", "earliest_date", "available_from", "from_date"])
    window_end_col = _first_existing_col(cleaner_due, ["window_end", "deadline", "latest_date", "available_until", "to_date", "next_arrival"])

    if not listing_col or not date_col and not window_start_col:
        return pd.DataFrame(columns=columns)

    lookup = _listing_lookup(reservations)
    rows: list[dict[str, object]] = []

    for _, row in cleaner_due.iterrows():
        raw_listing = row.get(listing_col, "")
        listing_id = lookup.get(_normalised_key(raw_listing), str(raw_listing))
        if not listing_id:
            continue

        status = str(row.get(status_col, "planned")) if status_col else "planned"
        cleaner_name = str(row.get(cleaner_col, "")) if cleaner_col else ""
        rows.append(
            {
                "listing_id": listing_id,
                "date": row.get(date_col) if date_col else row.get(window_start_col),
                "status": status,
                "label": "Ménage",
                "cleaner_name": cleaner_name,
                "window_start": row.get(window_start_col) if window_start_col else row.get(date_col),
                "window_end": row.get(window_end_col) if window_end_col else None,
            }
        )

    return pd.DataFrame(rows, columns=columns)

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

    section_title(
        "Carte opérationnelle",
        "semaine par semaine, avec positionnement réel des jours",
    )

    # Start with the existing local adapters, then enrich them through the
    # read-only Supabase bridge if available. The bridge is deliberately
    # conservative: if it fails, the cockpit still renders the local view.
    listing_meta = _build_listing_meta(reservations)
    pricing_signals = _pricing_signals_from_attention(summary.get("attention", []), reservations)
    cleaning_events = _cleaning_events_from_due(cleaner_due, reservations)
    bridge_diagnostics: dict = {"supabase_client": False}
    property_bridge_df = pd.DataFrame()

    if build_operating_map_inputs is not None:
        try:
            bridge_inputs = build_operating_map_inputs(
                reservations,
                period_start,
                period_end,
                base_listing_meta_df=listing_meta,
                fallback_cleaning_df=cleaning_events,
            )
            if bridge_inputs.listing_meta_df is not None and not bridge_inputs.listing_meta_df.empty:
                listing_meta = bridge_inputs.listing_meta_df
            if bridge_inputs.cleaning_df is not None and not bridge_inputs.cleaning_df.empty:
                cleaning_events = bridge_inputs.cleaning_df
            bridge_diagnostics = dict(getattr(bridge_inputs, "diagnostics", {}) or {})
            property_bridge_df = getattr(bridge_inputs, "property_bridge_df", pd.DataFrame())

            if os.environ.get("RENTAL_INTEL_DEBUG_SUPABASE_BRIDGE") == "1":
                st.caption(f"Bridge Supabase: {bridge_inputs.diagnostics}")
        except Exception as exc:
            if os.environ.get("RENTAL_INTEL_DEBUG_SUPABASE_BRIDGE") == "1":
                st.warning(f"Bridge Supabase indisponible: {exc}")

    render_season_operating_map(
        reservations_df=reservations,
        start_date=period_start,
        end_date=period_end,
        listing_meta_df=listing_meta,
        cleaning_df=cleaning_events,
        pricing_signals_df=pricing_signals,
        blocked_df=None,
        subtitle="Réservations, disponibilités, trous, signaux prix et opérations sur une même ligne de temps.",
        show_event_labels=False,
    )

    st.markdown("<div style='height: 1.25rem'></div>", unsafe_allow_html=True)

    section_title("Fraîcheur & preuve", "quand les sources ont été mises à jour et comment elles sont reliées")
    _render_source_health_panel(
        reservations=reservations,
        listing_financials=listing_financials,
        variable_costs=variable_costs,
        cleaner_due=cleaner_due,
        cleaning_events=cleaning_events,
        bridge_diagnostics=bridge_diagnostics,
    )
    _render_proof_panel(
        reservations=reservations,
        listing_meta=listing_meta,
        cleaning_events=cleaning_events,
        bridge_diagnostics=bridge_diagnostics,
        property_bridge_df=property_bridge_df,
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