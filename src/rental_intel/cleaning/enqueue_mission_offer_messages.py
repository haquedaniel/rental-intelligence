from __future__ import annotations

import hashlib
import json
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


def scheduled_text(request: dict) -> str:
    scheduled_start = parse_dt(request.get("scheduled_start_at"))

    if not scheduled_start:
        return "date à confirmer"

    scheduled_local = scheduled_start.astimezone(PARIS)
    return scheduled_local.strftime("%d/%m/%Y à %Hh%M")


def mission_link(request: dict) -> str:
    return f"{CLEANER_WEB_BASE_URL}/mission/{request['public_token']}"


def calendar_link(cleaner: dict | None) -> str:
    if cleaner and cleaner.get("public_token"):
        return f"{CLEANER_WEB_BASE_URL}/cleaner/{cleaner['public_token']}"
    return ""


def state_fingerprint(request: dict) -> str:
    relevant = {
        "cleaning_request_id": request.get("id"),
        "assigned_cleaner_id": request.get("assigned_cleaner_id"),
        "scheduled_start_at": request.get("scheduled_start_at"),
        "scheduled_end_at": request.get("scheduled_end_at"),
        "urgent": request.get("urgent"),
        "number_of_guests": request.get("number_of_guests"),
        "linen_required": request.get("linen_required"),
        "laundry_required": request.get("laundry_required"),
        "total_cost_eur": request.get("total_cost_eur"),
        "travel_distance_km": request.get("travel_distance_km"),
    }

    raw = json.dumps(relevant, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def current_state_event_key(request: dict) -> str:
    return f"cleaning:{request['id']}:state:{state_fingerprint(request)}"


def cancelled_event_key(request: dict) -> str:
    return f"cleaning:{request['id']}:cancelled"


def build_offer_body(
    request: dict,
    reservation: dict | None,
    property_: dict | None,
    cleaner: dict | None,
) -> str:
    cleaner_first_name = (cleaner or {}).get("first_name") or "Bonjour"
    property_name = (property_ or {}).get("name") or "Logement"

    guest_text = ""
    if reservation and reservation.get("guest_name"):
        guest_text = f"Client: {reservation['guest_name']}\n"

    planning = calendar_link(cleaner)
    planning_text = f"\nPlanning:\n{planning}\n" if planning else ""

    return (
        f"Bonjour {cleaner_first_name} 👋\n"
        "\n"
        "Nouvelle mission ménage proposée.\n"
        "\n"
        f"🏠 {property_name}\n"
        f"{guest_text}"
        f"📅 {scheduled_text(request)}\n"
        f"💶 {money(request.get('total_cost_eur'))}\n"
        "\n"
        "Répondre ici:\n"
        f"{mission_link(request)}\n"
        f"{planning_text}"
    )


def build_modified_body(
    request: dict,
    reservation: dict | None,
    property_: dict | None,
    cleaner: dict | None,
) -> str:
    cleaner_first_name = (cleaner or {}).get("first_name") or "Bonjour"
    property_name = (property_ or {}).get("name") or "Logement"

    guest_text = ""
    if reservation and reservation.get("guest_name"):
        guest_text = f"Client: {reservation['guest_name']}\n"

    planning = calendar_link(cleaner)
    planning_text = f"\nPlanning:\n{planning}\n" if planning else ""

    return (
        f"Bonjour {cleaner_first_name} 👋\n"
        "\n"
        "Mission ménage modifiée.\n"
        "\n"
        f"🏠 {property_name}\n"
        f"{guest_text}"
        f"Nouvelle date: {scheduled_text(request)}\n"
        f"Montant: {money(request.get('total_cost_eur'))}\n"
        "\n"
        "Merci de vérifier / confirmer ici:\n"
        f"{mission_link(request)}\n"
        f"{planning_text}"
    )


def build_cancelled_body(
    request: dict,
    reservation: dict | None,
    property_: dict | None,
    cleaner: dict | None,
) -> str:
    cleaner_first_name = (cleaner or {}).get("first_name") or "Bonjour"
    property_name = (property_ or {}).get("name") or "Logement"

    planning = calendar_link(cleaner)
    planning_text = f"\nPlanning:\n{planning}\n" if planning else ""

    return (
        f"Bonjour {cleaner_first_name} 👋\n"
        "\n"
        "Mission ménage annulée.\n"
        "\n"
        f"🏠 {property_name}\n"
        f"📅 {scheduled_text(request)}\n"
        "\n"
        "Vous n'avez plus à intervenir pour cette mission.\n"
        f"{planning_text}"
    )


def insert_message(
    supabase,
    request: dict,
    cleaner: dict,
    message_type: str,
    body: str,
    event_key: str,
) -> bool:
    recipient_phone = phone_for_sms(cleaner.get("phone"))

    if not recipient_phone:
        print(f"SKIP {request['id']}: assigned cleaner has no phone number")
        return False

    existing = (
        supabase.table("outbound_messages")
        .select("id")
        .eq("event_key", event_key)
        .limit(1)
        .execute()
    )

    if existing and existing.data:
        return False

    supabase.table("outbound_messages").insert(
        {
            "cleaning_request_id": request["id"],
            "channel": "sms",
            "message_type": message_type,
            "recipient_phone": recipient_phone,
            "body": body,
            "status": "pending",
            "provider": "twilio",
            "event_key": event_key,
        }
    ).execute()

    return True


def main() -> None:
    supabase = get_supabase_client()

    requests_result = (
        supabase.table("cleaning_requests")
        .select("*")
        .in_("status", ["created", "sent", "cancelled"])
        .execute()
    )
    requests = requests_result.data or []

    if not requests:
        print("No cleaning requests needing outbound SMS.")
        return

    request_ids = [row["id"] for row in requests]
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

    outbound_result = (
        supabase.table("outbound_messages")
        .select("*")
        .in_("cleaning_request_id", request_ids)
        .execute()
    )

    outbound_by_request: dict[str, list[dict]] = {}
    for message in outbound_result.data or []:
        key = str(message.get("cleaning_request_id"))
        outbound_by_request.setdefault(key, []).append(message)

    created_offer = 0
    created_modified = 0
    created_cancelled = 0
    skipped = 0
    cancelled_pending = 0
    backfilled = 0

    for request in requests:
        request_id = str(request["id"])
        cleaner = cleaners.get(str(request.get("assigned_cleaner_id")))

        if not cleaner:
            print(f"SKIP {request_id}: assigned cleaner missing")
            skipped += 1
            continue

        reservation = reservations.get(str(request.get("reservation_id")))
        property_ = properties.get(str(request.get("property_id")))
        messages = outbound_by_request.get(request_id, [])

        current_event_key = current_state_event_key(request)
        existing_event_keys = {
            message.get("event_key")
            for message in messages
            if message.get("event_key")
        }

        sent_prior = any(
            message.get("status") == "sent"
            and message.get("message_type") in {"mission_offer", "mission_modified"}
            for message in messages
        )

        legacy_current_offer = next(
            (
                message
                for message in messages
                if message.get("message_type") == "mission_offer"
                and message.get("status") in {"pending", "sent"}
                and not message.get("event_key")
            ),
            None,
        )

        if legacy_current_offer and current_event_key not in existing_event_keys:
            supabase.table("outbound_messages").update(
                {
                    "event_key": current_event_key,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", legacy_current_offer["id"]).execute()

            existing_event_keys.add(current_event_key)
            backfilled += 1

        if request.get("status") == "cancelled":
            pending_messages = [
                message
                for message in messages
                if message.get("status") == "pending"
                and message.get("message_type") != "mission_cancelled"
            ]

            for message in pending_messages:
                supabase.table("outbound_messages").update(
                    {
                        "status": "cancelled",
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("id", message["id"]).execute()
                cancelled_pending += 1

            if not sent_prior:
                skipped += 1
                continue

            event_key = cancelled_event_key(request)

            if insert_message(
                supabase=supabase,
                request=request,
                cleaner=cleaner,
                message_type="mission_cancelled",
                body=build_cancelled_body(request, reservation, property_, cleaner),
                event_key=event_key,
            ):
                created_cancelled += 1
                print(
                    "Created cancellation SMS: "
                    f"{property_.get('name') if property_ else 'property'} · "
                    f"{full_name(cleaner)}"
                )
            else:
                skipped += 1

            continue

        if request.get("status") == "created":
            if current_event_key in existing_event_keys:
                skipped += 1
                continue

            if insert_message(
                supabase=supabase,
                request=request,
                cleaner=cleaner,
                message_type="mission_offer",
                body=build_offer_body(request, reservation, property_, cleaner),
                event_key=current_event_key,
            ):
                created_offer += 1
                print(
                    "Created offer SMS: "
                    f"{property_.get('name') if property_ else 'property'} · "
                    f"{full_name(cleaner)} · {phone_for_sms(cleaner.get('phone'))}"
                )
            else:
                skipped += 1

            continue

        if request.get("status") == "sent":
            if current_event_key in existing_event_keys:
                skipped += 1
                continue

            if not sent_prior:
                # Legacy state: the request is already marked as sent, but we have
                # no SMS audit trail proving that our sender created the original
                # offer. Do NOT send an initial offer here, otherwise old missions
                # can be spammed during deployment/backfill.
                skipped += 1
                print(
                    "SKIP legacy sent request without prior SMS audit: "
                    f"{property_.get('name') if property_ else 'property'} · "
                    f"{full_name(cleaner)} · {request.get('id')}"
                )
                continue

            if insert_message(
                supabase=supabase,
                request=request,
                cleaner=cleaner,
                message_type="mission_modified",
                body=build_modified_body(request, reservation, property_, cleaner),
                event_key=current_event_key,
            ):
                created_modified += 1
                print(
                    "Created modification SMS: "
                    f"{property_.get('name') if property_ else 'property'} · "
                    f"{full_name(cleaner)}"
                )
            else:
                skipped += 1

    print(
        "Summary: "
        f"offer={created_offer} "
        f"modified={created_modified} "
        f"cancelled={created_cancelled} "
        f"pending_cancelled={cancelled_pending} "
        f"backfilled={backfilled} "
        f"skipped={skipped}"
    )


if __name__ == "__main__":
    main()
