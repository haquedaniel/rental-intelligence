from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client
from rental_intel.ingest.beds24 import Beds24Client


DEFAULT_CSV = Path("outputs/processed/normalized_reservations.csv")


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
            # Some APIs group items under a nested key.
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


def first_value(row: dict[str, Any], names: list[str]) -> Any:
    lower = {str(k).lower(): k for k in row.keys()}
    for name in names:
        key = lower.get(name.lower())
        if key is not None and row.get(key) not in (None, ""):
            return row.get(key)
    return None


def infer_direction(message: dict[str, Any]) -> str:
    raw = " ".join(str(first_value(message, keys) or "") for keys in [
        ["direction"],
        ["from"],
        ["fromRole"],
        ["senderRole"],
        ["type"],
    ]).lower()

    if any(token in raw for token in ["guest", "booker", "traveller", "traveler"]):
        return "guest_to_host"
    if any(token in raw for token in ["host", "owner", "property", "hotel"]):
        return "host_to_guest"
    if "internal" in raw or "note" in raw:
        return "internal"
    if "system" in raw:
        return "system"
    return "unknown"


def message_payload(
    *,
    reservation_id: str | None,
    source_booking_id: str,
    channel: str | None,
    message: dict[str, Any],
) -> dict[str, Any]:
    source_message_id = clean(first_value(message, [
        "id",
        "messageId",
        "message_id",
        "uid",
        "threadMessageId",
    ]))

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

    received_at = clean(first_value(message, [
        "receivedAt",
        "received_at",
    ]))

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

    return {
        "reservation_id": reservation_id,
        "source_system": "beds24",
        "source_booking_id": source_booking_id,
        "source_message_id": source_message_id or f"beds24:{source_booking_id}:{abs(hash(json.dumps(message, sort_keys=True, default=str)))}",

        "channel": channel,
        "message_type": clean(first_value(message, ["messageType", "type", "category"])),
        "direction": infer_direction(message),

        "sender_name": clean(first_value(message, ["senderName", "fromName", "from", "sender"])),
        "sender_role": clean(first_value(message, ["senderRole", "fromRole"])),
        "recipient_name": clean(first_value(message, ["recipientName", "toName", "to"])),
        "recipient_role": clean(first_value(message, ["recipientRole", "toRole"])),

        "subject": clean(first_value(message, ["subject", "title"])),
        "body": body,
        "body_text": body_text,

        "sent_at": sent_at,
        "received_at": received_at,
        "read_at": clean(first_value(message, ["readAt", "read_at"])),

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


def booking_ids_from_csv(path: Path) -> list[tuple[str, str | None]]:
    if not path.exists():
        raise FileNotFoundError(path)

    df = pd.read_csv(path)
    rows: list[tuple[str, str | None]] = []
    seen = set()

    for _, row in df.iterrows():
        booking_id = clean(row.get("source_booking_id"))
        if not booking_id or booking_id in seen:
            continue
        seen.add(booking_id)
        rows.append((booking_id, clean(row.get("channel"))))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Beds24/OTA booking messages into Supabase.")
    parser.add_argument("--csv", default=str(DEFAULT_CSV))
    parser.add_argument("--booking-id")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_dotenv()
    client = Beds24Client()
    supabase = get_supabase_client()
    reservations_by_booking_id = reservation_lookup(supabase)

    if args.booking_id:
        booking_rows = [(args.booking_id, reservations_by_booking_id.get(args.booking_id, {}).get("channel"))]
    else:
        booking_rows = booking_ids_from_csv(Path(args.csv))

    if args.limit:
        booking_rows = booking_rows[: args.limit]

    upserts: list[dict[str, Any]] = []
    failures = 0

    for booking_id, csv_channel in booking_rows:
        try:
            response = client.get_booking_messages(booking_id=booking_id)
        except Exception as exc:
            failures += 1
            print(f"{booking_id}: ERROR {exc}")
            continue

        messages = list_from_response(response)
        reservation = reservations_by_booking_id.get(str(booking_id))
        reservation_id = reservation.get("id") if reservation else None
        channel = reservation.get("channel") if reservation else csv_channel

        print(f"{booking_id}: {len(messages)} messages")

        for message in messages:
            upserts.append(
                message_payload(
                    reservation_id=reservation_id,
                    source_booking_id=str(booking_id),
                    channel=channel,
                    message=message,
                )
            )

    print(f"Messages to upsert: {len(upserts)}")
    print(f"Failures: {failures}")

    if upserts[:3]:
        print(json.dumps(upserts[:3], indent=2, ensure_ascii=False, default=str))

    if args.dry_run:
        return

    if upserts:
        supabase.table("reservation_messages").upsert(
            upserts,
            on_conflict="source_system,source_message_id",
        ).execute()

    print("Done.")


if __name__ == "__main__":
    main()
