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


def full_name(row: dict | None) -> str:
    if not row:
        return ""
    return " ".join(part for part in [row.get("first_name"), row.get("last_name")] if part)


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


def phone_event_hash(phone: str) -> str:
    return hashlib.sha256(phone.encode("utf-8")).hexdigest()[:12]


def event_key(request: dict, phone: str) -> str:
    return f"cleaning:{request['id']}:owner_overdue:{phone_event_hash(phone)}"


def already_queued(supabase, key: str) -> bool:
    existing = (
        supabase.table("outbound_messages")
        .select("id")
        .eq("event_key", key)
        .limit(1)
        .execute()
    )
    return bool(existing.data)


def format_anchor(anchor: datetime | None) -> str:
    if not anchor:
        return "date inconnue"
    return anchor.astimezone(PARIS).strftime("%d/%m/%Y à %Hh%M")


def build_body(request: dict, property_: dict | None, cleaner: dict | None, anchor: datetime | None) -> str:
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


def insert_alert(
    supabase,
    request: dict,
    property_: dict | None,
    cleaner: dict | None,
    recipient: dict,
    body: str,
    dry_run: bool,
) -> bool:
    phone = normalize_phone(recipient.get("phone"))
    if not phone:
        print(f"SKIP {request['id']}: recipient has no SMS phone")
        return False

    key = event_key(request, phone)

    if already_queued(supabase, key):
        print(f"SKIP {request['id']}: overdue alert already queued for {phone}")
        return False

    payload = {
        "cleaning_request_id": request["id"],
        "channel": "sms",
        "message_type": "cleaning_overdue_owner_alert",
        "recipient_phone": phone,
        "body": body,
        "status": "pending",
        "provider": "twilio",
        "event_key": key,
    }

    if cleaner and cleaner.get("id"):
        payload["cleaner_id"] = cleaner["id"]

    if property_ and property_.get("owner_id"):
        payload["owner_id"] = property_["owner_id"]

    if dry_run:
        print(f"DRY RUN would enqueue overdue alert request={request['id']} phone={phone}")
        print(body)
        return True

    supabase.table("outbound_messages").insert(payload).execute()
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--grace-minutes", type=int, default=int(os.getenv("CLEANING_OVERDUE_GRACE_MINUTES", "90")))
    parser.add_argument("--lookback-days", type=int, default=int(os.getenv("CLEANING_OVERDUE_LOOKBACK_DAYS", "14")))
    args = parser.parse_args()

    supabase = get_supabase_client()
    now = datetime.now(tz=UTC)
    cutoff = now - timedelta(minutes=args.grace_minutes)
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

        if oldest <= anchor_utc <= cutoff:
            overdue_requests.append((request, anchor))

    if not overdue_requests:
        print("No overdue accepted cleaning requests.")
        return

    request_ids = [request["id"] for request, _anchor in overdue_requests]
    property_ids = sorted({str(request["property_id"]) for request, _anchor in overdue_requests if request.get("property_id")})
    cleaner_ids = sorted({str(request["assigned_cleaner_id"]) for request, _anchor in overdue_requests if request.get("assigned_cleaner_id")})

    reports_by_request: dict[str, list[dict]] = {}
    try:
        reports = (
            supabase.table("cleaning_reports")
            .select("cleaning_request_id,id,created_at,submitted_at")
            .in_("cleaning_request_id", request_ids)
            .execute()
            .data
            or []
        )
        for report in reports:
            reports_by_request.setdefault(str(report["cleaning_request_id"]), []).append(report)
    except Exception as exc:
        print(f"WARNING: could not read cleaning_reports: {exc}")

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

    created = 0
    skipped = 0
    completed = 0

    for request, anchor in overdue_requests:
        request_id = str(request["id"])

        if reports_by_request.get(request_id):
            completed += 1
            continue

        property_id = str(request.get("property_id"))
        property_ = properties.get(property_id)
        cleaner = cleaners.get(str(request.get("assigned_cleaner_id")))

        recipients = recipient_rows_for_property(recipients_by_property, property_id)
        if not recipients:
            print(f"SKIP {request_id}: no overdue alert recipients for property={property_id}")
            skipped += 1
            continue

        body = build_body(request, property_, cleaner, anchor)

        for recipient in recipients:
            if insert_alert(
                supabase=supabase,
                request=request,
                property_=property_,
                cleaner=cleaner,
                recipient=recipient,
                body=body,
                dry_run=args.dry_run,
            ):
                created += 1
                print(
                    "Created overdue alert: "
                    f"{(property_ or {}).get('name') or 'property'} · "
                    f"{recipient.get('name') or recipient.get('phone')}"
                )
            else:
                skipped += 1

    print(f"Summary: created={created} completed={completed} skipped={skipped}")


if __name__ == "__main__":
    main()
