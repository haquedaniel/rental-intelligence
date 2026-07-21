from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from typing import Any, Iterable

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client
from rental_intel.ingest.beds24 import Beds24Client


BOOKINGS_PATH = "/bookings"


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_reference(value: Any) -> str:
    """
    Airbnb confirmation codes are normally alphanumeric.
    Ignore casing, whitespace and punctuation when comparing.
    """
    return re.sub(
        r"[^A-Z0-9]",
        "",
        (clean(value) or "").upper(),
    )


def rows_from_response(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [
            row for row in response
            if isinstance(row, dict)
        ]

    if not isinstance(response, dict):
        return []

    data = response.get("data")

    if isinstance(data, list):
        return [
            row for row in data
            if isinstance(row, dict)
        ]

    return []


def chunks(values: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


def load_selected_links(
    supabase,
    room_ids: list[int] | None,
    property_ids: list[int] | None,
) -> list[dict[str, Any]]:
    result = (
        supabase.table("property_source_links")
        .select(
            "property_id,"
            "source_property_id,"
            "source_room_id,"
            "active"
        )
        .eq("source_system", "beds24")
        .eq("active", True)
        .execute()
    )

    links = result.data or []

    if room_ids:
        allowed = {str(value) for value in room_ids}
        links = [
            link for link in links
            if clean(link.get("source_room_id")) in allowed
        ]

    if property_ids:
        allowed = {str(value) for value in property_ids}
        links = [
            link for link in links
            if clean(link.get("source_property_id")) in allowed
        ]

    return links


def load_reservations(
    supabase,
    pilotys_property_ids: list[str],
) -> tuple[
    dict[str, dict[str, Any]],
    list[str],
]:
    query = (
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
    )

    if pilotys_property_ids:
        query = query.in_("property_id", pilotys_property_ids)

    result = query.execute()
    rows = result.data or []

    by_booking_id = {
        str(row["source_booking_id"]): row
        for row in rows
        if row.get("source_booking_id")
    }

    booking_ids = sorted(
        by_booking_id,
        key=lambda value: int(value)
        if value.isdigit()
        else value,
    )

    return by_booking_id, booking_ids


def fetch_beds24_bookings(
    client: Beds24Client,
    booking_ids: list[str],
    batch_size: int,
) -> list[dict[str, Any]]:
    bookings: list[dict[str, Any]] = []

    for number, batch in enumerate(
        chunks(booking_ids, batch_size),
        start=1,
    ):
        ids = [
            int(value) if value.isdigit() else value
            for value in batch
        ]

        response = client.get(
            BOOKINGS_PATH,
            params={"id": ids},
        )

        rows = rows_from_response(response)
        bookings.extend(rows)

        print(
            f"Beds24 booking batch {number}: "
            f"requested {len(batch)}, received {len(rows)}"
        )

    return bookings


def booking_aliases(
    booking: dict[str, Any],
) -> set[str]:
    aliases: set[str] = set()

    # These are the fields most likely to contain the Airbnb
    # reservation confirmation code.
    for field in (
        "apiReference",
        "reference",
        "apiSourceId",
    ):
        normalized = normalize_reference(
            booking.get(field)
        )

        if normalized:
            aliases.add(normalized)

    return aliases


def build_reference_index(
    bookings: list[dict[str, Any]],
) -> tuple[dict[str, str], dict[str, set[str]]]:
    candidates: dict[str, set[str]] = defaultdict(set)

    for booking in bookings:
        booking_id = clean(booking.get("id"))

        if not booking_id:
            continue

        for alias in booking_aliases(booking):
            candidates[alias].add(booking_id)

    unique: dict[str, str] = {}
    ambiguous: dict[str, set[str]] = {}

    for alias, booking_ids in candidates.items():
        if len(booking_ids) == 1:
            unique[alias] = next(iter(booking_ids))
        else:
            ambiguous[alias] = booking_ids

    return unique, ambiguous


def load_unmatched_reviews(
    supabase,
    pilotys_property_ids: list[str],
) -> list[dict[str, Any]]:
    query = (
        supabase.table("guest_reviews")
        .select(
            "id,"
            "property_id,"
            "external_review_id,"
            "external_booking_id,"
            "review_date,"
            "match_status"
        )
        .eq("source_system", "beds24")
        .eq("channel", "airbnb")
    )

    if pilotys_property_ids:
        query = query.in_(
            "property_id",
            pilotys_property_ids,
        )

    result = query.execute()
    return result.data or []


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Link imported Airbnb reviews to existing "
            "Pilotys reservations using live Beds24 "
            "booking references."
        )
    )

    parser.add_argument(
        "--room-id",
        type=int,
        action="append",
        help=(
            "Restrict to a Beds24 room id. "
            "Repeat for several."
        ),
    )

    parser.add_argument(
        "--property-id",
        type=int,
        action="append",
        help=(
            "Restrict to a Beds24 property id. "
            "Repeat for several."
        ),
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Number of Beds24 booking ids per API call.",
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Apply matches. Without this flag the script "
            "only performs a dry run."
        ),
    )

    parser.add_argument(
        "--dump-bookings",
        help=(
            "Optional path for dumping the Beds24 booking "
            "payloads used during matching."
        ),
    )

    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be at least 1")

    load_dotenv()

    client = Beds24Client()
    supabase = get_supabase_client()

    links = load_selected_links(
        supabase,
        room_ids=args.room_id,
        property_ids=args.property_id,
    )

    if not links:
        raise RuntimeError(
            "No active Beds24 property mappings matched."
        )

    pilotys_property_ids = sorted({
        str(link["property_id"])
        for link in links
        if link.get("property_id")
    })

    selected_room_ids = sorted({
        str(link["source_room_id"])
        for link in links
        if link.get("source_room_id")
    })

    print(
        "Pilotys properties: "
        + ", ".join(pilotys_property_ids)
    )
    print(
        "Beds24 rooms: "
        + ", ".join(selected_room_ids)
    )

    reservations_by_booking_id, booking_ids = (
        load_reservations(
            supabase,
            pilotys_property_ids,
        )
    )

    if not booking_ids:
        raise RuntimeError(
            "No Beds24 source_booking_id values were found "
            "for the selected properties."
        )

    print(
        f"Existing Pilotys reservations: "
        f"{len(booking_ids)}"
    )

    bookings = fetch_beds24_bookings(
        client,
        booking_ids=booking_ids,
        batch_size=args.batch_size,
    )

    # Protect against a booking from another room/property
    # accidentally appearing in a broad result.
    bookings = [
        booking
        for booking in bookings
        if (
            not selected_room_ids
            or clean(booking.get("roomId"))
            in selected_room_ids
        )
    ]

    print(
        f"Beds24 bookings retained after room filter: "
        f"{len(bookings)}"
    )

    if args.dump_bookings:
        with open(
            args.dump_bookings,
            "w",
            encoding="utf-8",
        ) as handle:
            json.dump(
                bookings,
                handle,
                ensure_ascii=False,
                indent=2,
                default=str,
            )

    reference_to_booking_id, ambiguous = (
        build_reference_index(bookings)
    )

    print(
        f"Unique OTA reference aliases: "
        f"{len(reference_to_booking_id)}"
    )
    print(
        f"Ambiguous aliases ignored: {len(ambiguous)}"
    )

    reviews = load_unmatched_reviews(
        supabase,
        pilotys_property_ids,
    )

    matched: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    ambiguous_reviews: list[dict[str, Any]] = []

    for review in reviews:
        confirmation_code = normalize_reference(
            review.get("external_booking_id")
        )

        if not confirmation_code:
            unresolved.append(review)
            continue

        if confirmation_code in ambiguous:
            ambiguous_reviews.append(review)
            continue

        beds24_booking_id = (
            reference_to_booking_id.get(
                confirmation_code
            )
        )

        if not beds24_booking_id:
            unresolved.append(review)
            continue

        reservation = reservations_by_booking_id.get(
            beds24_booking_id
        )

        if not reservation:
            unresolved.append(review)
            continue

        matched.append({
            "review": review,
            "reservation": reservation,
            "beds24_booking_id": beds24_booking_id,
            "confirmation_code": confirmation_code,
        })

    print()
    print("=== MATCH SUMMARY ===")
    print(f"Reviews examined: {len(reviews)}")
    print(f"Matched: {len(matched)}")
    print(f"Unresolved: {len(unresolved)}")
    print(
        f"Ambiguous confirmation codes: "
        f"{len(ambiguous_reviews)}"
    )

    for item in matched[:20]:
        review = item["review"]
        reservation = item["reservation"]

        print(
            "MATCH "
            f"review={review['external_review_id']} "
            f"confirmation={item['confirmation_code']} "
            f"beds24_booking={item['beds24_booking_id']} "
            f"guest={reservation.get('guest_name')} "
            f"checkout={reservation.get('checkout_at')}"
        )

    if unresolved:
        print()
        print("First unresolved review codes:")

        for review in unresolved[:20]:
            print(
                "- "
                f"{review.get('external_booking_id')} "
                f"review={review.get('external_review_id')} "
                f"date={review.get('review_date')}"
            )

    if not args.apply:
        print()
        print(
            "Dry run only. Run again with --apply "
            "to update guest_reviews."
        )
        return

    updated = 0

    for item in matched:
        review = item["review"]
        reservation = item["reservation"]
        beds24_booking_id = item["beds24_booking_id"]

        (
            supabase.table("guest_reviews")
            .update({
                "reservation_id": reservation["id"],
                "property_id": reservation["property_id"],
                "match_status": (
                    "airbnb_confirmation_code"
                ),
                "match_confidence": 1.0,
                "match_notes": (
                    "Airbnb reservation_confirmation_code "
                    "matched a live Beds24 booking reference; "
                    f"Beds24 booking id {beds24_booking_id}"
                ),
            })
            .eq("id", review["id"])
            .execute()
        )

        updated += 1

    print()
    print(f"Done. Linked {updated} reviews.")


if __name__ == "__main__":
    main()
