# src/rental_intel/cleaning/assignment.py

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from uuid import uuid4

from rental_intel.cleaning.models import (
    Cleaner,
    CleanerStatus,
    CleaningRequest,
    CleaningRequestStatus,
    Property,
    Reservation,
)
from rental_intel.cleaning.pricing import calculate_compensation


@dataclass
class AssignmentDecision:
    request: CleaningRequest
    selected_cleaner: Cleaner | None
    skipped: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def overlaps(
    start_a: datetime,
    end_a: datetime,
    start_b: datetime,
    end_b: datetime,
) -> bool:
    return start_a < end_b and start_b < end_a


def calculate_urgent_flag(
    checkout_at: datetime,
    next_checkin_at: datetime | None,
    urgency_threshold_hours: int = 36,
) -> bool:
    if next_checkin_at is None:
        return False

    gap = next_checkin_at - checkout_at
    return gap <= timedelta(hours=urgency_threshold_hours)


def create_cleaning_request_from_reservation(
    reservation: Reservation,
    property_: Property,
    cleaning_profile_code: str | None = None,
) -> CleaningRequest:
    profile = property_.get_cleaning_profile(cleaning_profile_code)

    scheduled_start_at = datetime.combine(
        reservation.checkout_at.date(),
        time(hour=14, minute=0),
    )

    scheduled_end_at = scheduled_start_at + timedelta(hours=profile.estimated_hours)

    urgent = calculate_urgent_flag(
        checkout_at=reservation.checkout_at,
        next_checkin_at=reservation.next_checkin_at,
    )

    return CleaningRequest(
        id=f"clean_{uuid4().hex[:8]}",
        property_id=property_.id,
        reservation_id=reservation.id,
        cleaning_profile_code=profile.code,
        scheduled_start_at=scheduled_start_at,
        scheduled_end_at=scheduled_end_at,
        number_of_guests=reservation.number_of_guests,
        linen_required=reservation.linen_required,
        laundry_required=reservation.laundry_required,
        urgent=urgent,
    )


def cleaner_availability_reason(
    cleaner: Cleaner,
    mission_start_at: datetime,
    mission_end_at: datetime,
    existing_requests: list[CleaningRequest],
) -> tuple[bool, str]:
    if cleaner.status != CleanerStatus.ACTIVE:
        return False, f"{cleaner.name} is not active"

    if mission_start_at.weekday() in cleaner.recurring_unavailable_weekdays:
        return False, f"{cleaner.name} is unavailable on this weekday"

    for block in cleaner.temporary_unavailability:
        if overlaps(
            mission_start_at,
            mission_end_at,
            block.start_at,
            block.end_at,
        ):
            return False, f"{cleaner.name} unavailable: {block.reason}"

    for request in existing_requests:
        if request.assigned_cleaner_id != cleaner.id:
            continue

        if request.status not in {
            CleaningRequestStatus.ACCEPTED,
            CleaningRequestStatus.IN_PROGRESS,
        }:
            continue

        if overlaps(
            mission_start_at,
            mission_end_at,
            request.scheduled_start_at,
            request.scheduled_end_at,
        ):
            return False, f"{cleaner.name} already has an accepted mission"

    return True, "available"


def get_candidate_cleaner_ids(property_: Property) -> list[str]:
    candidate_ids: list[str] = []

    if property_.preferred_cleaner_id:
        candidate_ids.append(property_.preferred_cleaner_id)

    candidate_ids.extend(property_.backup_cleaner_ids)

    # Remove duplicates while preserving order
    return list(dict.fromkeys(candidate_ids))


def assign_to_first_available_cleaner(
    request: CleaningRequest,
    property_: Property,
    cleaners_by_id: dict[str, Cleaner],
    distance_by_cleaner_id_km: dict[str, float],
    existing_requests: list[CleaningRequest],
    now: datetime,
) -> AssignmentDecision:
    skipped: list[str] = []
    notes: list[str] = []

    candidate_ids = get_candidate_cleaner_ids(property_)

    if not candidate_ids:
        notes.append("No preferred or backup cleaners configured for property.")
        return AssignmentDecision(
            request=request,
            selected_cleaner=None,
            skipped=skipped,
            notes=notes,
        )

    for cleaner_id in candidate_ids:
        cleaner = cleaners_by_id.get(cleaner_id)

        if cleaner is None:
            skipped.append(f"Cleaner id '{cleaner_id}' not found")
            continue

        available, reason = cleaner_availability_reason(
            cleaner=cleaner,
            mission_start_at=request.scheduled_start_at,
            mission_end_at=request.scheduled_end_at,
            existing_requests=existing_requests,
        )

        if not available:
            skipped.append(reason)
            continue

        distance_km = distance_by_cleaner_id_km.get(cleaner.id)

        if distance_km is None:
            skipped.append(f"No distance available for {cleaner.name}")
            continue

        profile = property_.get_cleaning_profile(request.cleaning_profile_code)

        request.assigned_cleaner_id = cleaner.id
        request.status = CleaningRequestStatus.SENT
        request.response_deadline_at = now + timedelta(hours=3 if request.urgent else 12)
        request.compensation = calculate_compensation(
            cleaner=cleaner,
            cleaning_profile=profile,
            distance_km=distance_km,
            urgent=request.urgent,
        )

        notes.append(f"Mission offered to {cleaner.name}")

        return AssignmentDecision(
            request=request,
            selected_cleaner=cleaner,
            skipped=skipped,
            notes=notes,
        )

    notes.append("No available cleaner found.")

    return AssignmentDecision(
        request=request,
        selected_cleaner=None,
        skipped=skipped,
        notes=notes,
    )