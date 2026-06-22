from __future__ import annotations

import argparse
import hashlib
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

UTC = ZoneInfo("UTC")
PARIS = ZoneInfo("Europe/Paris")

CLEANER_WEB_BASE_URL = os.getenv("CLEANER_WEB_BASE_URL", "http://localhost:3000")
SMS_PROPERTY_ID_FILTER = {
    value.strip()
    for value in os.getenv("CLEANING_SMS_PROPERTY_IDS", "").split(",")
    if value.strip()
}
FALLBACK_OWNER_PHONES = [
    value.strip()
    for value in os.getenv("CLEANING_OWNER_ALERT_PHONES", "").split(",")
    if value.strip()
]


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    return phone.replace(" ", "").replace(".", "").replace("-", "").strip()


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
    return " ".join(part for part in [row.get("first_name"), row.get("last_name")] if part)


def first_name(row: dict | None) -> str:
    if not row:
        return "Bonjour"
    return row.get("first_name") or full_name(row) or "Bonjour"


def cleaner_phone(cleaner: dict | None) -> str | None:
    return normalize_phone(
        first_present(
            cleaner,
            ["phone", "phone_number", "mobile", "mobile_phone", "whatsapp", "whatsapp_phone"],
        )
    )


def property_allowed_for_sms(request: dict) -> bool:
    if not SMS_PROPERTY_ID_FILTER:
        return True
    property_id = request.get("property_id")
    return bool(property_id and str(property_id) in SMS_PROPERTY_ID_FILTER)


def overdue_anchor_at(request: dict) -> datetime | None:
    return (
        parse_dt(request.get("ready_by_at"))
        or parse_dt(request.get("completion_deadline_at"))
        or parse_dt(request.get("work_window_end_at"))
        or parse_dt(request.get("scheduled_end_at"))
        or parse_dt(request.get("scheduled_start_at"))
    )


def owner_issue_url(request: dict) -> str:
    return f"{CLEANER_WEB_BASE_URL}/owner/issues/request/{request['id']}"


def cleaner_report_url(request: dict) -> str:
    return f"{CLEANER_WEB_BASE_URL}/mission/{request['public_token']}/report"


def phone_event_hash(phone: str) -> str:
    return hashlib.sha256(phone.encode("utf-8")).hexdigest()[:12]


def owner_event_key(request: dict, phone: str) -> str:
    return f"cleaning:{request['id']}:owner_overdue:{phone_event_hash(phone)}"


def cleaner_event_key(request: dict) -> str:
    return f"cleaning:{request['id']}:cleaner_overdue_nudge"


def already_queued(supabase, key: str) -> bool:
    existing = (
        supabase.table("outbound_messages")
        .select("id")
        .eq("event_key", key)
        .limit(1)
        .execute()
    )
    return bool(existing.data)


def mark_request_overdue(supabase, request: dict, dry_run: bool) -> bool:
    if request.get("schedule_status") in {"cleaning_overdue", "overdue"}:
        return False

    if request.get("status") != "accepted":
        return False

    now_iso = datetime.now(tz=UTC).isoformat()

    payload = {
        "schedule_status": "cleaning_overdue",
        "planning_changed_at": now_iso,
        "updated_at": now_iso,
    }

    if dry_run:
        print(f"DRY RUN would mark request overdue: {request['id']}")
        return True

    supabase.table("cleaning_requests").update(payload).eq("id", request["id"]).eq(
        "status",
        "accepted",
    ).execute()

    request["schedule_status"] = "cleaning_overdue"
    request["planning_changed_at"] = now_iso
    request["updated_at"] = now_iso

    return True


def format_anchor(anchor: datetime | None) -> str:
    if not anchor:
        return "date inconnue"
    return anchor.astimezone(PARIS).strftime("%d/%m/%Y à %Hh%M")


def build_cleaner_body(request: dict, property_: dict | None, cleaner: dict | None, anchor: datetime | None) -> str:
    property_name = (property_ or {}).get("name") or "le logement"
    return (
        f"Bonjour {first_name(cleaner)}, la mission à {property_name} devait être "
        f"confirmée avant le {format_anchor(anchor)}. "
        f"Merci de valider la mission ou de nous signaler un problème : "
        f"{cleaner_report_url(request)}"
    )


def build_owner_body(request: dict, property_: dict | None, cleaner: dict | None, anchor: datetime | None) -> str:
    property_name = (property_ or {}).get("name") or "Logement"
    cleaner_name = full_name(cleaner) or "intervenante non identifiée"
    return (
        f"⚠️ Alerte ménage : {property_name} devait être prêt avant "
        f"{format_anchor(anchor)}. Aucune validation reçue. "
        f"Intervenante : {cleaner_name}. "
        f"Suivi : {owner_issue_url(request)}"
    )


def recipient_rows_for_property(recipients_by_property: dict[str, list[dict]], property_id: str) -> list[dict]:
    rows = recipients_by_property.get(property_id) or []
    if rows:
        return rows

    return [
        {
            "name": "Fallback owner",
            "phone": phone,
            "channel": "sms",
            "alert_type": "cleaning_overdue",
        }
        for phone in FALLBACK_OWNER_PHONES
    ]


def insert_sms(
    supabase,
    *,
    request: dict,
    cleaner: dict | None,
    property_: dict | None,
    recipient_phone: str,
    body: str,
    message_type: str,
    event_key: str,
    dry_run: bool,
) -> bool:
    phone = normalize_phone(recipient_phone)
    if not phone:
        print(f"SKIP {request['id']}: missing recipient phone")
        return False

    if already_queued(supabase, event_key):
        print(f"SKIP {request['id']}: already queued {message_type} for {phone}")
        return False

    payload = {
        "cleaning_request_id": request["id"],
        "channel": "sms",
        "message_type": message_type,
        "recipient_phone": phone,
        "body": body,
        "status": "pending",
        "provider": "twilio",
        "event_key": event_key,
    }

    if cleaner and cleaner.get("id"):
        payload["cleaner_id"] = cleaner["id"]

    if property_ and property_.get("owner_id"):
        payload["owner_id"] = property_["owner_id"]

    if dry_run:
        print(f"DRY RUN would enqueue {message_type} request={request['id']} phone={phone}")
        print(body)
        return True

    supabase.table("outbound_messages").insert(payload).execute()
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--cleaner-grace-minutes",
        type=int,
        default=int(os.getenv("CLEANING_OVERDUE_CLEANER_GRACE_MINUTES", "30")),
    )
    parser.add_argument(
        "--owner-grace-minutes",
        type=int,
        default=int(os.getenv("CLEANING_OVERDUE_OWNER_GRACE_MINUTES", "90")),
    )
    # Backwards-compatible alias used by the cron we already added.
    parser.add_argument("--grace-minutes", type=int, default=None)
    parser.add_argument("--lookback-days", type=int, default=int(os.getenv("CLEANING_OVERDUE_LOOKBACK_DAYS", "14")))
    args = parser.parse_args()

    if args.grace_minutes is not None:
        args.owner_grace_minutes = args.grace_minutes

    supabase = get_supabase_client()
    now = datetime.now(tz=UTC)
    oldest = now - timedelta(days=args.lookback_days)

    requests = (
        supabase.table("cleaning_requests")
        .select("*")
        .eq("status", "accepted")
        .execute()
        .data
        or []
    )

    if SMS_PROPERTY_ID_FILTER:
        before = len(requests)
        requests = [request for request in requests if property_allowed_for_sms(request)]
        print(f"SMS property filter active for overdue alerts: {len(requests)}/{before} accepted requests kept")

    overdue_requests = []
    for request in requests:
        anchor = overdue_anchor_at(request)
        if not anchor:
            continue

        anchor_utc = anchor.astimezone(UTC)
        cleaner_cutoff = now - timedelta(minutes=args.cleaner_grace_minutes)
        owner_cutoff = now - timedelta(minutes=args.owner_grace_minutes)

        if oldest <= anchor_utc <= cleaner_cutoff:
            overdue_requests.append((request, anchor, anchor_utc <= owner_cutoff))

    if not overdue_requests:
        print("No overdue accepted cleaning requests.")
        return

    request_ids = [request["id"] for request, _anchor, _owner_due in overdue_requests]
    property_ids = sorted({str(request["property_id"]) for request, _anchor, _owner_due in overdue_requests if request.get("property_id")})
    cleaner_ids = sorted({str(request["assigned_cleaner_id"]) for request, _anchor, _owner_due in overdue_requests if request.get("assigned_cleaner_id")})

    try:
        reports = (
            supabase.table("cleaning_reports")
            .select("cleaning_request_id,id,created_at,submitted_at")
            .in_("cleaning_request_id", request_ids)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        raise RuntimeError(f"Could not read cleaning_reports; refusing to send overdue alerts: {exc}") from exc

    reports_by_request: dict[str, list[dict]] = {}
    for report in reports:
        reports_by_request.setdefault(str(report["cleaning_request_id"]), []).append(report)

    properties = {}
    if property_ids:
        rows = supabase.table("properties").select("*").in_("id", property_ids).execute().data or []
        properties = {str(row["id"]): row for row in rows}

    cleaners = {}
    if cleaner_ids:
        rows = supabase.table("cleaners").select("*").in_("id", cleaner_ids).execute().data or []
        cleaners = {str(row["id"]): row for row in rows}

    recipients_by_property: dict[str, list[dict]] = {}
    if property_ids:
        try:
            rows = (
                supabase.table("property_notification_recipients")
                .select("*")
                .in_("property_id", property_ids)
                .eq("alert_type", "cleaning_overdue")
                .eq("enabled", True)
                .execute()
                .data
                or []
            )
            for row in rows:
                recipients_by_property.setdefault(str(row["property_id"]), []).append(row)
        except Exception as exc:
            print(f"WARNING: could not read property_notification_recipients: {exc}")

    created_cleaner = 0
    created_owner = 0
    marked_overdue = 0
    skipped = 0
    completed = 0

    for request, anchor, owner_due in overdue_requests:
        request_id = str(request["id"])

        if reports_by_request.get(request_id):
            completed += 1
            continue

        if mark_request_overdue(supabase, request, args.dry_run):
            marked_overdue += 1

        property_id = str(request.get("property_id"))
        property_ = properties.get(property_id)
        cleaner = cleaners.get(str(request.get("assigned_cleaner_id")))

        # Stage 1: nudge cleaner once.
        phone = cleaner_phone(cleaner)
        if phone:
            if insert_sms(
                supabase,
                request=request,
                cleaner=cleaner,
                property_=property_,
                recipient_phone=phone,
                body=build_cleaner_body(request, property_, cleaner, anchor),
                message_type="cleaning_overdue_cleaner_nudge",
                event_key=cleaner_event_key(request),
                dry_run=args.dry_run,
            ):
                created_cleaner += 1
                print(
                    "Created cleaner overdue nudge: "
                    f"{(property_ or {}).get('name') or 'property'} · {full_name(cleaner)}"
                )
            else:
                skipped += 1
        else:
            print(f"SKIP {request_id}: assigned cleaner has no phone")
            skipped += 1

        # Stage 2: alert owner(s) after a longer grace period.
        if not owner_due:
            continue

        recipients = recipient_rows_for_property(recipients_by_property, property_id)
        if not recipients:
            print(f"SKIP {request_id}: no owner alert recipients for property={property_id}")
            skipped += 1
            continue

        owner_body = build_owner_body(request, property_, cleaner, anchor)

        for recipient in recipients:
            phone = normalize_phone(recipient.get("phone"))
            if insert_sms(
                supabase,
                request=request,
                cleaner=cleaner,
                property_=property_,
                recipient_phone=phone or "",
                body=owner_body,
                message_type="cleaning_overdue_owner_alert",
                event_key=owner_event_key(request, phone or ""),
                dry_run=args.dry_run,
            ):
                created_owner += 1
                print(
                    "Created owner overdue alert: "
                    f"{(property_ or {}).get('name') or 'property'} · "
                    f"{recipient.get('name') or phone}"
                )
            else:
                skipped += 1

    print(
        "Summary: "
        f"cleaner_nudges={created_cleaner} "
        f"owner_alerts={created_owner} "
        f"marked_overdue={marked_overdue} "
        f"completed={completed} "
        f"skipped={skipped}"
    )


if __name__ == "__main__":
    main()
