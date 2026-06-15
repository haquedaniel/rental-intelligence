from __future__ import annotations

import os
import secrets
import traceback
from datetime import datetime, timedelta, timezone, time
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

PARIS = ZoneInfo("Europe/Paris")
JOB_NAME = "create_cleaning_requests_from_reservations"

LOOKAHEAD_DAYS = int(os.getenv("CLEANING_REQUEST_LOOKAHEAD_DAYS", "365"))
LOOKBACK_DAYS = int(os.getenv("CLEANING_REQUEST_LOOKBACK_DAYS", "2"))
DEFAULT_PROFILE_CODE = os.getenv("CLEANING_PROFILE_CODE", "light")
CLEANER_WEB_BASE_URL = os.getenv("CLEANER_WEB_BASE_URL", "http://localhost:3000")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def money(value: float) -> float:
    return round(float(value), 2)


def start_run(supabase):
    try:
        result = (
            supabase.table("automation_runs")
            .insert({"job_name": JOB_NAME, "status": "running"})
            .execute()
        )
        return (result.data or [{}])[0].get("id")
    except Exception:
        return None


def finish_run(supabase, run_id, status: str, summary: dict, log_lines: list[str], error_message: str | None = None):
    if not run_id:
        return

    started_at = summary.get("started_at")
    duration_seconds = None

    if started_at:
        duration_seconds = (datetime.now(timezone.utc) - started_at).total_seconds()

    clean_summary = {k: v for k, v in summary.items() if k != "started_at"}

    try:
        supabase.table("automation_runs").update(
            {
                "status": status,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "duration_seconds": duration_seconds,
                "summary": clean_summary,
                "log_tail": "\n".join(log_lines[-80:]),
                "error_message": error_message,
            }
        ).eq("id", run_id).execute()
    except Exception:
        pass


def load_rows(supabase, table: str) -> list[dict]:
    result = supabase.table(table).select("*").execute()
    return result.data or []


def by_id(rows: list[dict]) -> dict[str, dict]:
    return {str(row["id"]): row for row in rows if row.get("id")}


def get_profile_for_property(profiles: list[dict], property_id: str) -> dict | None:
    property_profiles = [
        profile for profile in profiles if str(profile.get("property_id")) == property_id
    ]

    if not property_profiles:
        return None

    for profile in property_profiles:
        if profile.get("code") == DEFAULT_PROFILE_CODE:
            return profile

    return property_profiles[0]


def compute_next_checkins(reservations: list[dict]) -> dict[str, datetime | None]:
    confirmed = []

    for reservation in reservations:
        if reservation.get("status") != "confirmed":
            continue

        checkin = parse_dt(reservation.get("checkin_at"))
        checkout = parse_dt(reservation.get("checkout_at"))

        if not checkin or not checkout:
            continue

        confirmed.append(
            {
                "id": reservation["id"],
                "property_id": reservation["property_id"],
                "checkin_at": checkin,
                "checkout_at": checkout,
            }
        )

    next_by_reservation: dict[str, datetime | None] = {}

    for current in confirmed:
        candidates = [
            other["checkin_at"]
            for other in confirmed
            if other["property_id"] == current["property_id"]
            and other["id"] != current["id"]
            and other["checkin_at"] >= current["checkout_at"]
        ]

        next_by_reservation[str(current["id"])] = min(candidates) if candidates else None

    return next_by_reservation


def build_request_payload(
    reservation: dict,
    property_: dict,
    cleaner: dict,
    profile: dict,
    next_checkin_at: datetime | None,
    existing_request: dict | None,
) -> tuple[dict, dict]:
    checkout_at = parse_dt(reservation.get("checkout_at"))

    if not checkout_at:
        raise ValueError(f"Reservation {reservation['id']} has no checkout_at")

    checkout_local = checkout_at.astimezone(PARIS)

    scheduled_start_local = datetime.combine(
        checkout_local.date(),
        time(hour=14, minute=0),
        tzinfo=PARIS,
    )

    estimated_hours = float(profile["estimated_hours"])
    scheduled_end_local = scheduled_start_local + timedelta(hours=estimated_hours)

    scheduled_start_at = scheduled_start_local.astimezone(timezone.utc)
    scheduled_end_at = scheduled_end_local.astimezone(timezone.utc)

    urgent = False
    if next_checkin_at:
        urgent = (next_checkin_at - checkout_at) <= timedelta(hours=36)

    distance_km = float(os.getenv("DEFAULT_CLEANER_DISTANCE_KM", "7.0"))

    included_radius = float(cleaner.get("included_radius_km") or 0)
    hourly_rate = float(cleaner.get("hourly_rate_eur") or 0)
    travel_rate = float(cleaner.get("travel_rate_per_km_eur") or 0)

    billable_travel_km = max(0.0, distance_km - included_radius)

    cleaning_cost = estimated_hours * hourly_rate
    travel_cost = billable_travel_km * travel_rate

    subtotal = cleaning_cost + travel_cost
    urgency_bonus_percent = 15.0 if urgent else 0.0
    urgency_bonus = subtotal * (urgency_bonus_percent / 100.0)
    total = subtotal + urgency_bonus

    now = datetime.now(timezone.utc)

    response_deadline_at = now + timedelta(hours=3 if urgent else 12)

    payload = {
        "property_id": property_["id"],
        "reservation_id": reservation["id"],
        "cleaning_profile_id": profile["id"],
        "assigned_cleaner_id": cleaner["id"],
        "scheduled_start_at": scheduled_start_at.isoformat(),
        "scheduled_end_at": scheduled_end_at.isoformat(),
        "urgent": urgent,
        "response_deadline_at": response_deadline_at.isoformat(),
        "number_of_guests": reservation.get("number_of_guests") or 0,
        "linen_required": bool(reservation.get("linen_required")),
        "laundry_required": bool(reservation.get("laundry_required")),
        "estimated_hours": estimated_hours,
        "cleaning_cost_eur": money(cleaning_cost),
        "travel_distance_km": money(distance_km),
        "billable_travel_km": money(billable_travel_km),
        "travel_cost_eur": money(travel_cost),
        "urgency_bonus_percent": money(urgency_bonus_percent),
        "urgency_bonus_eur": money(urgency_bonus),
        "total_cost_eur": money(total),
        "updated_at": now.isoformat(),
    }

    if existing_request:
        # Preserve workflow status and token.
        pass
    else:
        payload.update(
            {
                "status": "sent",
                "public_token": secrets.token_urlsafe(24),
                "public_token_expires_at": (now + timedelta(days=30)).isoformat(),
            }
        )

    meta = {
        "scheduled_start_local": scheduled_start_local,
        "urgent": urgent,
        "total": total,
    }

    return payload, meta


def main() -> None:
    supabase = get_supabase_client()
    run_id = start_run(supabase)

    log_lines: list[str] = []
    summary = {
        "started_at": datetime.now(timezone.utc),
        "reservations_seen": 0,
        "created": 0,
        "updated": 0,
        "cancelled": 0,
        "skipped_missing_config": 0,
        "skipped_existing_locked": 0,
        "skipped_not_upcoming": 0,
    }

    def log(message: str) -> None:
        print(message)
        log_lines.append(message)

    try:
        now = datetime.now(timezone.utc)
        lower_bound = now - timedelta(days=LOOKBACK_DAYS)
        upper_bound = now + timedelta(days=LOOKAHEAD_DAYS)

        reservations = load_rows(supabase, "reservations")
        properties = by_id(load_rows(supabase, "properties"))
        cleaners = by_id(load_rows(supabase, "cleaners"))
        profiles = load_rows(supabase, "property_cleaning_profiles")

        reservation_ids = [row["id"] for row in reservations if row.get("id")]

        existing_requests: dict[str, dict] = {}
        if reservation_ids:
            result = (
                supabase.table("cleaning_requests")
                .select("*")
                .in_("reservation_id", reservation_ids)
                .execute()
            )

            for request in result.data or []:
                if request.get("reservation_id"):
                    existing_requests[str(request["reservation_id"])] = request

        next_checkins = compute_next_checkins(reservations)

        for reservation in reservations:
            summary["reservations_seen"] += 1

            reservation_id = str(reservation["id"])
            status = reservation.get("status")
            checkout_at = parse_dt(reservation.get("checkout_at"))
            existing_request = existing_requests.get(reservation_id)

            if not checkout_at:
                continue

            if checkout_at < lower_bound or checkout_at > upper_bound:
                summary["skipped_not_upcoming"] += 1
                continue

            if status == "cancelled":
                if existing_request and existing_request.get("status") not in {
                    "completed",
                    "report_submitted",
                    "problem_reported",
                    "cancelled",
                }:
                    supabase.table("cleaning_requests").update(
                        {
                            "status": "cancelled",
                            "updated_at": now.isoformat(),
                        }
                    ).eq("id", existing_request["id"]).execute()

                    summary["cancelled"] += 1
                    log(
                        f"Cancelled cleaning request for reservation {reservation.get('source_booking_id')}"
                    )

                continue

            if status != "confirmed":
                continue

            if existing_request and existing_request.get("status") in {
                "completed",
                "report_submitted",
                "problem_reported",
            }:
                summary["skipped_existing_locked"] += 1
                continue

            property_id = str(reservation["property_id"])
            property_ = properties.get(property_id)

            if not property_:
                summary["skipped_missing_config"] += 1
                log(f"SKIP reservation {reservation.get('source_booking_id')}: missing property")
                continue

            preferred_cleaner_id = property_.get("preferred_cleaner_id")
            cleaner = cleaners.get(str(preferred_cleaner_id)) if preferred_cleaner_id else None

            profile = get_profile_for_property(profiles, property_id)

            if not cleaner or not profile:
                summary["skipped_missing_config"] += 1
                log(
                    "SKIP "
                    f"{property_.get('name')} reservation {reservation.get('source_booking_id')}: "
                    f"missing {'cleaner' if not cleaner else ''} "
                    f"{'profile' if not profile else ''}"
                )
                continue

            next_checkin_at = next_checkins.get(reservation_id)

            # Keep reservation.next_checkin_at fresh for the UI.
            if next_checkin_at:
                supabase.table("reservations").update(
                    {"next_checkin_at": next_checkin_at.isoformat()}
                ).eq("id", reservation_id).execute()

            payload, meta = build_request_payload(
                reservation=reservation,
                property_=property_,
                cleaner=cleaner,
                profile=profile,
                next_checkin_at=next_checkin_at,
                existing_request=existing_request,
            )

            if existing_request:
                supabase.table("cleaning_requests").update(payload).eq(
                    "id", existing_request["id"]
                ).execute()

                summary["updated"] += 1
                request = existing_request
                token = request.get("public_token")
                action = "Updated"
            else:
                result = supabase.table("cleaning_requests").insert(payload).execute()
                request = (result.data or [None])[0]
                token = request.get("public_token") if request else None

                summary["created"] += 1
                action = "Created"

            link = f"{CLEANER_WEB_BASE_URL}/mission/{token}" if token else "no-token"

            log(
                f"{action}: {property_.get('name')} · "
                f"{reservation.get('guest_name') or reservation.get('source_booking_id')} · "
                f"{meta['scheduled_start_local'].strftime('%d/%m/%Y %H:%M')} · "
                f"{money(meta['total']):.2f} € · {link}"
            )

        log("")
        log(
            "Summary: "
            f"created={summary['created']} "
            f"updated={summary['updated']} "
            f"cancelled={summary['cancelled']} "
            f"missing_config={summary['skipped_missing_config']} "
            f"locked={summary['skipped_existing_locked']}"
        )

        finish_run(supabase, run_id, "success", summary, log_lines)

    except Exception as exc:
        error_text = "".join(traceback.format_exception_only(type(exc), exc)).strip()
        log(error_text)
        finish_run(supabase, run_id, "failed", summary, log_lines, error_text)
        raise


if __name__ == "__main__":
    main()
