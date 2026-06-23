from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

SEND_ENABLED = os.getenv("SMS_SEND_ENABLED", "false").lower() in {"1", "true", "yes"}
SMS_TEST_RECIPIENT = os.getenv("SMS_TEST_RECIPIENT", "").strip()
MAX_ATTEMPTS = int(os.getenv("SMS_MAX_ATTEMPTS", "5"))
SMS_PROPERTY_ID_FILTER = {
    value.strip()
    for value in os.getenv("CLEANING_SMS_PROPERTY_IDS", "").split(",")
    if value.strip()
}

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "").strip()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    return phone.replace(" ", "").replace(".", "").replace("-", "").strip()


def filter_messages_by_property(supabase, messages: list[dict]) -> list[dict]:
    if not SMS_PROPERTY_ID_FILTER:
        return messages

    request_ids = [
        message.get("cleaning_request_id")
        for message in messages
        if message.get("cleaning_request_id")
    ]

    payment_request_ids = [
        message.get("monthly_payment_request_id")
        for message in messages
        if message.get("monthly_payment_request_id")
    ]

    request_by_id: dict[str, dict] = {}
    if request_ids:
        result = (
            supabase.table("cleaning_requests")
            .select("id,property_id")
            .in_("id", request_ids)
            .execute()
        )

        request_by_id = {
            str(row["id"]): row
            for row in (result.data or [])
            if row.get("id")
        }

    payment_properties_by_id: dict[str, set[str]] = {}
    if payment_request_ids:
        payment_lines = (
            supabase.table("monthly_payment_request_lines")
            .select("monthly_payment_request_id,property_id")
            .in_("monthly_payment_request_id", payment_request_ids)
            .execute()
        )

        for row in payment_lines.data or []:
            payment_request_id = row.get("monthly_payment_request_id")
            property_id = row.get("property_id")
            if not payment_request_id or not property_id:
                continue

            key = str(payment_request_id)
            payment_properties_by_id.setdefault(key, set()).add(str(property_id))

    if not request_by_id and not payment_properties_by_id:
        print("SMS property filter active: 0 messages kept; no property scope found.")
        return []

    filtered = []
    skipped = 0

    for message in messages:
        request_id = message.get("cleaning_request_id")
        request = request_by_id.get(str(request_id)) if request_id else None

        if request and str(request.get("property_id")) in SMS_PROPERTY_ID_FILTER:
            filtered.append(message)
            continue

        payment_request_id = message.get("monthly_payment_request_id")
        payment_property_ids = (
            payment_properties_by_id.get(str(payment_request_id), set())
            if payment_request_id
            else set()
        )

        if payment_property_ids.intersection(SMS_PROPERTY_ID_FILTER):
            filtered.append(message)
            continue

        skipped += 1

    print(
        "SMS property filter active: "
        f"{len(filtered)}/{len(messages)} pending messages kept, {skipped} skipped"
    )

    return filtered


def twilio_send_sms(to_number: str, body: str) -> dict:
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_FROM_NUMBER:
        raise RuntimeError("Missing Twilio environment variables")

    url = (
        "https://api.twilio.com/2010-04-01/Accounts/"
        f"{TWILIO_ACCOUNT_SID}/Messages.json"
    )

    payload = urllib.parse.urlencode(
        {
            "From": TWILIO_FROM_NUMBER,
            "To": to_number,
            "Body": body,
        }
    ).encode("utf-8")

    auth_raw = f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode("utf-8")
    auth_header = base64.b64encode(auth_raw).decode("ascii")

    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response_body = response.read().decode("utf-8")
            return json.loads(response_body)
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Twilio HTTP {exc.code}: {error_body}") from exc


def main() -> None:
    supabase = get_supabase_client()

    result = (
        supabase.table("outbound_messages")
        .select("*")
        .eq("channel", "sms")
        .eq("status", "pending")
        .lt("attempt_count", MAX_ATTEMPTS)
        .order("created_at", desc=False)
        .limit(20)
        .execute()
    )

    messages = result.data or []
    messages = filter_messages_by_property(supabase, messages)

    if not messages:
        print("No pending SMS messages.")
        return

    if not SEND_ENABLED:
        print("SMS_SEND_ENABLED is false. Dry run only; messages remain pending.")
        for message in messages[:5]:
            recipient = SMS_TEST_RECIPIENT or message.get("recipient_phone")
            print("-" * 60)
            print(f"Would send to: {recipient}")
            print(message.get("body"))
        return

    sent = 0
    failed = 0

    for message in messages:
        message_id = message["id"]
        attempt_count = int(message.get("attempt_count") or 0) + 1
        intended_recipient = normalize_phone(message.get("recipient_phone"))
        actual_recipient = normalize_phone(SMS_TEST_RECIPIENT) or intended_recipient

        if not actual_recipient:
            error_message = "Missing recipient phone number"
            supabase.table("outbound_messages").update(
                {
                    "status": "failed",
                    "attempt_count": attempt_count,
                    "last_attempt_at": now_iso(),
                    "error_message": error_message,
                    "updated_at": now_iso(),
                }
            ).eq("id", message_id).execute()
            print(f"FAILED {message_id}: {error_message}")
            failed += 1
            continue

        try:
            response = twilio_send_sms(actual_recipient, message["body"])
            provider_message_id = response.get("sid")

            supabase.table("outbound_messages").update(
                {
                    "status": "sent",
                    "provider": "twilio",
                    "provider_message_id": provider_message_id,
                    "provider_to": actual_recipient,
                    "attempt_count": attempt_count,
                    "last_attempt_at": now_iso(),
                    "sent_at": now_iso(),
                    "error_message": None,
                    "updated_at": now_iso(),
                }
            ).eq("id", message_id).execute()

            # Move the cleaning request from created -> sent, but don't overwrite
            # later human statuses such as accepted/refused. Some SMS types, such
            # as monthly payment requests, are owner-level and may not have a
            # cleaning_request_id.
            cleaning_request_id = message.get("cleaning_request_id")
            if cleaning_request_id:
                supabase.table("cleaning_requests").update(
                    {
                        "status": "sent",
                        "updated_at": now_iso(),
                    }
                ).eq("id", cleaning_request_id).eq("status", "created").execute()

            print(
                f"SENT {message_id}: intended={intended_recipient} "
                f"actual={actual_recipient} provider_id={provider_message_id}"
            )
            sent += 1

        except Exception as exc:
            error_message = str(exc)

            supabase.table("outbound_messages").update(
                {
                    "status": "failed",
                    "provider": "twilio",
                    "provider_to": actual_recipient,
                    "attempt_count": attempt_count,
                    "last_attempt_at": now_iso(),
                    "error_message": error_message[:2000],
                    "updated_at": now_iso(),
                }
            ).eq("id", message_id).execute()

            print(f"FAILED {message_id}: {error_message}")
            failed += 1

    print(f"Summary: sent={sent} failed={failed}")


if __name__ == "__main__":
    main()
