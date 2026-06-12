# src/rental_intel/cleaning/models.py

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class CleanerStatus(str, Enum):
    ACTIVE = "active"
    TEMPORARILY_UNAVAILABLE = "temporarily_unavailable"
    INACTIVE = "inactive"


class CleaningRequestStatus(str, Enum):
    CREATED = "created"
    SENT = "sent"
    ACCEPTED = "accepted"
    REFUSED = "refused"
    EXPIRED = "expired"
    REASSIGNED = "reassigned"
    IN_PROGRESS = "in_progress"
    REPORT_SUBMITTED = "report_submitted"
    PROBLEM_REPORTED = "problem_reported"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class UnavailabilityBlock:
    start_at: datetime
    end_at: datetime
    reason: str = ""


@dataclass
class Cleaner:
    id: str
    name: str
    phone: str
    hourly_rate_eur: float

    home_location_label: str
    included_radius_km: float
    travel_rate_per_km_eur: float

    status: CleanerStatus = CleanerStatus.ACTIVE

    # 0 = Monday, 6 = Sunday
    recurring_unavailable_weekdays: set[int] = field(default_factory=set)

    temporary_unavailability: list[UnavailabilityBlock] = field(default_factory=list)

    payment_method: str | None = None
    payment_details: str | None = None


@dataclass
class CleaningProfile:
    code: str
    label: str
    estimated_hours: float
    description: str = ""

    # For V1 this can simply be text.
    # Later this becomes structured checklist blocks.
    extra_tasks: list[str] = field(default_factory=list)

    required_photo_labels: list[str] = field(default_factory=list)


@dataclass
class Property:
    id: str
    name: str
    address: str

    cleaning_profiles: dict[str, CleaningProfile]
    default_cleaning_profile_code: str

    preferred_cleaner_id: str | None = None
    backup_cleaner_ids: list[str] = field(default_factory=list)

    access_notes: str | None = None
    sensitive_access_notes: str | None = None

    def get_cleaning_profile(self, profile_code: str | None = None) -> CleaningProfile:
        code = profile_code or self.default_cleaning_profile_code

        if code not in self.cleaning_profiles:
            raise ValueError(
                f"Cleaning profile '{code}' not configured for property '{self.name}'"
            )

        return self.cleaning_profiles[code]


@dataclass
class Reservation:
    id: str
    property_id: str

    guest_name: str | None
    checkout_at: datetime
    next_checkin_at: datetime | None

    number_of_guests: int
    nights: int

    linen_required: bool = True
    laundry_required: bool = True


@dataclass
class CompensationBreakdown:
    estimated_hours: float
    hourly_rate_eur: float

    cleaning_cost_eur: float
    travel_distance_km: float
    billable_travel_km: float
    travel_cost_eur: float

    urgency_bonus_percent: float
    urgency_bonus_eur: float

    total_cost_eur: float


@dataclass
class CleaningRequest:
    id: str
    property_id: str
    reservation_id: str | None

    cleaning_profile_code: str

    scheduled_start_at: datetime
    scheduled_end_at: datetime

    number_of_guests: int
    linen_required: bool
    laundry_required: bool

    urgent: bool

    status: CleaningRequestStatus = CleaningRequestStatus.CREATED

    assigned_cleaner_id: str | None = None
    response_deadline_at: datetime | None = None

    compensation: CompensationBreakdown | None = None

    refusal_reason: str | None = None
    accepted_at: datetime | None = None
    refused_at: datetime | None = None