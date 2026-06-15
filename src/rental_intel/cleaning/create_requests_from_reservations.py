from __future__ import annotations

import os
import secrets
import traceback
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

PARIS = ZoneInfo("Europe/Paris")

JOB_NAME = "create_cleaning_requests_from_reservations"

LOOKAHEAD_DAYS = int(os.getenv("CLEANING_REQUEST_LOOKAHEAD_DAYS", "365"))
LOOKBACK_DAYS = int(os.getenv("CLEANING_REQUEST_LOOKBACK_DAYS", "2"))
DEFAULT_PROFILE_CODE = os.getenv("CLEANING_PROFILE_CODE", "light")
DEFAULT_CLEANER_DISTANCE_KM = float(os.getenv("DEFAULT_CLEANER_DISTANCE_KM", "0.0"))
CLEANER_WEB_BASE_URL = os.getenv("CLEANER_WEB_BASE_URL", "http://localhost:3000")

# Keep this as "sent" for now so we do not break the existing cleaner mission page.
# When we add the WhatsApp queue, we should switch this to "created".
INITIAL_REQUEST_STATUS = os.getenv("CLEANING_REQUEST_INITIAL_STATUS", "created")

FINAL_OR_HUMAN_LOCKED_STATUSES = {
    "accepted",
    "refused",
    "completed",
    "report_submitted",
    "problem_reported",
}


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(str(value)[:10])


def parse_time(value: str | None) -> time | None:
    if not value:
        return None
    return time.fromisoformat(str(value)[:5])


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


def finish_run(
    supabase,
    run_id,
    status: str,
    summary: dict,
    log_lines: list[str],
    error_message: str | None = None,
):
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
                "log_tail": "\n".join(log_lines[-120:]),
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


def cleaner_name(cleaner: dict | None) -> str:
    if not cleaner:
        return "unknown cleaner"
    return " ".join(
        part for part in [cleaner.get("first_name"), cleaner.get("last_name")] if part
    ) or str(cleaner.get("id"))


def cleaner_is_active(cleaner: dict | None) -> bool:
    if not cleaner:
        return False

    if cleaner.get("active") is False:
        return False

    status = cleaner.get("status") or "active"

    # For now, temporarily_unavailable is treated as unavailable globally.
    # Date-specific availability is handled by cleaner_unavailability_periods.
    return status == "active"


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


def build_assignment_index(assignments: list[dict]) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = defaultdict(list)

    for assignment in assignments:
        if assignment.get("active") is False:
            continue

        property_id = assignment.get("property_id")
        if not property_id:
            continue

        index[str(property_id)].append(assignment)

    for property_id, rows in index.items():
        rows.sort(
            key=lambda row: (
                0 if row.get("role") == "primary" else 1,
                int(row.get("priority") or 99),
            )
        )

    return index


def build_weekly_index(weekly_rows: list[dict]) -> dict[tuple[str, int], dict]:
    index: dict[tuple[str, int], dict] = {}

    for row in weekly_rows:
        cleaner_id = row.get("cleaner_id")
        weekday = row.get("weekday")

        if cleaner_id and weekday:
            index[(str(cleaner_id), int(weekday))] = row

    return index


def build_unavailability_index(period_rows: list[dict]) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = defaultdict(list)

    for row in period_rows:
        cleaner_id = row.get("cleaner_id")

        if cleaner_id:
            index[str(cleaner_id)].append(row)

    return index


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


def candidate_rows_for_property(
    property_: dict,
    assignments_by_property: dict[str, list[dict]],
    cleaners_by_id: dict[str, dict],
) -> list[dict]:
    property_id = str(property_["id"])
    rows: list[dict] = []

    assignments = assignments_by_property.get(property_id, [])

    for assignment in assignments:
        cleaner_id = str(assignment.get("cleaner_id"))
        cleaner = cleaners_by_id.get(cleaner_id)

        if not cleaner:
            continue

        rows.append(
            {
                "cleaner": cleaner,
                "assignment": assignment,
                "role": assignment.get("role") or "backup",
                "priority": int(assignment.get("priority") or 99),
                "familiar": bool(assignment.get("familiar")),
                "travel_distance_km": assignment.get("travel_distance_km"),
                "source": "property_cleaner_assignments",
            }
        )

    # Fallback for older configuration.
    if not rows and property_.get("preferred_cleaner_id"):
        cleaner = cleaners_by_id.get(str(property_["preferred_cleaner_id"]))

        if cleaner:
            rows.append(
                {
                    "cleaner": cleaner,
                    "assignment": None,
                    "role": "primary",
                    "priority": 1,
                    "familiar": False,
                    "travel_distance_km": None,
                    "source": "properties.preferred_cleaner_id",
                }
            )

    return rows


def cleaner_availability_reason(
    cleaner: dict,
    scheduled_start_local: datetime,
    scheduled_end_local: datetime,
    weekly_index: dict[tuple[str, int], dict],
    unavailability_index: dict[str, list[dict]],
) -> str | None:
    cleaner_id = str(cleaner["id"])

    if not cleaner_is_active(cleaner):
        status = cleaner.get("status") or "inactive"
        return f"cleaner status is {status}"

    weekday = scheduled_start_local.isoweekday()
    weekly_row = weekly_index.get((cleaner_id, weekday))

    if weekly_row:
        if weekly_row.get("available") is False:
            return "weekly unavailable"

        start_time = parse_time(weekly_row.get("start_time"))
        end_time = parse_time(weekly_row.get("end_time"))

        mission_start_time = scheduled_start_local.time().replace(second=0, microsecond=0)
        mission_end_time = scheduled_end_local.time().replace(second=0, microsecond=0)

        if start_time and mission_start_time < start_time:
            return f"before weekly start time {start_time.strftime('%H:%M')}"

        if end_time and mission_end_time > end_time:
            return f"after weekly end time {end_time.strftime('%H:%M')}"

    mission_date = scheduled_start_local.date()

    for period in unavailability_index.get(cleaner_id, []):
        starts_on = parse_date(period.get("starts_on"))
        ends_on = parse_date(period.get("ends_on"))

        if not starts_on or not ends_on:
            continue

        if starts_on <= mission_date <= ends_on:
            reason = period.get("reason") or "temporary unavailability"
            return f"blocked {starts_on.isoformat()} to {ends_on.isoformat()} ({reason})"

    return None


def select_available_cleaner(
    property_: dict,
    profile: dict,
    reservation: dict,
    assignments_by_property: dict[str, list[dict]],
    cleaners_by_id: dict[str, dict],
    weekly_index: dict[tuple[str, int], dict],
    unavailability_index: dict[str, list[dict]],
) -> tuple[dict | None, dict | None, list[str], datetime, datetime]:
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

    rejection_reasons: list[str] = []

    for candidate in candidate_rows_for_property(
        property_,
        assignments_by_property,
        cleaners_by_id,
    ):
        cleaner = candidate["cleaner"]

        reason = cleaner_availability_reason(
            cleaner=cleaner,
            scheduled_start_local=scheduled_start_local,
            scheduled_end_local=scheduled_end_local,
            weekly_index=weekly_index,
            unavailability_index=unavailability_index,
        )

        if reason:
            rejection_reasons.append(
                f"{cleaner_name(cleaner)} ({candidate['role']}): {reason}"
            )
            continue

        return cleaner, candidate, rejection_reasons, scheduled_start_local, scheduled_end_local

    return None, None, rejection_reasons, scheduled_start_local, scheduled_end_local


def build_request_payload(
    reservation: dict,
    property_: dict,
    cleaner: dict,
    profile: dict,
    next_checkin_at: datetime | None,
    scheduled_start_local: datetime,
    scheduled_end_local: datetime,
    existing_request: dict | None,
    travel_distance_km: float | int | str | None = None,
) -> tuple[dict, dict]:
    checkout_at = parse_dt(reservation.get("checkout_at"))

    if not checkout_at:
        raise ValueError(f"Reservation {reservation['id']} has no checkout_at")

    scheduled_start_at = scheduled_start_local.astimezone(timezone.utc)
    scheduled_end_at = scheduled_end_local.astimezone(timezone.utc)

    urgent = False
    if next_checkin_at:
        urgent = (next_checkin_at - checkout_at) <= timedelta(hours=36)

    if travel_distance_km is None or travel_distance_km == "":
        distance_km = DEFAULT_CLEANER_DISTANCE_KM
    else:
        distance_km = float(travel_distance_km)

    included_radius = float(cleaner.get("included_radius_km") or 0)
    hourly_rate = float(cleaner.get("hourly_rate_eur") or 0)
    travel_rate = float(cleaner.get("travel_rate_per_km_eur") or 0)
    urgency_bonus_percent = float(cleaner.get("urgency_bonus_percent") or 15)

    estimated_hours = float(profile["estimated_hours"])
    billable_travel_km = max(0.0, distance_km - included_radius)

    cleaning_cost = estimated_hours * hourly_rate
    travel_cost = billable_travel_km * travel_rate

    subtotal = cleaning_cost + travel_cost
    urgency_bonus = subtotal * (urgency_bonus_percent / 100.0) if urgent else 0.0
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
        "urgency_bonus_percent": money(urgency_bonus_percent if urgent else 0),
        "urgency_bonus_eur": money(urgency_bonus),
        "total_cost_eur": money(total),
        "updated_at": now.isoformat(),
    }

    if not existing_request:
        payload.update(
            {
                "status": INITIAL_REQUEST_STATUS,
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
        "skipped_not_upcoming": 0,
        "skipped_missing_config": 0,
        "skipped_no_candidate_cleaner": 0,
        "skipped_no_available_cleaner": 0,
        "skipped_existing_locked": 0,
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
        assignments = load_rows(supabase, "property_cleaner_assignments")
        weekly_rows = load_rows(supabase, "cleaner_weekly_availability")
        period_rows = load_rows(supabase, "cleaner_unavailability_periods")

        assignments_by_property = build_assignment_index(assignments)
        weekly_index = build_weekly_index(weekly_rows)
        unavailability_index = build_unavailability_index(period_rows)

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
            source_booking_id = reservation.get("source_booking_id")
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
                        f"Cancelled cleaning request for reservation {source_booking_id}"
                    )

                continue

            if status != "confirmed":
                continue

            if existing_request and existing_request.get("status") in FINAL_OR_HUMAN_LOCKED_STATUSES:
                summary["skipped_existing_locked"] += 1
                continue

            property_id = str(reservation["property_id"])
            property_ = properties.get(property_id)

            if not property_:
                summary["skipped_missing_config"] += 1
                log(f"SKIP reservation {source_booking_id}: missing property")
                continue

            profile = get_profile_for_property(profiles, property_id)

            if not profile:
                summary["skipped_missing_config"] += 1
                log(
                    f"SKIP {property_.get('name')} reservation {source_booking_id}: "
                    "missing cleaning profile"
                )
                continue

            candidate_rows = candidate_rows_for_property(
                property_,
                assignments_by_property,
                cleaners,
            )

            if not candidate_rows:
                summary["skipped_no_candidate_cleaner"] += 1
                log(
                    f"SKIP {property_.get('name')} reservation {source_booking_id}: "
                    "no primary or backup cleaner configured"
                )
                continue

            cleaner, candidate, rejection_reasons, scheduled_start_local, scheduled_end_local = (
                select_available_cleaner(
                    property_=property_,
                    profile=profile,
                    reservation=reservation,
                    assignments_by_property=assignments_by_property,
                    cleaners_by_id=cleaners,
                    weekly_index=weekly_index,
                    unavailability_index=unavailability_index,
                )
            )

            if not cleaner or not candidate:
                summary["skipped_no_available_cleaner"] += 1
                log(
                    f"SKIP {property_.get('name')} reservation {source_booking_id}: "
                    "no available cleaner"
                )

                for reason in rejection_reasons:
                    log(f"  - {reason}")

                continue

            next_checkin_at = next_checkins.get(reservation_id)

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
                scheduled_start_local=scheduled_start_local,
                scheduled_end_local=scheduled_end_local,
                existing_request=existing_request,
                travel_distance_km=candidate.get("travel_distance_km"),
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

            assignment_description = (
                f"{candidate['role']}"
                f", priority {candidate['priority']}"
                f", familiar={candidate['familiar']}"
                f", distance={candidate.get('travel_distance_km') if candidate.get('travel_distance_km') is not None else DEFAULT_CLEANER_DISTANCE_KM}km"
            )

            log(
                f"{action}: {property_.get('name')} · "
                f"{reservation.get('guest_name') or source_booking_id} · "
                f"{meta['scheduled_start_local'].strftime('%d/%m/%Y %H:%M')} · "
                f"{cleaner_name(cleaner)} ({assignment_description}) · "
                f"{money(meta['total']):.2f} € · {link}"
            )

        log("")
        log(
            "Summary: "
            f"created={summary['created']} "
            f"updated={summary['updated']} "
            f"cancelled={summary['cancelled']} "
            f"missing_config={summary['skipped_missing_config']} "
            f"no_candidate={summary['skipped_no_candidate_cleaner']} "
            f"no_available={summary['skipped_no_available_cleaner']} "
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
