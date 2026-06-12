# src/rental_intel/cleaning/pricing.py

from rental_intel.cleaning.models import (
    Cleaner,
    CleaningProfile,
    CompensationBreakdown,
)


def round_money(value: float) -> float:
    return round(value, 2)


def calculate_billable_travel_km(
    distance_km: float,
    included_radius_km: float,
) -> float:
    return max(0.0, distance_km - included_radius_km)


def calculate_compensation(
    cleaner: Cleaner,
    cleaning_profile: CleaningProfile,
    distance_km: float,
    urgent: bool,
    urgency_bonus_percent: float = 15.0,
) -> CompensationBreakdown:
    cleaning_cost = cleaning_profile.estimated_hours * cleaner.hourly_rate_eur

    billable_travel_km = calculate_billable_travel_km(
        distance_km=distance_km,
        included_radius_km=cleaner.included_radius_km,
    )

    travel_cost = billable_travel_km * cleaner.travel_rate_per_km_eur

    subtotal = cleaning_cost + travel_cost

    urgency_bonus = subtotal * (urgency_bonus_percent / 100.0) if urgent else 0.0

    total = subtotal + urgency_bonus

    return CompensationBreakdown(
        estimated_hours=cleaning_profile.estimated_hours,
        hourly_rate_eur=cleaner.hourly_rate_eur,
        cleaning_cost_eur=round_money(cleaning_cost),
        travel_distance_km=round(distance_km, 1),
        billable_travel_km=round(billable_travel_km, 1),
        travel_cost_eur=round_money(travel_cost),
        urgency_bonus_percent=urgency_bonus_percent if urgent else 0.0,
        urgency_bonus_eur=round_money(urgency_bonus),
        total_cost_eur=round_money(total),
    )