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


AIRBNB_REVIEWS_PATH = "/channels/airbnb/reviews"


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def first(row: dict[str, Any], *names: str) -> Any:
    keys = {str(key).lower(): key for key in row}

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
        return [row for row in response if isinstance(row, dict)]

    if not isinstance(response, dict):
        return []

    data = response.get("data")

    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]

    if isinstance(data, dict):
        for key in ("reviews", "items", "results"):
            value = data.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]

    for key in ("reviews", "items", "results"):
        value = response.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]

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

    digest = hashlib.sha256(
        json.dumps(row, sort_keys=True, default=str).encode()
    ).hexdigest()

    return f"payload:{digest}"


def canonical_category(value: Any) -> str:
    raw = re.sub(r"[^a-z0-9]", "", (clean(value) or "").lower())

    aliases = {
        "cleanliness": "cleanliness",
        "accuracy": "accuracy",
        "communication": "communication",
        "checkin": "checkin",
        "checkinexperience": "checkin",
        "arrival": "checkin",
        "location": "location",
        "value": "value",
        "valueformoney": "value",
    }

    return aliases.get(raw, raw or "unknown")


def category_payload(
    row: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, float | None]]:
    selected: dict[str, float | None] = {
        "cleanliness": None,
        "accuracy": None,
        "communication": None,
        "checkin": None,
        "location": None,
        "value": None,
    }

    categories: dict[str, Any] = {}

    nested = first(
        row,
        "category_ratings",
        "categoryRatings",
        "ratings",
        "scores",
    )

    # Actual Airbnb/Beds24 structure:
    #
    # [
    #   {
    #     "category": "CLEANLINESS",
    #     "rating": 5,
    #     "comment": "...",
    #     "review_category_tags": [...]
    #   }
    # ]
    if isinstance(nested, list):
        for item in nested:
            if not isinstance(item, dict):
                continue

            category = canonical_category(
                first(item, "category", "name", "type")
            )
            rating = number(first(item, "rating", "score", "value"))

            categories[category] = {
                "rating": rating,
                "comment": clean(first(item, "comment", "text")),
                "tags": first(
                    item,
                    "review_category_tags",
                    "reviewCategoryTags",
                    "tags",
                )
                or [],
            }

            if category in selected:
                selected[category] = rating

    elif isinstance(nested, dict):
        for key, value in nested.items():
            category = canonical_category(key)

            if isinstance(value, dict):
                rating = number(first(value, "rating", "score", "value"))
                categories[category] = {
                    "rating": rating,
                    "comment": clean(first(value, "comment", "text")),
                    "tags": first(
                        value,
                        "review_category_tags",
                        "reviewCategoryTags",
                        "tags",
                    )
                    or [],
                }
            else:
                rating = number(value)
                categories[category] = {"rating": rating}

            if category in selected:
                selected[category] = rating

    # Compatibility with any flattened payload Beds24 may return later.
    flattened_aliases = {
        "cleanliness": (
            "cleanliness",
            "cleanlinessRating",
            "cleanliness_rating",
        ),
        "accuracy": (
            "accuracy",
            "accuracyRating",
            "accuracy_rating",
        ),
        "communication": (
            "communication",
            "communicationRating",
            "communication_rating",
        ),
        "checkin": (
            "checkin",
            "checkIn",
            "checkinRating",
            "check_in_rating",
        ),
        "location": (
            "location",
            "locationRating",
            "location_rating",
        ),
        "value": (
            "value",
            "valueRating",
            "value_rating",
        ),
    }

    for category, aliases in flattened_aliases.items():
        if selected[category] is not None:
            continue

        rating = number(first(row, *aliases))

        if rating is not None:
            selected[category] = rating
            categories.setdefault(category, {"rating": rating})

    return categories, selected


def load_links(
    supabase,
) -> tuple[
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
    list[dict[str, Any]],
]:
    result = (
        supabase.table("property_source_links")
        .select(
            "property_id,"
            "source_property_id,"
            "source_room_id,"
            "source_listing_id,"
            "active"
        )
        .eq("source_system", "beds24")
        .eq("active", True)
        .execute()
    )

    links = result.data or []
    by_room: dict[str, dict[str, Any]] = {}
    by_property: dict[str, dict[str, Any]] = {}

    for row in links:
        source_room_id = clean(row.get("source_room_id"))
        source_property_id = clean(row.get("source_property_id"))

        if source_room_id:
            by_room[source_room_id] = row

        if source_property_id:
            by_property[source_property_id] = row

    return by_room, by_property, links


def load_reservations(
    supabase,
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    result = (
        supabase.table("reservations")
        .select(
            "id,"
            "property_id,"
            "source_booking_id,"
            "guest_name,"
            "checkin_at,"
            "checkout_at"
        )
        .eq("source_system", "beds24")
        .execute()
    )

    rows = result.data or []

    by_booking = {
        str(row["source_booking_id"]): row
        for row in rows
        if row.get("source_booking_id")
    }

    return by_booking, rows


def match_reservation(
    payload: dict[str, Any],
    by_booking: dict[str, dict[str, Any]],
    reservations: list[dict[str, Any]],
) -> None:
    external_booking_id = clean(payload.get("external_booking_id"))

    if external_booking_id and external_booking_id in by_booking:
        reservation = by_booking[external_booking_id]

        payload.update(
            reservation_id=reservation["id"],
            property_id=(
                payload.get("property_id")
                or reservation.get("property_id")
            ),
            match_status="direct_booking_id",
            match_confidence=1.0,
            match_notes=(
                "Airbnb reservation confirmation code matched "
                "reservation source_booking_id"
            ),
        )
        return

    property_id = payload.get("property_id")
    review_date = clean(payload.get("review_date"))
    guest = normalize_name(payload.get("guest_name"))

    candidates: list[dict[str, Any]] = []

    for reservation in reservations:
        if (
            property_id
            and reservation.get("property_id") != property_id
        ):
            continue

        score = 0
        checkout = clean(reservation.get("checkout_at"))

        if (
            review_date
            and checkout
            and review_date[:10] >= checkout[:10]
        ):
            score += 1

        if (
            guest
            and normalize_name(reservation.get("guest_name")) == guest
        ):
            score += 2

        if score >= 3:
            candidates.append(reservation)

    if len(candidates) == 1:
        reservation = candidates[0]

        payload.update(
            reservation_id=reservation["id"],
            property_id=(
                payload.get("property_id")
                or reservation.get("property_id")
            ),
            match_status="strong_date_guest",
            match_confidence=0.85,
            match_notes=(
                "Property + guest name + review after checkout"
            ),
        )

    elif len(candidates) > 1:
        payload.update(
            match_status="ambiguous",
            match_confidence=0.4,
            match_notes=f"{len(candidates)} candidate reservations",
        )


def make_payload(
    row: dict[str, Any],
    by_room: dict[str, dict[str, Any]],
    by_property: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    # The Airbnb reviews response does not include the Beds24 room id,
    # so fetch_reviews() injects this context before normalisation.
    source_room_id = clean(
        first(
            row,
            "_beds24_room_id",
            "roomId",
            "room_id",
        )
    )

    source_property_id = clean(
        first(
            row,
            "_beds24_property_id",
            "propertyId",
            "property_id",
        )
    )

    source_listing_id = clean(
        first(
            row,
            "listing_id",
            "listingId",
        )
    )

    link = (
        by_room.get(source_room_id or "")
        or by_property.get(source_property_id or "")
    )

    categories, selected = category_payload(row)

    return {
        "channel": "airbnb",
        "source_system": "beds24",
        "external_review_id": stable_review_id(row),
        "external_booking_id": clean(
            first(
                row,
                "reservation_confirmation_code",
                "reservationConfirmationCode",
                "bookingId",
                "booking_id",
                "reservationId",
                "reservation_id",
            )
        ),
        "source_property_id": (
            source_property_id
            or clean((link or {}).get("source_property_id"))
        ),
        "source_room_id": source_room_id,
        "source_listing_id": (
            source_listing_id
            or clean((link or {}).get("source_listing_id"))
        ),
        "property_id": (link or {}).get("property_id"),
        "review_date": clean(
            first(
                row,
                "submitted_at",
                "submittedAt",
                "first_completed_at",
                "firstCompletedAt",
                "reviewDate",
                "review_date",
                "date",
                "createdAt",
                "created_at",
            )
        ),
        "guest_name": clean(
            first(
                row,
                "guestName",
                "guest_name",
                "reviewerName",
                "reviewer_name",
                "name",
            )
        ),
        "overall_rating": number(
            first(
                row,
                "overall_rating",
                "overallRating",
                "rating",
                "score",
            )
        ),
        "cleanliness_rating": selected["cleanliness"],
        "accuracy_rating": selected["accuracy"],
        "checkin_rating": selected["checkin"],
        "communication_rating": selected["communication"],
        "location_rating": selected["location"],
        "value_rating": selected["value"],
        "category_ratings": categories,
        "review_text": clean(
            first(
                row,
                "public_review",
                "publicReview",
                "review",
                "reviewText",
                "review_text",
                "text",
                "comments",
            )
        ),
        "host_reply": clean(
            first(
                row,
                "reviewee_response",
                "revieweeResponse",
                "reply",
                "hostReply",
                "host_reply",
                "response",
            )
        ),
        "match_status": "unmatched",
        "match_confidence": 0.0,
        "match_notes": (
            None
            if link
            else "No active property_source_links mapping"
        ),
        "source_modified_at": clean(
            first(
                row,
                "responded_at",
                "respondedAt",
                "modifiedAt",
                "modified_at",
                "updatedAt",
                "updated_at",
                "submitted_at",
            )
        ),
        "raw_payload": {
            key: value
            for key, value in row.items()
            if not key.startswith("_beds24_")
        },
        "imported_at": datetime.now(timezone.utc).isoformat(),
    }


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    normalized = value.strip().replace("Z", "+00:00")

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(
            f"Invalid --modified-from value: {value!r}"
        ) from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def review_datetime(row: dict[str, Any]) -> datetime | None:
    value = clean(
        first(
            row,
            "submitted_at",
            "submittedAt",
            "first_completed_at",
            "firstCompletedAt",
        )
    )

    if not value:
        return None

    try:
        return parse_datetime(value)
    except ValueError:
        return None


def select_links(
    links: list[dict[str, Any]],
    requested_room_ids: list[int] | None,
    requested_property_ids: list[int] | None,
) -> list[dict[str, Any]]:
    selected = links

    if requested_room_ids:
        allowed_rooms = {str(value) for value in requested_room_ids}
        selected = [
            link
            for link in selected
            if clean(link.get("source_room_id")) in allowed_rooms
        ]

    if requested_property_ids:
        allowed_properties = {
            str(value)
            for value in requested_property_ids
        }
        selected = [
            link
            for link in selected
            if clean(link.get("source_property_id"))
            in allowed_properties
        ]

    selected = [
        link
        for link in selected
        if clean(link.get("source_room_id"))
    ]

    selected.sort(
        key=lambda link: (
            clean(link.get("source_property_id")) or "",
            clean(link.get("source_room_id")) or "",
        )
    )

    return selected


def fetch_reviews(
    client: Beds24Client,
    link: dict[str, Any],
    max_pages: int,
) -> list[dict[str, Any]]:
    room_id = int(link["source_room_id"])
    property_id = clean(link.get("source_property_id"))

    collected: list[dict[str, Any]] = []

    for page in range(1, max_pages + 1):
        params: dict[str, Any] = {"roomId": room_id}

        if page > 1:
            params["page"] = page

        response = client.get(
            AIRBNB_REVIEWS_PATH,
            params=params,
        )

        page_rows = rows_from_response(response)

        for row in page_rows:
            enriched = dict(row)
            enriched["_beds24_room_id"] = room_id
            enriched["_beds24_property_id"] = property_id
            collected.append(enriched)

        print(
            f"Beds24 room {room_id}: "
            f"page {page}, {len(page_rows)} reviews"
        )

        if not has_next(response):
            break
    else:
        raise RuntimeError(
            f"Reached --max-pages={max_pages} for Beds24 "
            f"room {room_id}; refusing to silently truncate."
        )

    return collected


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Import Airbnb guest reviews from Beds24 into "
            "guest_reviews."
        )
    )

    parser.add_argument(
        "--property-id",
        type=int,
        action="append",
        help=(
            "Restrict import to a Beds24 property id. "
            "Repeat for several."
        ),
    )

    parser.add_argument(
        "--room-id",
        type=int,
        action="append",
        help=(
            "Restrict import to a Beds24 room id. "
            "Repeat for several."
        ),
    )

    parser.add_argument(
        "--modified-from",
        help=(
            "Only retain reviews submitted on or after this "
            "ISO date/timestamp. Filtering is performed locally "
            "because the Airbnb reviews endpoint only documents "
            "roomId."
        ),
    )

    parser.add_argument(
        "--max-pages",
        type=int,
        default=100,
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
    )

    parser.add_argument(
        "--dump-raw",
        help="Write raw API rows to a JSON file.",
    )

    args = parser.parse_args()

    if args.max_pages < 1:
        parser.error("--max-pages must be at least 1")

    modified_from = parse_datetime(args.modified_from)

    load_dotenv()

    client = Beds24Client()
    supabase = get_supabase_client()

    by_room, by_property, links = load_links(supabase)
    selected_links = select_links(
        links,
        requested_room_ids=args.room_id,
        requested_property_ids=args.property_id,
    )

    if not selected_links:
        raise RuntimeError(
            "No active Beds24 room mappings matched the supplied "
            "filters in property_source_links."
        )

    print(
        "Beds24 room mappings selected: "
        + ", ".join(
            str(link["source_room_id"])
            for link in selected_links
        )
    )

    by_booking, reservations = load_reservations(supabase)

    raw_rows: list[dict[str, Any]] = []

    for link in selected_links:
        raw_rows.extend(
            fetch_reviews(
                client=client,
                link=link,
                max_pages=args.max_pages,
            )
        )

    if modified_from is not None:
        before = len(raw_rows)
        raw_rows = [
            row
            for row in raw_rows
            if (
                review_datetime(row) is not None
                and review_datetime(row) >= modified_from
            )
        ]

        print(
            f"Local modified-from filter retained "
            f"{len(raw_rows)}/{before} reviews."
        )

    if args.dump_raw:
        with open(args.dump_raw, "w", encoding="utf-8") as handle:
            json.dump(
                [
                    {
                        key: value
                        for key, value in row.items()
                        if not key.startswith("_beds24_")
                    }
                    for row in raw_rows
                ],
                handle,
                ensure_ascii=False,
                indent=2,
                default=str,
            )

    payloads: list[dict[str, Any]] = []

    for row in raw_rows:
        payload = make_payload(
            row,
            by_room=by_room,
            by_property=by_property,
        )

        match_reservation(
            payload,
            by_booking=by_booking,
            reservations=reservations,
        )

        payloads.append(payload)

    payloads = list(
        {
            payload["external_review_id"]: payload
            for payload in payloads
        }.values()
    )

    counts: dict[str, int] = {}

    for payload in payloads:
        status = payload["match_status"]
        counts[status] = counts.get(status, 0) + 1

    print(
        f"Reviews fetched: {len(raw_rows)}; "
        f"unique: {len(payloads)}; "
        f"matches: {counts}"
    )

    if payloads[:2]:
        print(
            json.dumps(
                payloads[:2],
                indent=2,
                ensure_ascii=False,
                default=str,
            )
        )

    if args.dry_run:
        print("Dry run complete; database was not changed.")
        return

    if payloads:
        (
            supabase.table("guest_reviews")
            .upsert(
                payloads,
                on_conflict=(
                    "source_system,channel,external_review_id"
                ),
            )
            .execute()
        )

    print(f"Done. Upserted {len(payloads)} reviews.")


if __name__ == "__main__":
    main()
