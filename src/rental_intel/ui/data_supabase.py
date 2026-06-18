from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
import os
import re
import unicodedata
from typing import Any, Iterable, Optional

import pandas as pd


PHOTO_BUCKET_DEFAULT = "cleaning-reference-photos"

_ENV_FILES_LOADED = False


def _load_env_files_once() -> None:
    """Load local .env files when running diagnostics/scripts outside Docker.

    Docker/production should pass environment variables explicitly. Locally,
    Streamlit/scripts are often launched without sourcing .env, so we try common
    repo locations without overriding already-set shell variables.
    """
    global _ENV_FILES_LOADED
    if _ENV_FILES_LOADED:
        return
    _ENV_FILES_LOADED = True

    try:
        from pathlib import Path
        from dotenv import load_dotenv
    except Exception:
        return

    cwd = Path.cwd().resolve()
    roots = [cwd, *cwd.parents]
    candidates = []
    for root in roots[:6]:
        candidates.extend(
            [
                root / ".env",
                root / ".env.local",
                root / "apps" / "cleaner-web" / ".env",
                root / "apps" / "cleaner-web" / ".env.local",
                root / "app" / ".env",
                root / "app" / ".env.local",
            ]
        )

    seen = set()
    for candidate in candidates:
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        if candidate.exists():
            load_dotenv(candidate, override=False)



@dataclass
class OperatingMapInputs:
    listing_meta_df: pd.DataFrame
    cleaning_df: pd.DataFrame
    property_bridge_df: pd.DataFrame
    diagnostics: dict[str, Any]


def _empty_listing_meta() -> pd.DataFrame:
    return pd.DataFrame(columns=["listing_id", "listing_name", "subtitle", "image_url", "supabase_property_id", "property_name"])


def _empty_cleanings() -> pd.DataFrame:
    return pd.DataFrame(
        columns=[
            "listing_id",
            "date",
            "status",
            "label",
            "cleaner_name",
            "window_start",
            "window_end",
            "supabase_property_id",
            "cleaning_request_id",
            "public_token",
        ]
    )


def _empty_bridge() -> pd.DataFrame:
    return pd.DataFrame(
        columns=[
            "listing_id",
            "listing_name",
            "supabase_property_id",
            "property_name",
            "address",
            "match_method",
            "matched_reservations",
        ]
    )


def _id_key(value: object) -> str:
    """Stable comparison key for external ids such as Beds24 booking ids.

    CSVs often round-trip numeric ids as floats (`123.0`). Supabase stores the
    same value as text. This normalises only the presentation, not the data.
    """
    try:
        if value is None or pd.isna(value):
            return ""
    except Exception:
        pass
    text = str(value).strip()
    if text.lower() in {"", "nan", "none", "nat"}:
        return ""
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    return text.lower()


def _normalised_key(value: object) -> str:
    try:
        if value is None or pd.isna(value):
            return ""
    except Exception:
        pass
    text = str(value or "").strip().lower()
    if text in {"", "nan", "none", "nat"}:
        return ""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("&", " et ")
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_")


def _alias_keys(*values: object) -> set[str]:
    aliases: set[str] = set()
    blob_parts: list[str] = []

    for value in values:
        raw = str(value or "").strip()
        if not raw or raw.lower() in {"nan", "none", "nat"}:
            continue
        blob_parts.append(raw)
        norm = _normalised_key(raw)
        if norm:
            aliases.add(norm)
        for part in re.split(r"[·•|,/()\[\]—–-]+", raw):
            part_norm = _normalised_key(part)
            if part_norm:
                aliases.add(part_norm)

    blob = _normalised_key(" ".join(blob_parts))
    numbers = set(re.findall(r"(?:apt|appartement|apartment|voilerie)?_?(\d+)\b", blob))
    for n in numbers:
        aliases.update({f"apt_{n}", f"apt{n}", f"appartement_{n}", f"apartment_{n}", f"voilerie_{n}", f"voilerie{n}"})

    # Current demo portfolio aliases remain as a last-resort fallback only.
    if "jardin" in blob or "apt_2" in aliases or "voilerie_2" in aliases:
        aliases.update({"un_jardin_sur_la_mer", "jardin_sur_la_mer", "apt_2", "voilerie_2", "voilerie2"})
    if "balcon" in blob or "apt_4" in aliases or "voilerie_4" in aliases:
        aliases.update({"un_balcon_sur_la_mer", "balcon_sur_la_mer", "apt_4", "voilerie_4", "voilerie4"})
    if "toits" in blob or "refuge" in blob or "apt_5" in aliases or "voilerie_5" in aliases:
        aliases.update({"le_refuge_sous_les_toits", "refuge_sous_les_toits", "sous_les_toits", "apt_5", "voilerie_5", "voilerie5"})
    if "peskerezh" in blob or "house" in blob or "maison" in blob:
        aliases.update({"la_peskerezh", "peskerezh", "peskerezh_house", "maison_peskerezh"})

    return {a for a in aliases if a}


def _safe_date(value: object) -> Optional[date]:
    try:
        if value is None or pd.isna(value):
            return None
    except Exception:
        pass
    try:
        return pd.to_datetime(value).date()
    except Exception:
        return None


def _safe_iso(value: object) -> str:
    try:
        if value is None or pd.isna(value):
            return ""
    except Exception:
        pass
    return str(value or "").strip()


def _get_supabase_credentials() -> tuple[str, str]:
    _load_env_files_once()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
    # Important: this project historically uses SUPABASE_KEY. Prefer it before
    # SERVICE_ROLE to avoid an obsolete/invalid service key shadowing the good key.
    key = (
        os.environ.get("SUPABASE_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or ""
    )
    return url.strip(), key.strip()


def get_supabase_client():
    url, key = _get_supabase_credentials()
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception:
        return None


def _execute_data(query) -> list[dict[str, Any]]:
    try:
        result = query.execute()
        return list(getattr(result, "data", None) or [])
    except Exception:
        return []


def _chunks(values: list[str], size: int = 150) -> Iterable[list[str]]:
    for i in range(0, len(values), size):
        yield values[i : i + size]


def _signed_storage_url(client, bucket: str, storage_path: str, expires_seconds: int = 60 * 60 * 24 * 7) -> str:
    bucket = str(bucket or PHOTO_BUCKET_DEFAULT).strip()
    storage_path = str(storage_path or "").strip()
    if not client or not bucket or not storage_path:
        return ""

    try:
        signed = client.storage.from_(bucket).create_signed_url(storage_path, expires_seconds)
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
        data = getattr(signed, "data", None)
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


def load_supabase_properties(client=None) -> pd.DataFrame:
    client = client or get_supabase_client()
    if not client:
        return pd.DataFrame(columns=["id", "name", "address", "preferred_cleaner_id"])

    rows = _execute_data(client.table("properties").select("id,name,address,preferred_cleaner_id"))
    if not rows:
        rows = _execute_data(client.table("properties").select("*"))
    if not rows:
        return pd.DataFrame(columns=["id", "name", "address", "preferred_cleaner_id"])
    return pd.DataFrame(rows)


def load_property_cover_photos(client=None) -> pd.DataFrame:
    client = client or get_supabase_client()
    cols = ["property_id", "image_url", "photo_title", "storage_bucket", "storage_path", "is_cover", "display_order"]
    if not client:
        return pd.DataFrame(columns=cols)

    rows = _execute_data(
        client.table("property_reference_photos")
        .select("property_id,title,storage_bucket,storage_path,is_cover,is_active,display_order,updated_at")
        .eq("is_active", True)
    )
    if not rows:
        return pd.DataFrame(columns=cols)

    def sort_key(row: dict[str, Any]) -> tuple[int, int, str]:
        return (0 if bool(row.get("is_cover")) else 1, int(row.get("display_order") or 999), str(row.get("updated_at") or ""))

    by_property: dict[str, dict[str, Any]] = {}
    for row in sorted(rows, key=sort_key):
        property_id = str(row.get("property_id") or "").strip()
        if not property_id or property_id in by_property:
            continue
        image_url = _signed_storage_url(client, row.get("storage_bucket") or PHOTO_BUCKET_DEFAULT, row.get("storage_path") or "")
        if not image_url:
            continue
        by_property[property_id] = {
            "property_id": property_id,
            "image_url": image_url,
            "photo_title": str(row.get("title") or ""),
            "storage_bucket": str(row.get("storage_bucket") or PHOTO_BUCKET_DEFAULT),
            "storage_path": str(row.get("storage_path") or ""),
            "is_cover": bool(row.get("is_cover")),
            "display_order": row.get("display_order"),
        }

    if not by_property:
        return pd.DataFrame(columns=cols)
    return pd.DataFrame(list(by_property.values()), columns=cols)


def _local_listing_frame(reservations_df: pd.DataFrame, base_listing_meta_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    rows: list[dict[str, str]] = []
    if reservations_df is not None and not reservations_df.empty and "listing_id" in reservations_df.columns:
        cols = ["listing_id"]
        if "listing_name" in reservations_df.columns:
            cols.append("listing_name")
        for _, row in reservations_df[cols].drop_duplicates().iterrows():
            lid = str(row.get("listing_id") or "").strip()
            if not lid:
                continue
            lname = str(row.get("listing_name") or lid).strip() if "listing_name" in row else lid
            rows.append({"listing_id": lid, "listing_name": lname})

    if base_listing_meta_df is not None and not base_listing_meta_df.empty and "listing_id" in base_listing_meta_df.columns:
        for _, row in base_listing_meta_df.drop_duplicates("listing_id").iterrows():
            lid = str(row.get("listing_id") or "").strip()
            if not lid:
                continue
            lname = str(row.get("listing_name") or lid).strip()
            rows.append({"listing_id": lid, "listing_name": lname})

    if not rows:
        return pd.DataFrame(columns=["listing_id", "listing_name"])
    return pd.DataFrame(rows).drop_duplicates("listing_id")


def _load_supabase_reservations_for_bridge(client, reservations_df: pd.DataFrame, start_date: Optional[date], end_date: Optional[date]) -> pd.DataFrame:
    cols = ["id", "property_id", "source_booking_id", "guest_name", "checkin_at", "checkout_at", "status", "next_checkin_at", "number_of_guests"]
    if not client:
        return pd.DataFrame(columns=cols)

    source_ids: list[str] = []
    if reservations_df is not None and not reservations_df.empty and "source_booking_id" in reservations_df.columns:
        source_ids = sorted({_id_key(v) for v in reservations_df["source_booking_id"].tolist() if _id_key(v)})

    rows: list[dict[str, Any]] = []
    if source_ids:
        # Supabase in_ matching is the safest property bridge: local source_booking_id -> Supabase property_id.
        for chunk in _chunks(source_ids, 150):
            rows.extend(_execute_data(client.table("reservations").select(",".join(cols)).in_("source_booking_id", chunk)))

    # Date-window fallback catches Supabase reservations whose source id formatting differs.
    if start_date and end_date:
        start_iso = (start_date - timedelta(days=7)).isoformat()
        end_iso = (end_date + timedelta(days=7)).isoformat()
        rows.extend(
            _execute_data(
                client.table("reservations")
                .select(",".join(cols))
                .neq("status", "cancelled")
                .lte("checkin_at", end_iso)
                .gte("checkout_at", start_iso)
                .order("checkin_at", desc=False)
            )
        )

    if not rows:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(rows).drop_duplicates("id")
    for col in cols:
        if col not in df.columns:
            df[col] = None
    return df[cols]


def build_property_bridge(
    reservations_df: pd.DataFrame,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    base_listing_meta_df: Optional[pd.DataFrame] = None,
    client=None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    """Read-only bridge from local cockpit listings to Supabase properties.

    Bridge priority:
      1. Exact source_booking_id match via Supabase reservations.
      2. Alias/name fallback against Supabase properties.

    No schema writes, no destructive changes.
    """
    client = client or get_supabase_client()
    local = _local_listing_frame(reservations_df, base_listing_meta_df)
    properties = load_supabase_properties(client)
    sup_res = _load_supabase_reservations_for_bridge(client, reservations_df, start_date, end_date)

    if local.empty:
        return _empty_bridge(), properties, sup_res, {"local_listings": 0, "matched_by_source_booking_id": 0, "matched_by_alias": 0}

    source_to_listing: dict[str, str] = {}
    if reservations_df is not None and not reservations_df.empty and {"source_booking_id", "listing_id"}.issubset(reservations_df.columns):
        for _, row in reservations_df[["source_booking_id", "listing_id"]].dropna(subset=["listing_id"]).iterrows():
            key = _id_key(row.get("source_booking_id"))
            lid = str(row.get("listing_id") or "").strip()
            if key and lid:
                source_to_listing[key] = lid

    # Count matches by local listing/property from reservation source ids.
    counts: dict[tuple[str, str], int] = {}
    for _, row in sup_res.iterrows():
        source_key = _id_key(row.get("source_booking_id"))
        lid = source_to_listing.get(source_key)
        pid = str(row.get("property_id") or "").strip()
        if lid and pid:
            counts[(lid, pid)] = counts.get((lid, pid), 0) + 1

    property_by_id: dict[str, dict[str, Any]] = {}
    if properties is not None and not properties.empty and "id" in properties.columns:
        for _, row in properties.iterrows():
            property_by_id[str(row.get("id") or "").strip()] = row.to_dict()

    rows: list[dict[str, Any]] = []
    used_lids: set[str] = set()
    for (lid, pid), count in sorted(counts.items(), key=lambda item: (-item[1], item[0][0], item[0][1])):
        if lid in used_lids:
            continue
        prop = property_by_id.get(pid, {})
        local_row = local[local["listing_id"] == lid]
        listing_name = str(local_row.iloc[0].get("listing_name") if not local_row.empty else lid)
        rows.append(
            {
                "listing_id": lid,
                "listing_name": listing_name,
                "supabase_property_id": pid,
                "property_name": str(prop.get("name") or pid),
                "address": str(prop.get("address") or ""),
                "match_method": "source_booking_id",
                "matched_reservations": count,
            }
        )
        used_lids.add(lid)

    # Alias fallback for remaining listings. This preserves the current demo behaviour
    # but it is lower priority than the exact reservation bridge.
    property_aliases: dict[str, dict[str, Any]] = {}
    if properties is not None and not properties.empty:
        for _, prop in properties.iterrows():
            payload = prop.to_dict()
            for key in _alias_keys(prop.get("id"), prop.get("name"), prop.get("address")):
                property_aliases.setdefault(key, payload)

    for _, loc in local.iterrows():
        lid = str(loc.get("listing_id") or "").strip()
        if not lid or lid in used_lids:
            continue
        match = None
        for key in _alias_keys(loc.get("listing_id"), loc.get("listing_name")):
            match = property_aliases.get(key)
            if match:
                break
        if match:
            pid = str(match.get("id") or "").strip()
            rows.append(
                {
                    "listing_id": lid,
                    "listing_name": str(loc.get("listing_name") or lid),
                    "supabase_property_id": pid,
                    "property_name": str(match.get("name") or pid),
                    "address": str(match.get("address") or ""),
                    "match_method": "alias",
                    "matched_reservations": 0,
                }
            )
            used_lids.add(lid)

    bridge = pd.DataFrame(rows, columns=_empty_bridge().columns)
    diagnostics = {
        "local_listings": int(len(local)),
        "supabase_properties": int(len(properties)) if properties is not None else 0,
        "supabase_reservations_loaded": int(len(sup_res)) if sup_res is not None else 0,
        "matched_listings": int(len(bridge)),
        "matched_by_source_booking_id": int((bridge["match_method"] == "source_booking_id").sum()) if not bridge.empty else 0,
        "matched_by_alias": int((bridge["match_method"] == "alias").sum()) if not bridge.empty else 0,
    }
    return bridge, properties, sup_res, diagnostics


def build_listing_meta_from_bridge(
    reservations_df: pd.DataFrame,
    bridge_df: pd.DataFrame,
    photos_df: pd.DataFrame,
    *,
    base_listing_meta_df: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    local = _local_listing_frame(reservations_df, base_listing_meta_df)
    if local.empty and base_listing_meta_df is not None:
        local = base_listing_meta_df.copy()
    if local.empty:
        return _empty_listing_meta()

    meta = base_listing_meta_df.copy() if base_listing_meta_df is not None and not base_listing_meta_df.empty else local.copy()
    for col in ["listing_id", "listing_name", "subtitle", "image_url"]:
        if col not in meta.columns:
            meta[col] = ""
    meta = meta[["listing_id", "listing_name", "subtitle", "image_url"]].drop_duplicates("listing_id")

    if bridge_df is None or bridge_df.empty:
        meta["supabase_property_id"] = ""
        meta["property_name"] = ""
        return meta

    photo_by_property = {}
    if photos_df is not None and not photos_df.empty:
        photo_by_property = dict(zip(photos_df["property_id"].astype(str), photos_df["image_url"].astype(str)))

    bridge_by_listing = {str(row.get("listing_id")): row for _, row in bridge_df.iterrows()}
    out_rows: list[dict[str, Any]] = []
    for _, row in meta.iterrows():
        payload = row.to_dict()
        bridge = bridge_by_listing.get(str(row.get("listing_id")))
        if bridge is not None:
            pid = str(bridge.get("supabase_property_id") or "")
            payload["supabase_property_id"] = pid
            payload["property_name"] = str(bridge.get("property_name") or "")
            image_url = photo_by_property.get(pid)
            if image_url:
                payload["image_url"] = image_url
            if not str(payload.get("listing_name") or "").strip():
                payload["listing_name"] = str(bridge.get("listing_name") or bridge.get("property_name") or payload.get("listing_id"))
        else:
            payload["supabase_property_id"] = ""
            payload["property_name"] = ""
        out_rows.append(payload)

    return pd.DataFrame(out_rows)


def _cleaner_name(row: dict[str, Any]) -> str:
    first = str(row.get("first_name") or "").strip()
    last = str(row.get("last_name") or "").strip()
    full = " ".join(part for part in [first, last] if part).strip()
    return full or str(row.get("name") or row.get("display_name") or "").strip()


def load_cleaning_calendar_events(
    *,
    start_date: date,
    end_date: date,
    property_bridge_df: pd.DataFrame,
    supabase_reservations_df: Optional[pd.DataFrame] = None,
    local_reservations_df: Optional[pd.DataFrame] = None,
    client=None,
) -> pd.DataFrame:
    client = client or get_supabase_client()
    if not client or property_bridge_df is None or property_bridge_df.empty:
        return _empty_cleanings()

    # Load operations around the selected window. Cleaning windows may begin just
    # outside the selected range and still be relevant once snapped to full weeks.
    start_iso = (start_date - timedelta(days=7)).isoformat()
    end_iso = (end_date + timedelta(days=7)).isoformat()
    request_cols = [
        "id",
        "property_id",
        "reservation_id",
        "status",
        "title",
        "assigned_cleaner_id",
        "scheduled_start_at",
        "scheduled_end_at",
        "completion_deadline_at",
        "urgent",
        "public_token",
        "accepted_at",
        "refused_at",
        "total_cost_eur",
    ]
    request_rows = _execute_data(
        client.table("cleaning_requests")
        .select(",".join(request_cols))
        .neq("status", "cancelled")
        .lte("scheduled_start_at", end_iso)
        .gte("scheduled_start_at", start_iso)
        .order("scheduled_start_at", desc=False)
    )
    if not request_rows:
        return _empty_cleanings()

    # Cleaner lookup.
    cleaner_ids = sorted({str(r.get("assigned_cleaner_id") or "").strip() for r in request_rows if r.get("assigned_cleaner_id")})
    cleaners_by_id: dict[str, str] = {}
    if cleaner_ids:
        cleaner_rows: list[dict[str, Any]] = []
        # Keep this deliberately defensive: the Next.js app only guarantees
        # id/first_name/last_name. Selecting optional columns that do not exist
        # makes PostgREST reject the whole query, so try the known schema first
        # and only fall back to broader variants if needed.
        cleaner_selects = [
            "id,first_name,last_name",
            "id,first_name,last_name,phone,status,active",
            "id,name,display_name",
            "*",
        ]
        for chunk in _chunks(cleaner_ids, 150):
            chunk_rows: list[dict[str, Any]] = []
            for select_expr in cleaner_selects:
                chunk_rows = _execute_data(client.table("cleaners").select(select_expr).in_("id", chunk))
                if chunk_rows:
                    break
            cleaner_rows.extend(chunk_rows)
        cleaners_by_id = {str(r.get("id")): _cleaner_name(r) for r in cleaner_rows if r.get("id")}

    property_to_listing = dict(zip(property_bridge_df["supabase_property_id"].astype(str), property_bridge_df["listing_id"].astype(str)))

    # Reservation-id lookup improves mapping for requests tied to a specific stay.
    reservation_to_listing: dict[str, str] = {}
    if supabase_reservations_df is not None and not supabase_reservations_df.empty and local_reservations_df is not None and not local_reservations_df.empty:
        source_to_listing = {}
        if {"source_booking_id", "listing_id"}.issubset(local_reservations_df.columns):
            for _, row in local_reservations_df[["source_booking_id", "listing_id"]].iterrows():
                source_to_listing[_id_key(row.get("source_booking_id"))] = str(row.get("listing_id") or "")
        for _, row in supabase_reservations_df.iterrows():
            rid = str(row.get("id") or "").strip()
            lid = source_to_listing.get(_id_key(row.get("source_booking_id"))) or property_to_listing.get(str(row.get("property_id") or ""))
            if rid and lid:
                reservation_to_listing[rid] = lid

    rows: list[dict[str, Any]] = []
    for request in request_rows:
        rid = str(request.get("reservation_id") or "").strip()
        pid = str(request.get("property_id") or "").strip()
        listing_id = reservation_to_listing.get(rid) or property_to_listing.get(pid)
        if not listing_id:
            continue

        scheduled = _safe_date(request.get("scheduled_start_at"))
        deadline = _safe_date(request.get("completion_deadline_at")) or _safe_date(request.get("scheduled_end_at"))
        if not scheduled:
            continue

        status = str(request.get("status") or "created")
        rows.append(
            {
                "listing_id": listing_id,
                "date": scheduled,
                "status": status,
                "label": str(request.get("title") or "Ménage"),
                "cleaner_name": cleaners_by_id.get(str(request.get("assigned_cleaner_id") or ""), ""),
                "window_start": scheduled,
                "window_end": deadline or scheduled + timedelta(days=1),
                "supabase_property_id": pid,
                "cleaning_request_id": str(request.get("id") or ""),
                "public_token": str(request.get("public_token") or ""),
            }
        )

    if not rows:
        return _empty_cleanings()
    return pd.DataFrame(rows, columns=_empty_cleanings().columns)


def build_operating_map_inputs(
    reservations_df: pd.DataFrame,
    start_date: date,
    end_date: date,
    *,
    base_listing_meta_df: Optional[pd.DataFrame] = None,
    fallback_cleaning_df: Optional[pd.DataFrame] = None,
) -> OperatingMapInputs:
    """Build the Supabase-backed inputs for the Streamlit operating map.

    This is deliberately read-only and conservative: if Supabase is missing or
    partially unmapped, callers can fall back to their existing local inputs.
    """
    client = get_supabase_client()
    if not client:
        return OperatingMapInputs(
            listing_meta_df=base_listing_meta_df.copy() if base_listing_meta_df is not None else _empty_listing_meta(),
            cleaning_df=fallback_cleaning_df.copy() if fallback_cleaning_df is not None else _empty_cleanings(),
            property_bridge_df=_empty_bridge(),
            diagnostics={"supabase_client": False},
        )

    bridge, properties, sup_res, diagnostics = build_property_bridge(
        reservations_df,
        start_date=start_date,
        end_date=end_date,
        base_listing_meta_df=base_listing_meta_df,
        client=client,
    )
    photos = load_property_cover_photos(client)
    listing_meta = build_listing_meta_from_bridge(reservations_df, bridge, photos, base_listing_meta_df=base_listing_meta_df)

    cleaning = load_cleaning_calendar_events(
        start_date=start_date,
        end_date=end_date,
        property_bridge_df=bridge,
        supabase_reservations_df=sup_res,
        local_reservations_df=reservations_df,
        client=client,
    )

    # Merge fallback cleaning rows only when Supabase returns nothing. This avoids
    # double-drawing the same broom icons once the bridge is active.
    if cleaning.empty and fallback_cleaning_df is not None and not fallback_cleaning_df.empty:
        cleaning = fallback_cleaning_df.copy()

    diagnostics.update(
        {
            "cover_photos": int(len(photos)) if photos is not None else 0,
            "cleaning_requests_mapped": int(len(cleaning)) if cleaning is not None else 0,
        }
    )

    return OperatingMapInputs(
        listing_meta_df=listing_meta,
        cleaning_df=cleaning,
        property_bridge_df=bridge,
        diagnostics=diagnostics,
    )
