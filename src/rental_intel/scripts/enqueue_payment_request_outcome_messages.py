from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

BASE_URL = (
    os.getenv("CLEANER_WEB_BASE_URL")
    or os.getenv("PAYMENT_REQUEST_BASE_URL")
    or "https://missions.leclosdelavoilerie.com"
).rstrip("/")

APPLY = os.getenv("APPLY", "false").lower() in {"1", "true", "yes"}
UTC = timezone.utc


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def cleaner_locale(cleaner: dict | None) -> str:
    raw = str((cleaner or {}).get("preferred_language") or "fr").lower()
    return raw if raw in {"fr", "en", "ru"} else "fr"


def cleaner_first_name(cleaner: dict | None, locale: str) -> str:
    first_name = str((cleaner or {}).get("first_name") or "").strip()

    if first_name:
        return first_name

    return {
        "fr": "Bonjour",
        "en": "Hello",
        "ru": "Здравствуйте",
    }.get(locale, "Bonjour")


def phone_for_sms(cleaner: dict | None) -> str | None:
    if not cleaner:
        return None

    for key in ["phone", "mobile", "mobile_phone", "sms_phone", "notification_phone"]:
        value = str(cleaner.get(key) or "").strip()
        if value:
            return value.replace(" ", "").replace(".", "").replace("-", "")

    return None


def money_label(value: object, locale: str) -> str:
    try:
        amount = float(value or 0)
    except Exception:
        amount = 0.0

    formatted = f"{amount:,.2f}".replace(",", " ").replace(".", ",")

    if locale == "en":
        formatted = f"{amount:,.2f}"

    return f"{formatted} €"


def period_label(request: dict, locale: str) -> str:
    raw = request.get("period_start")

    if not raw:
        return {
            "fr": "la période demandée",
            "en": "the requested period",
            "ru": "запрошенный период",
        }.get(locale, "la période demandée")

    try:
        date = datetime.fromisoformat(str(raw)[:10])
        return f"{date.month:02d}/{date.year}"
    except Exception:
        return str(raw)


def cleaner_payments_link(cleaner: dict | None) -> str:
    token = str((cleaner or {}).get("public_token") or "").strip()

    if not token:
        return BASE_URL

    return f"{BASE_URL}/cleaner/{token}/payments"


def refusal_reason(request: dict) -> str:
    for key in [
        "refusal_reason",
        "refused_reason",
        "rejection_reason",
        "owner_refusal_reason",
        "payment_refusal_reason",
        "status_reason",
    ]:
      value = str(request.get(key) or "").strip()
      if value:
          return value

    return ""


def message_type_for_status(status: str) -> str:
    return {
        "paid": "monthly_payment_request_paid_cleaner",
        "refused": "monthly_payment_request_refused_cleaner",
    }[status]


def event_key_for_status(request: dict, status: str) -> str:
    return f"payment_request_cleaner:{request['id']}:{status}"


def build_body(request: dict, cleaner: dict, status: str) -> str:
    locale = cleaner_locale(cleaner)
    first_name = cleaner_first_name(cleaner, locale)
    period = period_label(request, locale)
    amount = money_label(request.get("total_eur"), locale)
    link = cleaner_payments_link(cleaner)
    reason = refusal_reason(request)

    if status == "paid":
        if locale == "en":
            return "\n".join([
                f"Hello {first_name} 👋",
                "",
                "Good news: your payment request has been marked as paid.",
                f"Period: {period}",
                f"Amount: {amount}",
                "",
                f"Follow-up: {link}",
            ])

        if locale == "ru":
            return "\n".join([
                f"Здравствуйте, {first_name} 👋",
                "",
                "Хорошая новость: ваш запрос на оплату отмечен как оплаченный.",
                f"Период: {period}",
                f"Сумма: {amount}",
                "",
                f"Подробнее: {link}",
            ])

        return "\n".join([
            f"Bonjour {first_name} 👋",
            "",
            "Bonne nouvelle : votre demande de paiement a été marquée comme payée.",
            f"Période : {period}",
            f"Montant : {amount}",
            "",
            f"Suivi : {link}",
        ])

    if locale == "en":
        lines = [
            f"Hello {first_name} 👋",
            "",
            "Your payment request has been refused / needs correction.",
            f"Period: {period}",
            f"Amount: {amount}",
        ]

        if reason:
            lines.append(f"Reason: {reason}")

        lines.extend(["", f"Open your payments page: {link}"])
        return "\n".join(lines)

    if locale == "ru":
        lines = [
            f"Здравствуйте, {first_name} 👋",
            "",
            "Ваш запрос на оплату отклонён или требует исправления.",
            f"Период: {period}",
            f"Сумма: {amount}",
        ]

        if reason:
            lines.append(f"Причина: {reason}")

        lines.extend(["", f"Откройте страницу оплат: {link}"])
        return "\n".join(lines)

    lines = [
        f"Bonjour {first_name} 👋",
        "",
        "Votre demande de paiement a été refusée / à corriger.",
        f"Période : {period}",
        f"Montant : {amount}",
    ]

    if reason:
        lines.append(f"Raison : {reason}")

    lines.extend(["", f"Ouvrez votre espace paiements : {link}"])
    return "\n".join(lines)


def already_queued(supabase, key: str) -> bool:
    result = (
        supabase.table("outbound_messages")
        .select("id")
        .eq("event_key", key)
        .limit(1)
        .execute()
    )

    return bool(result.data)


def should_consider(request: dict, since: datetime) -> bool:
    changed_at = (
        parse_dt(request.get("updated_at"))
        or parse_dt(request.get("paid_at"))
        or parse_dt(request.get("refused_at"))
        or parse_dt(request.get("created_at"))
    )

    if not changed_at:
        return True

    return changed_at >= since


def enqueue_message(supabase, request: dict, cleaner: dict, dry_run: bool) -> bool:
    status = str(request.get("status") or "").lower()

    if status not in {"paid", "refused"}:
        return False

    phone = phone_for_sms(cleaner)

    if not phone:
        print(f"SKIP {request['id']}: cleaner has no SMS phone")
        return False

    key = event_key_for_status(request, status)

    if already_queued(supabase, key):
        print(f"SKIP {request['id']}: already queued {status}")
        return False

    payload = {
        "channel": "sms",
        "message_type": message_type_for_status(status),
        "recipient_phone": phone,
        "body": build_body(request, cleaner, status),
        "status": "pending",
        "provider": "twilio",
        "event_key": key,
        "cleaner_id": request.get("cleaner_id"),
        "owner_id": request.get("owner_id"),
        "monthly_payment_request_id": request["id"],
    }

    if dry_run:
        print("-" * 60)
        print(f"DRY RUN would enqueue {payload['message_type']} for {phone}")
        print(payload["body"])
        return True

    supabase.table("outbound_messages").insert(payload).execute()
    print(f"Queued {payload['message_type']} for request={request['id']} phone={phone}")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--lookback-days", type=int, default=int(os.getenv("PAYMENT_OUTCOME_LOOKBACK_DAYS", "14")))
    parser.add_argument("--limit", type=int, default=int(os.getenv("PAYMENT_OUTCOME_LIMIT", "200")))
    args = parser.parse_args()

    dry_run = args.dry_run or not APPLY
    since = datetime.now(tz=UTC) - timedelta(days=args.lookback_days)

    supabase = get_supabase_client()

    result = (
        supabase.table("monthly_payment_requests")
        .select("*")
        .in_("status", ["paid", "refused"])
        .order("created_at", desc=True)
        .limit(args.limit)
        .execute()
    )

    requests = [
        row for row in (result.data or [])
        if should_consider(row, since)
    ]

    if not requests:
        print("No paid/refused payment requests in outcome window.")
        return

    cleaner_ids = sorted({
        str(row.get("cleaner_id"))
        for row in requests
        if row.get("cleaner_id")
    })

    cleaners = {}

    if cleaner_ids:
        cleaner_result = (
            supabase.table("cleaners")
            .select("*")
            .in_("id", cleaner_ids)
            .execute()
        )
        cleaners = {
            str(row["id"]): row
            for row in (cleaner_result.data or [])
            if row.get("id")
        }

    created = 0
    skipped = 0

    for request in requests:
        cleaner = cleaners.get(str(request.get("cleaner_id")))

        if not cleaner:
            print(f"SKIP {request['id']}: cleaner missing")
            skipped += 1
            continue

        if enqueue_message(supabase, request, cleaner, dry_run=dry_run):
            created += 1
        else:
            skipped += 1

    mode = "dry_run" if dry_run else "apply"
    print(f"Summary: mode={mode} queued={created} skipped={skipped}")


if __name__ == "__main__":
    main()
