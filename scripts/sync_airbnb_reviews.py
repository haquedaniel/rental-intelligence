from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client
from rental_intel.ingest.beds24 import Beds24Client


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def first(row: dict[str, Any], *names: str) -> Any:
    keys = {str(k).lower(): k for k in row}
    for name in names:
        key = keys.get(name.lower())
        if key is not None and row.get(key) not in (None, ""):
            return row.get(key)
    return None


def number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def rows_from_response(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [x for x in response if isinstance(x, dict)]
    if not isinstance(response, dict):
        return []
    data = response.get("data")
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for key in ("reviews", "items", "results"):
            value = data.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
    for key in ("reviews", "items", "results"):
        value = response.get(key)
        if isinstance(value, list):
            return [x for x in value if isinstance(x, dict)]
    return []


def has_next(response: Any) -> bool:
    if not isinstance(response, dict):
        return False
    pages = response.get("pages")
    if isinstance(pages, dict):
        return bool(pages.get("nextPageExists"))
    return bool(response.get("nextPageExists") or response.get("next"))


def normalize_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", (clean(value) or "").lower())


def stable_review_id(row: dict[str, Any]) -> str:
    explicit = first(row, "id", "reviewId", "review_id", "uid")
    if explicit is not None:
        return str(explicit)
    digest = hashlib.sha256(json.dumps(row, sort_keys=True, default=str).encode()).hexdigest()
    return f"payload:{digest}"


def category_payload(row: dict[str, Any]) -> tuple[dict[str, float], dict[str, float | None]]:
    aliases = {
        "cleanliness": ("cleanliness", "cleanlinessRating", "cleanliness_rating"),
        "accuracy": ("accuracy", "accuracyRating", "accuracy_rating"),
        "checkin": ("checkin", "checkIn", "checkinRating", "check_in_rating"),
        "communication": ("communication", "communicationRating", "communication_rating"),
        "location": ("location", "locationRating", "location_rating"),
        "value": ("value", "valueRating", "value_rating"),
    }
    nested = first(row, "ratings", "categoryRatings", "category_ratings", "scores")
    source = nested if isinstance(nested, dict) else row
    categories: dict[str, float] = {}
    selected: dict[str, float | None] = {}
    for canonical, names in aliases.items():
        value = number(first(source, *names))
        selected[canonical] = value
        if value is not None:
            categories[canonical] = value
    if isinstance(nested, dict):
        for key, value in nested.items():
            parsed = number(value)
            if parsed is not None:
                categories[str(key)] = parsed
    return categories, selected


def load_links(supabase) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    result = supabase.table("property_source_links").select(
        "property_id,source_property_id,source_room_id,source_listing_id,active"
    ).eq("source_system", "beds24").eq("active", True).execute()
    by_room, by_property = {}, {}
    for row in result.data or []:
        if row.get("source_room_id"):
            by_room[str(row["source_room_id"])] = row
        if row.get("source_property_id"):
            by_property[str(row["source_property_id"])] = row
    return by_room, by_property


def load_reservations(supabase) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    result = supabase.table("reservations").select(
        "id,property_id,source_booking_id,guest_name,checkin_at,checkout_at"
    ).eq("source_system", "beds24").execute()
    rows = result.data or []
    return ({str(r["source_booking_id"]): r for r in rows if r.get("source_booking_id")}, rows)


def match_reservation(payload: dict[str, Any], by_booking: dict[str, dict[str, Any]], reservations: list[dict[str, Any]]) -> None:
    booking_id = payload.get("external_booking_id")
    if booking_id and str(booking_id) in by_booking:
        r = by_booking[str(booking_id)]
        payload.update(reservation_id=r["id"], property_id=payload.get("property_id") or r.get("property_id"), match_status="direct_booking_id", match_confidence=1.0, match_notes="Beds24 booking id")
        return

    property_id = payload.get("property_id")
    review_date = clean(payload.get("review_date"))
    guest = normalize_name(payload.get("guest_name"))
    candidates = []
    for r in reservations:
        if property_id and r.get("property_id") != property_id:
            continue
        score = 0
        checkout = clean(r.get("checkout_at"))
        if review_date and checkout and review_date[:10] >= checkout[:10]:
            score += 1
        if guest and normalize_name(r.get("guest_name")) == guest:
            score += 2
        if score >= 3:
            candidates.append(r)
    if len(candidates) == 1:
        r = candidates[0]
        payload.update(reservation_id=r["id"], property_id=payload.get("property_id") or r.get("property_id"), match_status="strong_date_guest", match_confidence=0.85, match_notes="Property + guest name + review after checkout")
    elif len(candidates) > 1:
        payload.update(match_status="ambiguous", match_confidence=0.4, match_notes=f"{len(candidates)} candidate reservations")


def make_payload(row: dict[str, Any], by_room: dict[str, dict[str, Any]], by_property: dict[str, dict[str, Any]]) -> dict[str, Any]:
    source_property_id = clean(first(row, "propertyId", "property_id"))
    source_room_id = clean(first(row, "roomId", "room_id", "listingId", "listing_id"))
    link = (by_room.get(source_room_id or "") or by_property.get(source_property_id or ""))
    categories, selected = category_payload(row)
    return {
        "channel": "airbnb",
        "source_system": "beds24",
        "external_review_id": stable_review_id(row),
        "external_booking_id": clean(first(row, "bookingId", "booking_id", "reservationId", "reservation_id")),
        "source_property_id": source_property_id,
        "source_room_id": source_room_id,
        "source_listing_id": clean(first(row, "listingId", "listing_id")) or (link or {}).get("source_listing_id"),
        "property_id": (link or {}).get("property_id"),
        "review_date": clean(first(row, "reviewDate", "review_date", "date", "createdAt", "created_at")),
        "guest_name": clean(first(row, "guestName", "guest_name", "reviewerName", "reviewer_name", "name")),
        "overall_rating": number(first(row, "overallRating", "overall_rating", "rating", "score")),
        "cleanliness_rating": selected["cleanliness"],
        "accuracy_rating": selected["accuracy"],
        "checkin_rating": selected["checkin"],
        "communication_rating": selected["communication"],
        "location_rating": selected["location"],
        "value_rating": selected["value"],
        "category_ratings": categories,
        "review_text": clean(first(row, "review", "reviewText", "review_text", "publicReview", "public_review", "text", "comments")),
        "host_reply": clean(first(row, "reply", "hostReply", "host_reply", "response")),
        "match_status": "unmatched",
        "match_confidence": 0.0,
        "match_notes": None if link else "No active property_source_links mapping",
        "source_modified_at": clean(first(row, "modifiedAt", "modified_at", "updatedAt", "updated_at")),
        "raw_payload": row,
        "imported_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Airbnb reviews from Beds24 into guest_reviews.")
    parser.add_argument("--property-id", type=int, action="append", help="Beds24 property id; repeat for several. Omit to query all accessible reviews.")
    parser.add_argument("--room-id", type=int)
    parser.add_argument("--modified-from", help="ISO timestamp/date for incremental sync")
    parser.add_argument("--max-pages", type=int, default=100)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--dump-raw", help="Write raw API rows to JSON for payload verification")
    args = parser.parse_args()

    load_dotenv()
    client = Beds24Client()
    supabase = get_supabase_client()
    by_room, by_property = load_links(supabase)
    by_booking, reservations = load_reservations(supabase)

    property_ids = args.property_id or [None]
    raw_rows: list[dict[str, Any]] = []
    for property_id in property_ids:
        for page in range(1, args.max_pages + 1):
            response = client.get_airbnb_reviews(property_id=property_id, room_id=args.room_id, modified_from=args.modified_from, page=page)
            page_rows = rows_from_response(response)
            raw_rows.extend(page_rows)
            if not has_next(response):
                break

    if args.dump_raw:
        with open(args.dump_raw, "w", encoding="utf-8") as handle:
            json.dump(raw_rows, handle, ensure_ascii=False, indent=2, default=str)

    payloads = []
    for row in raw_rows:
        payload = make_payload(row, by_room, by_property)
        match_reservation(payload, by_booking, reservations)
        payloads.append(payload)
    payloads = list({p["external_review_id"]: p for p in payloads}.values())

    counts: dict[str, int] = {}
    for payload in payloads:
        counts[payload["match_status"]] = counts.get(payload["match_status"], 0) + 1
    print(f"Reviews fetched: {len(raw_rows)}; unique: {len(payloads)}; matches: {counts}")
    if payloads[:2]:
        print(json.dumps(payloads[:2], indent=2, ensure_ascii=False, default=str))
    if args.dry_run:
        return
    if payloads:
        supabase.table("guest_reviews").upsert(payloads, on_conflict="source_system,channel,external_review_id").execute()
    print("Done.")


if __name__ == "__main__":
    main()
