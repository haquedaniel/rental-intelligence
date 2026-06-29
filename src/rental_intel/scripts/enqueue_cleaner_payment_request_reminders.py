from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

PARIS = ZoneInfo("Europe/Paris")

BASE_URL = os.getenv(
    "CLEANER_WEB_BASE_URL",
    "https://missions.leclosdelavoilerie.com",
).rstrip("/")

FORCE = os.getenv("FORCE", "false").lower() in {"1", "true", "yes", "y"}
APPLY = os.getenv("APPLY", "true").lower() in {"1", "true", "yes", "y"}

ACTIVE_PAYMENT_REQUEST_STATUSES = {
    "draft",
    "sent_to_owner",
    "paid",
    "overdue",
}

COMPLETED_MISSION_STATUSES = {
    "completed",
    "report_submitted",
    "problem_reported",
}


def money(value: float | int | str | None) -> float:
    return round(float(value or 0), 2)


def paris_date_key(value: str | datetime) -> str:
    date = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    local = date.astimezone(PARIS)
    return local.date().isoformat()


def mission_date_key(mission: dict) -> str:
    return paris_date_key(
        mission.get("ready_by_at")
        or mission.get("completion_deadline_at")
        or mission.get("work_window_end_at")
        or mission.get("scheduled_end_at")
        or mission.get("scheduled_start_at")
        or mission.get("updated_at")
        or mission.get("created_at")
    )


def cleaner_locale(cleaner: dict) -> str:
    locale = str(cleaner.get("preferred_language") or "fr").lower()
    return locale if locale in {"fr", "en", "ru"} else "fr"


def cleaner_display_name(cleaner: dict) -> str:
    return (
        cleaner.get("first_name")
        or cleaner.get("trading_name")
        or "Sandrine"
    )


def cleaner_phone(cleaner: dict) -> str | None:
    return (
        cleaner.get("phone")
        or cleaner.get("mobile")
        or cleaner.get("phone_number")
        or cleaner.get("whatsapp_number")
    )


def sms_body(locale: str, cleaner_name: str, mission_count: int, amount: float, link: str) -> str:
    amount_text = f"{amount:.2f} €"

    if locale == "en":
        return (
            f"Hello {cleaner_name}, you have {amount_text} ready to request "
            f"for {mission_count} completed mission(s). Open Pilotys Payments: {link}"
        )

    if locale == "ru":
        return (
            f"Здравствуйте, {cleaner_name}! У вас {amount_text} к запросу "
            f"за {mission_count} выполн. заданий. Откройте оплату Pilotys: {link}"
        )

    return (
        f"Bonjour {cleaner_name}, vous avez {amount_text} à demander "
        f"pour {mission_count} mission(s) terminée(s). Ouvrez Paiements Pilotys : {link}"
    )


def load_rows(supabase, table: str, select: str = "*") -> list[dict]:
    result = supabase.table(table).select(select).execute()
    return result.data or []


def main() -> None:
    now = datetime.now(PARIS)
    current_month_start = now.date().replace(day=1).isoformat()
    reminder_month = now.strftime("%Y-%m")

    if now.day != 1 and not FORCE:
        print(
            f"Not the 1st of the month in Europe/Paris ({now.date().isoformat()}). "
            "Nothing to do. Use FORCE=true to run anyway."
        )
        return

    supabase = get_supabase_client()

    cleaners = load_rows(
        supabase,
        "cleaners",
        "*",
    )

    cleaners_by_id = {
        str(cleaner["id"]): cleaner
        for cleaner in cleaners
        if cleaner.get("id")
    }

    requests = load_rows(
        supabase,
        "cleaning_requests",
        "id,assigned_cleaner_id,status,total_cost_eur,ready_by_at,completion_deadline_at,work_window_end_at,scheduled_end_at,scheduled_start_at,updated_at,created_at",
    )

    payment_requests = load_rows(
        supabase,
        "monthly_payment_requests",
        "id,status,cleaner_id",
    )

    active_payment_request_ids = {
        str(request["id"])
        for request in payment_requests
        if str(request.get("status") or "draft") in ACTIVE_PAYMENT_REQUEST_STATUSES
    }

    payment_lines = []
    if active_payment_request_ids:
        payment_lines = load_rows(
            supabase,
            "monthly_payment_request_lines",
            "monthly_payment_request_id,cleaning_request_id",
        )

    already_included_request_ids = {
        str(line["cleaning_request_id"])
        for line in payment_lines
        if line.get("cleaning_request_id")
        and str(line.get("monthly_payment_request_id")) in active_payment_request_ids
    }

    requestable_by_cleaner: dict[str, list[dict]] = defaultdict(list)

    for request in requests:
        request_id = str(request.get("id"))
        cleaner_id = str(request.get("assigned_cleaner_id") or "")

        if not cleaner_id:
            continue

        if str(request.get("status")) not in COMPLETED_MISSION_STATUSES:
            continue

        if request_id in already_included_request_ids:
            continue

        if mission_date_key(request) >= current_month_start:
            continue

        requestable_by_cleaner[cleaner_id].append(request)

    queued = 0
    skipped_no_phone = 0
    skipped_no_token = 0
    skipped_duplicate = 0

    print()
    print(f"Cleaner payment request reminders · {reminder_month}")
    print(f"Mode: {'APPLY' if APPLY else 'DRY RUN'}")
    print()

    for cleaner_id, missions in sorted(requestable_by_cleaner.items()):
        cleaner = cleaners_by_id.get(cleaner_id)

        if not cleaner:
            continue

        if cleaner.get("active") is False:
            continue

        if str(cleaner.get("status") or "active") != "active":
            continue

        token = cleaner.get("public_token")
        if not token:
            skipped_no_token += 1
            print(f"SKIP cleaner={cleaner_id}: no public_token")
            continue

        phone = cleaner_phone(cleaner)
        if not phone:
            skipped_no_phone += 1
            print(f"SKIP {cleaner_display_name(cleaner)}: no phone")
            continue

        amount = money(sum(money(mission.get("total_cost_eur")) for mission in missions))
        mission_count = len(missions)

        if mission_count == 0 or amount <= 0:
            continue

        locale = cleaner_locale(cleaner)
        name = cleaner_display_name(cleaner)
        link = f"{BASE_URL}/cleaner/{token}/payments"
        body = sms_body(locale, name, mission_count, amount, link)

        event_key = f"cleaner_payment_request_reminder:{cleaner_id}:{reminder_month}"

        existing = (
            supabase.table("outbound_messages")
            .select("id,status")
            .eq("event_key", event_key)
            .limit(1)
            .execute()
            .data
            or []
        )

        if existing:
            skipped_duplicate += 1
            print(f"SKIP duplicate {name}: {event_key}")
            continue

        print(f"QUEUE {name} · {phone} · {mission_count} mission(s) · {amount:.2f} €")
        print(f"  {body}")

        if APPLY:
            payload = {
                "channel": "sms",
                "message_type": "cleaner_payment_request_reminder",
                "recipient_phone": phone,
                "body": body,
                "status": "pending",
                "provider": "twilio",
                "cleaner_id": cleaner_id,
                "event_key": event_key,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            supabase.table("outbound_messages").insert(payload).execute()

        queued += 1

    print()
    print(
        f"Summary: queued={queued}, "
        f"skipped_no_phone={skipped_no_phone}, "
        f"skipped_no_token={skipped_no_token}, "
        f"skipped_duplicate={skipped_duplicate}"
    )


if __name__ == "__main__":
    main()
