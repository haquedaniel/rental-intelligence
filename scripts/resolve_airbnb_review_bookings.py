from __future__ import annotations

import argparse
import json
import re
import time
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any

from rental_intel.cleaning.db import get_supabase_client
from rental_intel.ingest.beds24 import Beds24Client


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_reference(value: Any) -> str:
    return re.sub(r"[^A-Z0-9]", "", (clean(value) or "").upper())


def parse_date(value: Any) -> date | None:
    text = clean(value)
    if not text:
        return None

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def response_rows(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [row for row in response if isinstance(row, dict)]

    if isinstance(response, dict):
        data = response.get("data")
        if isinstance(data, list):
            return [row for row in data if isinstance(row, dict)]

    return []


def get_property_id(supabase, room_id: int) -> str:
    result = (
        supabase.table("property_source_links")
        .select("property_id")
        .eq("source_system", "beds24")
        .eq("source_room_id", str(room_id))
        .eq("active", True)
        .limit(1)
        .execute()
    )

    rows = result.data or []
    if not rows:
        raise RuntimeError(
            f"No active Pilotys mapping for Beds24 room {room_id}."
        )

    property_id = clean(rows[0].get("property_id"))
    if not property_id:
        raise RuntimeError("Mapped property_id is empty.")

    return property_id


def load_reviews(supabase, property_id: str) -> list[dict[str, Any]]:
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

    rows = result.data or []

    return [
        row
        for row in rows
        if (
            not row.get("reservation_id")
            and normalize_reference(row.get("external_booking_id"))
            and parse_date(row.get("review_date"))
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


def matching_booking(
    rows: list[dict[str, Any]],
    confirmation_code: str,
    room_id: int,
) -> dict[str, Any] | None:
    matches = []

    for row in rows:
        if str(row.get("roomId") or "") != str(room_id):
            continue

        api_reference = normalize_reference(row.get("apiReference"))
        if api_reference != confirmation_code:
            continue

        if not row.get("id"):
            continue

        matches.append(row)

    if len(matches) == 1:
        return matches[0]

    if len(matches) > 1:
        raise RuntimeError(
            f"Multiple Beds24 bookings matched {confirmation_code}: "
            f"{[row.get('id') for row in matches]}"
        )

    return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Resolve Airbnb reviews by searching exact Beds24 "
            "departure dates before each review submission."
        )
    )

    parser.add_argument("--room-id", type=int, required=True)

    parser.add_argument(
        "--review-window-days",
        type=int,
        default=14,
        help=(
            "Maximum days between checkout and review submission. "
            "Default: 14."
        ),
    )

    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=3.2,
        help="Delay between uncached Beds24 API calls.",
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply links. Without this flag the script is a dry run.",
    )

    parser.add_argument(
        "--dump-results",
        help=(
            "Optional JSON output path inside the cockpit container."
        ),
    )

    args = parser.parse_args()

    if args.review_window_days < 0:
        parser.error("--review-window-days cannot be negative")

    if args.delay_seconds < 0:
        parser.error("--delay-seconds cannot be negative")

    client = Beds24Client()
    supabase = get_supabase_client()

    property_id = get_property_id(supabase, args.room_id)

    reviews = load_reviews(supabase, property_id)
    reservations = load_reservations(supabase, property_id)

    print(f"Pilotys property: {property_id}")
    print(f"Beds24 room: {args.room_id}")
    print(f"Reviews requiring resolution: {len(reviews)}")
    print(f"Existing local reservations: {len(reservations)}")

    # Date -> Beds24 bookings returned for that exact departure date.
    departure_cache: dict[str, list[dict[str, Any]]] = {}

    results: list[dict[str, Any]] = []
    api_calls = 0

    # Newest first: recent dates are more likely to find local reservations.
    reviews.sort(
        key=lambda row: parse_date(row.get("review_date")) or date.min,
        reverse=True,
    )

    for index, review in enumerate(reviews, start=1):
        confirmation_code = normalize_reference(
            review.get("external_booking_id")
        )
        review_day = parse_date(review.get("review_date"))

        assert review_day is not None

        print()
        print(
            f"[{index}/{len(reviews)}] "
            f"{confirmation_code} · review {review_day}"
        )

        matched_booking: dict[str, Any] | None = None
        matched_departure: date | None = None

        # A review submitted on the checkout date is possible, hence day 0.
        for days_before in range(args.review_window_days + 1):
            departure_day = review_day - timedelta(days=days_before)
            departure_text = departure_day.isoformat()

            if departure_text not in departure_cache:
                if api_calls > 0 and args.delay_seconds:
                    time.sleep(args.delay_seconds)

                response = client.get(
                    "/bookings",
                    params={
                        "roomId": [args.room_id],
                        "departure": departure_text,
                        "page": 1,
                    },
                )

                rows = response_rows(response)

                # Protect against any unexpected broad response.
                rows = [
                    row
                    for row in rows
                    if (
                        str(row.get("roomId") or "") == str(args.room_id)
                        and clean(row.get("departure")) == departure_text
                    )
                ]

                departure_cache[departure_text] = rows
                api_calls += 1

                print(
                    f"  queried departure={departure_text}: "
                    f"{len(rows)} booking(s)"
                )

            rows = departure_cache[departure_text]

            matched_booking = matching_booking(
                rows,
                confirmation_code=confirmation_code,
                room_id=args.room_id,
            )

            if matched_booking:
                matched_departure = departure_day
                break

        result: dict[str, Any] = {
            "review_id": review.get("id"),
            "external_review_id": review.get("external_review_id"),
            "confirmation_code": confirmation_code,
            "review_date": review.get("review_date"),
            "status": None,
            "beds24_booking_id": None,
            "beds24_departure": (
                matched_departure.isoformat()
                if matched_departure
                else None
            ),
            "local_reservation_id": None,
            "booking": matched_booking,
        }

        if not matched_booking:
            result["status"] = "confirmation_code_not_found"
            print("  NOT FOUND in review window")
            results.append(result)
            continue

        beds24_booking_id = str(matched_booking["id"])
        result["beds24_booking_id"] = beds24_booking_id

        reservation = reservations.get(beds24_booking_id)

        if not reservation:
            result["status"] = "found_beds24_booking_reservation_missing"

            print(
                "  FOUND IN BEDS24, MISSING LOCALLY "
                f"booking={beds24_booking_id} "
                f"arrival={matched_booking.get('arrival')} "
                f"departure={matched_booking.get('departure')}"
            )

            results.append(result)
            continue

        result["status"] = "linked_existing_reservation"
        result["local_reservation_id"] = reservation["id"]

        print(
            "  MATCH "
            f"booking={beds24_booking_id} "
            f"guest={reservation.get('guest_name')} "
            f"checkout={reservation.get('checkout_at')}"
        )

        if args.apply:
            (
                supabase.table("guest_reviews")
                .update({
                    "reservation_id": reservation["id"],
                    "property_id": reservation["property_id"],
                    "match_status": "airbnb_confirmation_code",
                    "match_confidence": 1.0,
                    "match_notes": (
                        f"Airbnb confirmation code {confirmation_code} "
                        f"matched Beds24 booking {beds24_booking_id} "
                        f"using exact departure date "
                        f"{matched_departure.isoformat()}."
                    ),
                })
                .eq("id", review["id"])
                .execute()
            )

        results.append(result)

    counts = Counter(
        str(result.get("status"))
        for result in results
    )

    print()
    print("=== RESOLUTION SUMMARY ===")
    print(f"Beds24 API calls: {api_calls}")
    print(f"Cached departure dates: {len(departure_cache)}")

    for status, count in sorted(counts.items()):
        print(f"{status}: {count}")

    if args.dump_results:
        with open(args.dump_results, "w", encoding="utf-8") as handle:
            json.dump(
                results,
                handle,
                indent=2,
                ensure_ascii=False,
                default=str,
            )

        print(
            "Results written inside cockpit container to "
            f"{args.dump_results}"
        )

    if args.apply:
        print("Database updates applied.")
    else:
        print("Dry run only; no database changes made.")


if __name__ == "__main__":
    main()
