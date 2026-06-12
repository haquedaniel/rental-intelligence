# src/rental_intel/cleaning/lifecycle.py

from datetime import datetime

from rental_intel.cleaning.models import CleaningRequest, CleaningRequestStatus


def accept_request(
    request: CleaningRequest,
    cleaner_id: str,
    now: datetime,
) -> CleaningRequest:
    if request.status != CleaningRequestStatus.SENT:
        raise ValueError(f"Cannot accept request with status {request.status}")

    if request.assigned_cleaner_id != cleaner_id:
        raise ValueError("This request is not assigned to this cleaner")

    request.status = CleaningRequestStatus.ACCEPTED
    request.accepted_at = now

    return request


def refuse_request(
    request: CleaningRequest,
    cleaner_id: str,
    reason: str,
    now: datetime,
) -> CleaningRequest:
    if request.status != CleaningRequestStatus.SENT:
        raise ValueError(f"Cannot refuse request with status {request.status}")

    if request.assigned_cleaner_id != cleaner_id:
        raise ValueError("This request is not assigned to this cleaner")

    if not reason or not reason.strip():
        raise ValueError("Refusal reason is mandatory")

    request.status = CleaningRequestStatus.REFUSED
    request.refusal_reason = reason.strip()
    request.refused_at = now

    return request