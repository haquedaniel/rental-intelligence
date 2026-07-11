from __future__ import annotations

import argparse
import json
from typing import Any

import pandas as pd
from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client
from rental_intel.ingest.beds24 import Beds24Client


def clean(value: Any) -> str | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    text = str(value).strip()
    return text or None


def list_from_response(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, dict):
        data = response.get("data")
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            for key in ("messages", "items", "bookingMessages"):
                nested = data.get(key)
                if isinstance(nested, list):
                    return [item for item in nested if isinstance(item, dict)]
        for key in ("messages", "items", "bookingMessages"):
            value = response.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    if isinstance(response, list):
        return [item for item in response if isinstance(item, dict)]
    return []


def next_page_exists(response: Any) -> bool:
    if not isinstance(response, dict):
        return False
    pages = response.get("pages")
    return isinstance(pages, dict) and bool(pages.get("nextPageExists"))


def fetch_message_pages(
    client: Beds24Client,
    *,
    booking_id: str | None = None,
    property_id: int | None = None,
    max_pages: int = 1,
) -> list[dict[str, Any]]:
    responses: list[dict[str, Any]] = []
    page = 1

    while len(responses) < max_pages:
        response = client.get_booking_messages(
            booking_id=booking_id,
            property_id=property_id,
            page=page,
        )
        responses.append(response)

        if not next_page_exists(response):
            break
        page += 1

    return responses


def first_value(row: dict[str, Any], names: list[str]) -> Any:
    lower = {str(k).lower(): k for k in row.keys()}
    for name in names:
        key = lower.get(name.lower())
        if key is not None and row.get(key) not in (None, ""):
            return row.get(key)
    return None


def infer_direction(message: dict[str, Any]) -> str:
    source = str(first_value(message, ["source", "direction", "fromRole", "senderRole", "type"]) or "").lower()

    if source in {"guest", "booker", "traveller", "traveler"}:
        return "guest_to_host"
    if source in {"host", "owner", "property", "hotel"}:
        return "host_to_guest"
    if source in {"internal", "note"}:
        return "internal"
    if source == "system":
        return "system"

    if "guest" in source or "traveller" in source or "traveler" in source:
        return "guest_to_host"
    if "host" in source or "owner" in source:
        return "host_to_guest"
    if "system" in source:
        return "system"
    if "internal" in source or "note" in source:
        return "internal"

    return "unknown"


def message_payload(
    *,
    reservations_by_booking_id: dict[str, dict[str, Any]],
    fallback_channel_by_booking_id: dict[str, str | None],
    message: dict[str, Any],
) -> dict[str, Any] | None:
    beds24_booking_id = clean(first_value(message, ["bookingId", "booking_id"]))
    if not beds24_booking_id:
        return None

    reservation = reservations_by_booking_id.get(beds24_booking_id)
    reservation_id = reservation.get("id") if reservation else None
    channel = reservation.get("channel") if reservation else fallback_channel_by_booking_id.get(beds24_booking_id)

    source_message_id = clean(first_value(message, [
        "id",
        "messageId",
        "message_id",
        "uid",
        "threadMessageId",
    ]))

    if not source_message_id:
        source_message_id = f"beds24:{beds24_booking_id}:{abs(hash(json.dumps(message, sort_keys=True, default=str)))}"

    body = clean(first_value(message, [
        "message",
        "body",
        "text",
        "content",
        "html",
        "bodyHtml",
        "bodyText",
    ]))

    body_text = clean(first_value(message, [
        "bodyText",
        "text",
        "message",
        "content",
    ])) or body

    sent_at = clean(first_value(message, [
        "time",
        "sentAt",
        "sent_at",
        "createdAt",
        "created_at",
        "date",
        "messageTime",
    ]))

    read_value = first_value(message, ["read", "isRead"])
    read_at = sent_at if read_value is True else None

    attachments = first_value(message, [
        "attachments",
        "attachmentUrls",
        "attachment_urls",
        "files",
    ])
    if attachments is None:
        attachments = []
    elif not isinstance(attachments, list):
        attachments = [attachments]

    source = clean(first_value(message, ["source"]))

    return {
        "reservation_id": reservation_id,
        "source_system": "beds24",
        "source_booking_id": beds24_booking_id,
        "source_message_id": str(source_message_id),

        "channel": channel,
        "message_type": clean(first_value(message, ["messageType", "type", "category"])) or source,
        "direction": infer_direction(message),

        "sender_name": clean(first_value(message, ["senderName", "fromName", "from", "sender"])),
        "sender_role": clean(first_value(message, ["senderRole", "fromRole"])) or source,
        "recipient_name": clean(first_value(message, ["recipientName", "toName", "to"])),
        "recipient_role": clean(first_value(message, ["recipientRole", "toRole"])),

        "subject": clean(first_value(message, ["subject", "title"])),
        "body": body,
        "body_text": body_text,

        "sent_at": sent_at,
        "received_at": clean(first_value(message, ["receivedAt", "received_at"])),
        "read_at": read_at,

        "attachment_urls": attachments,
        "raw_payload": message,
    }


def reservation_lookup(supabase) -> dict[str, dict[str, Any]]:
    result = (
        supabase.table("reservations")
        .select("id,source_system,source_booking_id,channel")
        .eq("source_system", "beds24")
        .execute()
    )
    return {str(row["source_booking_id"]): row for row in result.data or [] if row.get("source_booking_id")}


def fallback_channel_from_financials(supabase) -> dict[str, str | None]:
    result = (
        supabase.table("reservation_financials")
        .select("source_booking_id,booking_channel")
        .eq("source_system", "beds24")
        .execute()
    )
    return {
        str(row["source_booking_id"]): row.get("booking_channel")
        for row in result.data or []
        if row.get("source_booking_id")
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Beds24/OTA booking messages into Supabase.")
    parser.add_argument("--booking-id", help="Beds24 numeric booking id. OTA refs may not filter.")
    parser.add_argument("--property-id", type=int, help="Beds24 property id. Recommended for real sync.")
    parser.add_argument("--max-pages", type=int, default=1)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.booking_id and not args.property_id:
        raise SystemExit("Pass --property-id <Beds24 property id> or --booking-id <numeric Beds24 booking id>.")

    load_dotenv()
    client = Beds24Client()
    supabase = get_supabase_client()

    reservations_by_booking_id = reservation_lookup(supabase)
    fallback_channel_by_booking_id = fallback_channel_from_financials(supabase)

    responses = fetch_message_pages(
        client,
        booking_id=args.booking_id,
        property_id=args.property_id,
        max_pages=args.max_pages,
    )

    messages = [message for response in responses for message in list_from_response(response)]

    payloads: list[dict[str, Any]] = []
    unmatched_booking_ids: set[str] = set()

    for message in messages:
        payload = message_payload(
            reservations_by_booking_id=reservations_by_booking_id,
            fallback_channel_by_booking_id=fallback_channel_by_booking_id,
            message=message,
        )
        if not payload:
            continue
        if not payload.get("reservation_id"):
            unmatched_booking_ids.add(str(payload["source_booking_id"]))
        payloads.append(payload)

    # Deduplicate by source_message_id; property-level pages can overlap in repeated runs.
    by_message_id = {str(payload["source_message_id"]): payload for payload in payloads}
    payloads = list(by_message_id.values())

    print(f"Pages fetched: {len(responses)}")
    print(f"Raw messages: {len(messages)}")
    print(f"Messages to upsert: {len(payloads)}")
    print(f"Unmatched Beds24 bookingIds: {len(unmatched_booking_ids)}")
    if unmatched_booking_ids:
        print("First unmatched:", ", ".join(sorted(unmatched_booking_ids)[:20]))

    if payloads[:3]:
        print(json.dumps(payloads[:3], indent=2, ensure_ascii=False, default=str))

    if args.dry_run:
        return

    if payloads:
        supabase.table("reservation_messages").upsert(
            payloads,
            on_conflict="source_system,source_message_id",
        ).execute()

    print("Done.")


if __name__ == "__main__":
    main()
