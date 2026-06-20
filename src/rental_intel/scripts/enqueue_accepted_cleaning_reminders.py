from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

PARIS = ZoneInfo("Europe/Paris")
UTC = ZoneInfo("UTC")
CLEANER_WEB_BASE_URL = os.getenv("CLEANER_WEB_BASE_URL", "http://localhost:3000")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def first_present(row: dict | None, keys: list[str]) -> str | None:
    if not row:
        return None

    payload = row.get("payload") or row.get("metadata") or {}
    if not isinstance(payload, dict):
        payload = {}

    for key in keys:
        value = row.get(key) or payload.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()

    return None


def full_name(row: dict | None) -> str:
    if not row:
        return ""
    return " ".join(
        part for part in [row.get("first_name"), row.get("last_name")] if part
    )


def first_name(row: dict | None) -> str:
    if not row:
        return "Bonjour"
    return row.get("first_name") or full_name(row) or "Bonjour"


def phone_for_sms(cleaner: dict | None) -> str | None:
    phone = first_present(
        cleaner,
        ["phone", "phone_number", "mobile", "mobile_phone", "whatsapp", "whatsapp_phone"],
    )
    if not phone:
        return None
    return phone.replace(" ", "").replace(".", "").replace("-", "").strip()


def scheduled_text(request: dict) -> str:
    scheduled_start = parse_dt(request.get("scheduled_start_at"))
    if not scheduled_start:
        return "date à confirmer"

    return scheduled_start.astimezone(PARIS).strftime("%d/%m/%Y à %Hh%M")


def mission_link(request: dict) -> str:
    return f"{CLEANER_WEB_BASE_URL}/mission/{request['public_token']}"


def render_template(
    template: str,
    request: dict,
    property_: dict | None,
    cleaner: dict | None,
) -> str:
    property_name = (property_ or {}).get("name") or "Logement"

    return template.format(
        cleaner_first_name=first_name(cleaner),
        cleaner_name=full_name(cleaner) or first_name(cleaner),
        property_name=property_name,
        scheduled_text=scheduled_text(request),
        mission_link=mission_link(request),
    )


def event_key(request: dict, rule: dict) -> str:
    return f"cleaning:{request['id']}:reminder:{rule['rule_key']}"


def compute_due_at(request: dict, rule: dict) -> datetime | None:
    scheduled_start = parse_dt(request.get("scheduled_start_at"))
    if not scheduled_start:
        return None

    scheduled_start_utc = scheduled_start.astimezone(UTC)
    scheduled_local = scheduled_start.astimezone(PARIS)

    if rule.get("timing_type") == "minutes_before":
        minutes_before = int(rule.get("minutes_before") or 0)
        return scheduled_start_utc - timedelta(minutes=minutes_before)

    if rule.get("timing_type") == "day_of_at_time":
        raw_time = str(rule.get("local_time") or "09:00")
        hh, mm, *_ = raw_time.split(":")

        local_due = datetime.combine(
            scheduled_local.date(),
            time(hour=int(hh), minute=int(mm)),
            tzinfo=PARIS,
        )

        return local_due.astimezone(UTC)

    return None


def already_queued(supabase, key: str) -> bool:
    existing = (
        supabase.table("outbound_messages")
        .select("id")
        .eq("event_key", key)
        .limit(1)
        .execute()
    )
    return bool(existing.data)


def insert_message(
    supabase,
    request: dict,
    cleaner: dict,
    rule: dict,
    body: str,
    dry_run: bool,
) -> bool:
    recipient_phone = phone_for_sms(cleaner)
    key = event_key(request, rule)

    if not recipient_phone:
        print(f"SKIP {request['id']}: assigned cleaner has no phone number")
        return False

    if already_queued(supabase, key):
        print(f"SKIP {request['id']}: reminder already queued for {rule['rule_key']}")
        return False

    payload = {
        "cleaning_request_id": request["id"],
        "channel": rule.get("channel") or "sms",
        "message_type": "accepted_cleaning_reminder",
        "recipient_phone": recipient_phone,
        "body": body,
        "status": "pending",
        "provider": rule.get("provider") or "twilio",
        "event_key": key,
    }

    if dry_run:
        print(
            f"DRY RUN would enqueue {rule['rule_key']} "
            f"for request={request['id']} phone={recipient_phone}"
        )
        return True

    supabase.table("outbound_messages").insert(payload).execute()
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--lookahead-days", type=int, default=14)
    parser.add_argument("--lookback-hours", type=int, default=48)
    args = parser.parse_args()

    supabase = get_supabase_client()
    now = datetime.now(tz=UTC)

    rules_result = (
        supabase.table("cleaning_reminder_rules")
        .select("*")
        .eq("enabled", True)
        .eq("trigger_event", "accepted_cleaning")
        .execute()
    )
    rules = rules_result.data or []

    if not rules:
        print("No enabled reminder rules.")
        return

    window_start = (now - timedelta(hours=args.lookback_hours)).isoformat()
    window_end = (now + timedelta(days=args.lookahead_days)).isoformat()

    requests_result = (
        supabase.table("cleaning_requests")
        .select("*")
        .eq("status", "accepted")
        .gte("scheduled_start_at", window_start)
        .lte("scheduled_start_at", window_end)
        .execute()
    )
    requests = requests_result.data or []

    if not requests:
        print("No accepted cleaning requests in reminder window.")
        return

    property_ids = sorted({r["property_id"] for r in requests if r.get("property_id")})
    cleaner_ids = sorted({r["assigned_cleaner_id"] for r in requests if r.get("assigned_cleaner_id")})

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
    not_due = 0
    stale = 0

    for request in requests:
        cleaner = cleaners.get(str(request.get("assigned_cleaner_id")))
        property_ = properties.get(str(request.get("property_id")))

        if not cleaner:
            print(f"SKIP {request['id']}: assigned cleaner missing")
            skipped += 1
            continue

        for rule in rules:
            due_at = compute_due_at(request, rule)
            if not due_at:
                skipped += 1
                continue

            grace = timedelta(minutes=int(rule.get("grace_minutes") or 180))

            if due_at > now:
                not_due += 1
                continue

            if now - due_at > grace:
                stale += 1
                print(
                    f"STALE {request['id']} {rule['rule_key']}: "
                    f"due_at={due_at.isoformat()} now={now.isoformat()}"
                )
                continue

            body = render_template(rule["message_template"], request, property_, cleaner)

            if insert_message(
                supabase=supabase,
                request=request,
                cleaner=cleaner,
                rule=rule,
                body=body,
                dry_run=args.dry_run,
            ):
                created += 1
                print(
                    "Created reminder SMS: "
                    f"{rule['rule_key']} · "
                    f"{property_.get('name') if property_ else 'property'} · "
                    f"{full_name(cleaner)}"
                )
            else:
                skipped += 1

    print(
        "Summary: "
        f"created={created} "
        f"not_due={not_due} "
        f"stale={stale} "
        f"skipped={skipped}"
    )


if __name__ == "__main__":
    main()
