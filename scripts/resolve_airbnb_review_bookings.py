from __future__ import annotations

import argparse
import json
import re
import time
from typing import Any

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
    return re.sub(
        r"[^A-Z0-9]",
        "",
        (clean(value) or "").upper(),
    )


def rows_from_response(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [
            row
            for row in response
            if isinstance(row, dict)
        ]

    if not isinstance(response, dict):
        return []

    data = response.get("data")

    if isinstance(data, list):
        return [
            row
            for row in data
            if isinstance(row, dict)
        ]

    if isinstance(data, dict):
        for key in ("bookings", "items", "results"):
            value = data.get(key)

            if isinstance(value, list):
                return [
                    row
                    for row in value
                    if isinstance(row, dict)
                ]

    for key in ("bookings", "items", "results"):
        value = response.get(key)

        if isinstance(value, list):
            return [
                row
                for row in value
                if isinstance(row, dict)
            ]

    return []


def booking_aliases(booking: dict[str, Any]) -> set[str]:
    aliases: set[str] = set()

    for field in (
        "apiReference",
        "api_reference",
        "reference",
    ):
        value = normalize_reference(booking.get(field))

        if value:
            aliases.add(value)

    return aliases


def selected_property(
    supabase,
    room_id: int,
) -> str:
    result = (
        supabase.table("property_source_links")
        .select(
            "property_id,"
            "source_room_id,"
            "active"
        )
        .eq("source_system", "beds24")
        .eq("source_room_id", str(room_id))
        .eq("active", True)
        .limit(1)
        .execute()
    )

    rows = result.data or []

    if not rows:
        raise RuntimeError(
            f"No active property_source_links mapping "
            f"for Beds24 room {room_id}."
        )

    property_id = clean(rows[0].get("property_id"))

    if not property_id:
        raise RuntimeError(
            f"Beds24 room {room_id} has no Pilotys property_id."
        )

    return property_id


def load_reviews(
    supabase,
    property_id: str,
) -> list[dict[str, Any]]:
    result = (
        supabase.table("guest_reviews")
        .select(
            "id,"
            "external_review_id,"
            "external_booking_id,"
            "review_date,"
            "reservation_id,"
            "match_status"
        )
        .eq("source_system", "beds24")
        .eq("channel", "airbnb")
        .eq("property_id", property_id)
        .execute()
    )

    return [
        row
        for row in (result.data or [])
        if (
            not row.get("reservation_id")
            and normalize_reference(
                row.get("external_booking_id")
            )
        )
    ]


def load_reservations(
    supabase,
    property_id: str,
) -> dict[str, dict[str, Any]]:
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
        .eq("property_id", property_id)
        .execute()
    )

    return {
        str(row["source_booking_id"]): row
        for row in (result.data or [])
        if row.get("source_booking_id")
    }


def exact_booking_matches(
    bookings: list[dict[str, Any]],
    confirmation_code: str,
    room_id: int,
) -> list[dict[str, Any]]:
    normalized_room_id = str(room_id)

    matches: list[dict[str, Any]] = []

    for booking in bookings:
        booking_room_id = clean(
            booking.get("roomId")
            or booking.get("room_id")
        )

        if (
            booking_room_id
            and booking_room_id != normalized_room_id
        ):
            continue

        if confirmation_code not in booking_aliases(booking):
            continue

        if not clean(booking.get("id")):
            continue

        matches.append(booking)

    return matches


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Resolve Airbnb review confirmation codes through "
            "live Beds24 booking searches."
        )
    )

    parser.add_argument(
        "--room-id",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Update guest_reviews. Without this flag the script "
            "is a dry run."
        ),
    )

    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=1.5,
        help=(
            "Pause between Beds24 requests to avoid excessive "
            "API usage."
        ),
    )

    parser.add_argument(
        "--dump-results",
        help=(
            "Optional JSON output containing each lookup result."
        ),
    )

    args = parser.parse_args()

    if args.delay_seconds < 0:
        parser.error("--delay-seconds cannot be negative")

    load_dotenv()

    client = Beds24Client()
    supabase = get_supabase_client()

    property_id = selected_property(
        supabase,
        room_id=args.room_id,
    )

    reviews = load_reviews(
        supabase,
        property_id=property_id,
    )

    reservations_by_booking_id = load_reservations(
        supabase,
        property_id=property_id,
    )

    print(f"Pilotys property: {property_id}")
    print(f"Beds24 room: {args.room_id}")
    print(f"Reviews requiring resolution: {len(reviews)}")
    print(
        f"Existing local reservations: "
        f"{len(reservations_by_booking_id)}"
    )

    results: list[dict[str, Any]] = []

    for index, review in enumerate(reviews, start=1):
        confirmation_code = normalize_reference(
            review.get("external_booking_id")
        )

        print()
        print(
            f"[{index}/{len(reviews)}] "
            f"Searching {confirmation_code}..."
        )

        response = client.get(
            BOOKINGS_PATH,
            params={
                "searchString": confirmation_code,
            },
        )

        returned = rows_from_response(response)

        exact_matches = exact_booking_matches(
            returned,
            confirmation_code=confirmation_code,
            room_id=args.room_id,
        )

        result: dict[str, Any] = {
            "review_id": review.get("id"),
            "external_review_id": (
                review.get("external_review_id")
            ),
            "confirmation_code": confirmation_code,
            "review_date": review.get("review_date"),
            "beds24_rows_returned": len(returned),
            "exact_matches": len(exact_matches),
            "status": None,
            "beds24_booking_id": None,
            "local_reservation_id": None,
            "booking": None,
        }

        if len(exact_matches) == 0:
            result["status"] = "confirmation_code_not_found"

            print(
                "NOT FOUND "
                f"returned={len(returned)}"
            )

        elif len(exact_matches) > 1:
            result["status"] = "ambiguous_beds24_matches"

            print(
                "AMBIGUOUS "
                f"exact_matches={len(exact_matches)}"
            )

        else:
            booking = exact_matches[0]
            beds24_booking_id = str(booking["id"])

            result["beds24_booking_id"] = (
                beds24_booking_id
            )
            result["booking"] = booking

            reservation = reservations_by_booking_id.get(
                beds24_booking_id
            )

            if reservation:
                result["status"] = (
                    "linked_existing_reservation"
                )
                result["local_reservation_id"] = (
                    reservation["id"]
                )

                print(
                    "MATCH "
                    f"beds24_booking={beds24_booking_id} "
                    f"guest={reservation.get('guest_name')} "
                    f"checkout={reservation.get('checkout_at')}"
                )

                if args.apply:
                    (
                        supabase.table("guest_reviews")
                        .update({
                            "reservation_id": (
                                reservation["id"]
                            ),
                            "property_id": (
                                reservation["property_id"]
                            ),
                            "match_status": (
                                "airbnb_confirmation_code"
                            ),
                            "match_confidence": 1.0,
                            "match_notes": (
                                "Airbnb confirmation code "
                                f"{confirmation_code} matched "
                                "via Beds24 searchString to "
                                f"Beds24 booking "
                                f"{beds24_booking_id}."
                            ),
                        })
                        .eq("id", review["id"])
                        .execute()
                    )

            else:
                result["status"] = (
                    "found_beds24_booking_"
                    "reservation_missing"
                )

                print(
                    "FOUND IN BEDS24, MISSING LOCALLY "
                    f"beds24_booking={beds24_booking_id} "
                    f"apiReference="
                    f"{booking.get('apiReference')} "
                    f"arrival={booking.get('arrival')} "
                    f"departure={booking.get('departure')}"
                )

        results.append(result)

        if (
            index < len(reviews)
            and args.delay_seconds > 0
        ):
            time.sleep(args.delay_seconds)

    counts: dict[str, int] = {}

    for result in results:
        status = str(result["status"])
        counts[status] = counts.get(status, 0) + 1

    print()
    print("=== RESOLUTION SUMMARY ===")

    for status, count in sorted(counts.items()):
        print(f"{status}: {count}")

    if args.dump_results:
        with open(
            args.dump_results,
            "w",
            encoding="utf-8",
        ) as handle:
            json.dump(
                results,
                handle,
                ensure_ascii=False,
                indent=2,
                default=str,
            )

        print(
            f"Detailed results written to: "
            f"{args.dump_results}"
        )

    if args.apply:
        print("Database updates applied.")
    else:
        print(
            "Dry run only; guest_reviews was not changed."
        )


if __name__ == "__main__":
    main()
