from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

BASE_URL = os.getenv("CLEANER_WEB_BASE_URL", "https://missions.leclosdelavoilerie.com").rstrip("/")
LOOKBACK_DAYS = int(os.getenv("CLEANING_REPORT_ALERT_LOOKBACK_DAYS", "30"))

SMS_PROPERTY_ID_FILTER = {
    value.strip()
    for value in os.getenv("CLEANING_SMS_PROPERTY_IDS", "").split(",")
    if value.strip()
}


def phone_for_sms(value: str | None) -> str | None:
    if not value:
        return None
    phone = value.replace(" ", "").replace(".", "").replace("-", "").strip()
    return phone or None


def full_name(row: dict | None) -> str:
    if not row:
        return "L’intervenante"
    return (
        " ".join(
            part
            for part in [
                row.get("first_name"),
                row.get("last_name"),
            ]
            if part
        )
        or row.get("name")
        or "L’intervenante"
    )


def report_has_problem(request: dict, report: dict | None) -> bool:
    if request.get("status") == "problem_reported":
        return True

    if not report:
        return False

    if report.get("ready_for_guests") is False:
        return True

    problem_fields = [
        "damage_found",
        "missing_items",
        "guest_left_items",
        "linen_problem",
        "consumables_problem",
        "problem_description",
    ]

    return any(bool(report.get(field)) for field in problem_fields)


def already_queued(supabase, event_key: str) -> bool:
    result = (
        supabase.table("outbound_messages")
        .select("id")
        .eq("event_key", event_key)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def body_for_alert(
    *,
    alert_type: str,
    request: dict,
    report: dict | None,
    property_: dict | None,
    cleaner: dict | None,
) -> str:
    property_name = (property_ or {}).get("name") or "Logement"
    cleaner_name = full_name(cleaner)
    report_url = f"{BASE_URL}/owner/reports/{request['id']}"

    if alert_type == "cleaning_problem":
        lines = [
            "Problème signalé ⚠️",
            f"{cleaner_name} a envoyé un rapport pour {property_name}.",
        ]

        if report and report.get("problem_description"):
            lines.append(str(report["problem_description"])[:220])

        lines.append(f"Rapport : {report_url}")
        return "\n".join(lines)

    return "\n".join(
        [
            "Ménage terminé ✅",
            f"{property_name} est indiqué prêt pour les voyageurs.",
            f"Rapport : {report_url}",
        ]
    )


def main() -> None:
    supabase = get_supabase_client()
    window_start = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).isoformat()

    requests_result = (
        supabase.table("cleaning_requests")
        .select("*")
        .in_("status", ["report_submitted", "completed", "problem_reported"])
        .gte("updated_at", window_start)
        .order("updated_at", desc=True)
        .execute()
    )

    requests = requests_result.data or []

    if SMS_PROPERTY_ID_FILTER:
        before = len(requests)
        requests = [
            request
            for request in requests
            if str(request.get("property_id")) in SMS_PROPERTY_ID_FILTER
        ]
        print(
            "Report alert property filter active: "
            f"{len(requests)}/{before} report requests kept"
        )

    if not requests:
        print("No submitted cleaning reports needing owner alerts.")
        return

    request_ids = [row["id"] for row in requests if row.get("id")]
    property_ids = sorted({row["property_id"] for row in requests if row.get("property_id")})
    cleaner_ids = sorted({row["assigned_cleaner_id"] for row in requests if row.get("assigned_cleaner_id")})

    reports = {}
    if request_ids:
        result = (
            supabase.table("cleaning_reports")
            .select("*")
            .in_("cleaning_request_id", request_ids)
            .execute()
        )
        reports = {
            str(row["cleaning_request_id"]): row
            for row in (result.data or [])
            if row.get("cleaning_request_id")
        }

    properties = {}
    if property_ids:
        result = (
            supabase.table("properties")
            .select("*")
            .in_("id", property_ids)
            .execute()
        )
        properties = {
            str(row["id"]): row
            for row in (result.data or [])
            if row.get("id")
        }

    cleaners = {}
    if cleaner_ids:
        result = (
            supabase.table("cleaners")
            .select("*")
            .in_("id", cleaner_ids)
            .execute()
        )
        cleaners = {
            str(row["id"]): row
            for row in (result.data or [])
            if row.get("id")
        }

    recipients_by_property: dict[str, list[dict]] = {}
    if property_ids:
        result = (
            supabase.table("property_notification_recipients")
            .select("*")
            .in_("property_id", property_ids)
            .eq("enabled", True)
            .eq("channel", "sms")
            .in_("alert_type", ["cleaning_completed", "cleaning_problem"])
            .execute()
        )

        for recipient in result.data or []:
            property_id = str(recipient.get("property_id"))
            recipients_by_property.setdefault(property_id, []).append(recipient)

    completed = 0
    problem = 0
    skipped = 0

    for request in requests:
      request_id = str(request["id"])
      property_id = str(request.get("property_id"))
      property_ = properties.get(property_id)
      cleaner = cleaners.get(str(request.get("assigned_cleaner_id")))
      report = reports.get(request_id)

      alert_type = "cleaning_problem" if report_has_problem(request, report) else "cleaning_completed"
      message_type = (
          "cleaning_problem_owner_alert"
          if alert_type == "cleaning_problem"
          else "cleaning_completed_owner_alert"
      )

      matching_recipients = [
          recipient
          for recipient in recipients_by_property.get(property_id, [])
          if recipient.get("alert_type") == alert_type
      ]

      if not matching_recipients:
          skipped += 1
          print(f"SKIP {request_id}: no enabled SMS recipient for {alert_type}")
          continue

      for recipient in matching_recipients:
          phone = phone_for_sms(recipient.get("phone"))
          if not phone:
              skipped += 1
              print(f"SKIP {request_id}: recipient has no phone")
              continue

          report_id = report.get("id") if report else "no-report"
          event_key = f"{message_type}:{request_id}:{report_id}:{phone}"

          if already_queued(supabase, event_key):
              skipped += 1
              print(f"SKIP {request_id}: already queued {message_type} for {phone}")
              continue

          body = body_for_alert(
              alert_type=alert_type,
              request=request,
              report=report,
              property_=property_,
              cleaner=cleaner,
          )

          payload = {
              "cleaning_request_id": request_id,
              "channel": "sms",
              "message_type": message_type,
              "recipient_phone": phone,
              "body": body,
              "status": "pending",
              "provider": "twilio",
              "event_key": event_key,
          }

          if property_ and property_.get("owner_id"):
              payload["owner_id"] = property_["owner_id"]

          supabase.table("outbound_messages").insert(payload).execute()

          if alert_type == "cleaning_problem":
              problem += 1
              print(f"QUEUED problem alert: {request_id} -> {phone}")
          else:
              completed += 1
              print(f"QUEUED completed alert: {request_id} -> {phone}")

    print(
        "Summary: "
        f"completed_alerts={completed} problem_alerts={problem} skipped={skipped}"
    )


if __name__ == "__main__":
    main()
