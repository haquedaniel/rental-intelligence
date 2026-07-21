from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

from rental_intel.cleaning.db import get_supabase_client


RATING_FIELDS = (
    "overall_rating",
    "location_rating",
    "cleanliness_rating",
    "checkin_rating",
    "accuracy_rating",
    "value_rating",
    "communication_rating",
)


def number(value: Any) -> Decimal | None:
    if value is None:
        return None

    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def average(values: list[Decimal]) -> float | None:
    if not values:
        return None

    result = sum(values) / Decimal(len(values))
    return float(result.quantize(Decimal("0.01")))


def main() -> None:
    supabase = get_supabase_client()

    result = (
        supabase.table("guest_reviews")
        .select(
            "property_id,"
            "source_system,"
            "channel,"
            "overall_rating,"
            "location_rating,"
            "cleanliness_rating,"
            "checkin_rating,"
            "accuracy_rating,"
            "value_rating,"
            "communication_rating"
        )
        .not_.is_("property_id", "null")
        .execute()
    )

    reviews = result.data or []

    grouped: dict[
        tuple[str, str, str],
        list[dict[str, Any]],
    ] = defaultdict(list)

    for review in reviews:
        property_id = review.get("property_id")
        source_system = review.get("source_system") or "beds24"
        channel = review.get("channel")

        if not property_id or not channel:
            continue

        grouped[
            (
                str(property_id),
                str(source_system),
                str(channel),
            )
        ].append(review)

    today = date.today().isoformat()
    captured_at = datetime.now(timezone.utc).isoformat()

    payloads: list[dict[str, Any]] = []

    for (
        property_id,
        source_system,
        channel,
    ), rows in grouped.items():
        payload: dict[str, Any] = {
            "property_id": property_id,
            "source_system": source_system,
            "channel": channel,
            "snapshot_date": today,
            "review_count": len(rows),
            "calculation_method": "imported_reviews_mean",
            "is_authoritative": False,
            "captured_at": captured_at,
        }

        for field in RATING_FIELDS:
            values = [
                parsed
                for row in rows
                if (parsed := number(row.get(field))) is not None
            ]

            payload[field] = average(values)

        payloads.append(payload)

    if not payloads:
        print("No review ratings available for snapshot.")
        return

    (
        supabase.table("review_rating_snapshots")
        .upsert(
            payloads,
            on_conflict=(
                "property_id,"
                "source_system,"
                "channel,"
                "snapshot_date"
            ),
        )
        .execute()
    )

    print(f"Review rating snapshots upserted: {len(payloads)}")

    for payload in payloads:
        print(
            f"- property={payload['property_id']} "
            f"channel={payload['channel']} "
            f"reviews={payload['review_count']} "
            f"rating={payload['overall_rating']}"
        )


if __name__ == "__main__":
    main()
