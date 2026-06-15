from __future__ import annotations

import os
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

PARIS = ZoneInfo("Europe/Paris")
CLEANER_WEB_BASE_URL = os.getenv("CLEANER_WEB_BASE_URL", "http://localhost:3000")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def full_name(row: dict | None) -> str:
    if not row:
        return ""
    return " ".join(
        part for part in [row.get("first_name"), row.get("last_name")] if part
    )


def phone_for_sms(phone: str | None) -> str | None:
    if not phone:
        return None
    return phone.replace(" ", "").replace(".", "").replace("-", "").strip()


def money(value) -> str:
    try:
      return f"{float(value):.2f} €"
    except Exception:
      return "montant à confirmer"


def build_body(request: dict, reservation: dict | None, property_: dict | None, cleaner: dict | None) -> str:
    cleaner_first_name = (cleaner or {}).get("first_name") or "Bonjour"
    property_name = (property_ or {}).get("name") or "Logement"
    scheduled_start = parse_dt(request.get("scheduled_start_at"))

    if scheduled_start:
        scheduled_local = scheduled_start.astimezone(PARIS)
        date_text = scheduled_local.strftime("%d/%m/%Y à %Hh%M")
    else:
        date_text = "date à confirmer"

    guest_text = ""
    if reservation and reservation.get("guest_name"):
        guest_text = f" · client: {reservation['guest_name']}"

    link = f"{CLEANER_WEB_BASE_URL}/mission/{request['public_token']}"

    return (
        f"Bonjour {cleaner_first_name} 👋\n"
        f"Nouvelle mission ménage proposée.\n"
        f"{property_name}{guest_text}\n"
        f"📅 {date_text}\n"
        f"💶 {money(request.get('total_cost_eur'))}\n"
        f"Répondre ici: {link}"
    )


def main() -> None:
    supabase = get_supabase_client()

    requests_result = (
        supabase.table("cleaning_requests")
        .select("*")
        .eq("status", "created")
        .execute()
    )
    requests = requests_result.data or []

    if not requests:
        print("No created cleaning requests waiting for SMS.")
        return

    existing_result = (
        supabase.table("outbound_messages")
        .select("cleaning_request_id,channel,message_type,status")
        .eq("channel", "sms")
        .eq("message_type", "mission_offer")
        .execute()
    )

    existing_keys = {
        str(row["cleaning_request_id"])
        for row in (existing_result.data or [])
        if row.get("cleaning_request_id")
    }

    reservation_ids = [row["reservation_id"] for row in requests if row.get("reservation_id")]
    property_ids = [row["property_id"] for row in requests if row.get("property_id")]
    cleaner_ids = [row["assigned_cleaner_id"] for row in requests if row.get("assigned_cleaner_id")]

    reservations = {}
    if reservation_ids:
        result = supabase.table("reservations").select("*").in_("id", reservation_ids).execute()
        reservations = {str(row["id"]): row for row in (result.data or [])}

    properties = {}
    if property_ids:
        result = supabase.table("properties").select("*").in_("id", property_ids).execute()
        properties = {str(row["id"]): row for row in (result.data or [])}

    cleaners = {}
    if cleaner_ids:
        result = supabase.table("cleaners").select("*").in_("id", cleaner_ids).execute()
        cleaners = {str(row["id"]): row for row in (result.data or [])}

    created = 0
    skipped = 0

    for request in requests:
        request_id = str(request["id"])

        if request_id in existing_keys:
            skipped += 1
            continue

        cleaner = cleaners.get(str(request.get("assigned_cleaner_id")))
        recipient_phone = phone_for_sms((cleaner or {}).get("phone"))

        if not recipient_phone:
            print(f"SKIP {request_id}: assigned cleaner has no phone number")
            skipped += 1
            continue

        reservation = reservations.get(str(request.get("reservation_id")))
        property_ = properties.get(str(request.get("property_id")))

        body = build_body(request, reservation, property_, cleaner)

        result = (
            supabase.table("outbound_messages")
            .insert(
                {
                    "cleaning_request_id": request["id"],
                    "channel": "sms",
                    "message_type": "mission_offer",
                    "recipient_phone": recipient_phone,
                    "body": body,
                    "status": "pending",
                    "provider": "twilio",
                }
            )
            .execute()
        )

        created += 1

        print(
            "Created SMS message: "
            f"{property_.get('name') if property_ else 'property'} · "
            f"{full_name(cleaner)} · {recipient_phone}"
        )

    print(f"Summary: created={created} skipped={skipped}")


if __name__ == "__main__":
    main()
