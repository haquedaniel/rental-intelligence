# src/rental_intel/cleaning/demo_mvp.py

from datetime import datetime

from rental_intel.cleaning.assignment import (
    assign_to_first_available_cleaner,
    create_cleaning_request_from_reservation,
)
from rental_intel.cleaning.lifecycle import accept_request
from rental_intel.cleaning.models import (
    Cleaner,
    CleaningProfile,
    Property,
    Reservation,
    UnavailabilityBlock,
)


def print_offer(decision) -> None:
    request = decision.request
    cleaner = decision.selected_cleaner
    compensation = request.compensation

    print()
    print("=" * 60)
    print("MISSION OFFER")
    print("=" * 60)

    for skipped in decision.skipped:
        print(f"Skipped: {skipped}")

    for note in decision.notes:
        print(f"Note: {note}")

    if cleaner is None or compensation is None:
        print("No mission offer generated.")
        print("=" * 60)
        return

    print()
    print(f"Cleaner: {cleaner.name}")
    print(f"Status: {request.status.value}")
    print(f"Cleaning profile: {request.cleaning_profile_code}")
    print(f"Scheduled: {request.scheduled_start_at} → {request.scheduled_end_at}")
    print(f"Urgent: {'yes' if request.urgent else 'no'}")
    print(f"Response deadline: {request.response_deadline_at}")
    print()
    print("Compensation")
    print("-" * 60)
    print(f"Estimated hours: {compensation.estimated_hours:.2f}h")
    print(f"Hourly rate: {compensation.hourly_rate_eur:.2f} €/h")
    print(f"Cleaning cost: {compensation.cleaning_cost_eur:.2f} €")
    print(
        f"Travel: {compensation.travel_distance_km:.1f} km "
        f"({compensation.billable_travel_km:.1f} km billable)"
    )
    print(f"Travel cost: {compensation.travel_cost_eur:.2f} €")
    print(f"Urgency bonus: {compensation.urgency_bonus_eur:.2f} €")
    print("-" * 60)
    print(f"TOTAL: {compensation.total_cost_eur:.2f} €")
    print("=" * 60)
    print()


def main() -> None:
    # Property-specific cleaning profiles.
    # These are NOT global. La Peskerezh can define these differently
    # from Appartement 5.
    light_clean = CleaningProfile(
        code="light",
        label="Ménage léger",
        estimated_hours=2.0,
        description="Short stay / low guest count / lighter reset",
        required_photo_labels=["Cuisine", "Salle de bain", "Chambre principale"],
    )

    standard_clean = CleaningProfile(
        code="standard",
        label="Ménage standard",
        estimated_hours=3.0,
        description="Default guest turnover",
        required_photo_labels=["Cuisine", "Salle de bain", "Chambre principale"],
    )

    deep_windows_clean = CleaningProfile(
        code="deep_windows",
        label="Ménage approfondi - vitres",
        estimated_hours=4.0,
        description="Standard clean plus window focus area",
        extra_tasks=[
            "Nettoyer les vitres intérieures",
            "Nettoyer les encadrements",
            "Vérifier les traces de sel / embruns",
        ],
        required_photo_labels=[
            "Cuisine",
            "Salle de bain",
            "Chambre principale",
            "Vitres principales",
        ],
    )

    property_ = Property(
        id="peskerezh",
        name="La Peskerezh",
        address="Plouhinec",
        cleaning_profiles={
            light_clean.code: light_clean,
            standard_clean.code: standard_clean,
            deep_windows_clean.code: deep_windows_clean,
        },
        default_cleaning_profile_code="standard",
        preferred_cleaner_id="marie",
        backup_cleaner_ids=["sophie"],
        access_notes="Boîte à clés près de la porte d'entrée.",
        sensitive_access_notes="Code boîte à clés: XXXX",
    )

    marie = Cleaner(
        id="marie",
        name="Marie",
        phone="+33600000000",
        hourly_rate_eur=16.0,
        home_location_label="Pont-Croix",
        included_radius_km=10.0,
        travel_rate_per_km_eur=0.50,
        temporary_unavailability=[
            UnavailabilityBlock(
                start_at=datetime(2026, 7, 10, 0, 0),
                end_at=datetime(2026, 7, 12, 23, 59),
                reason="Vacances",
            )
        ],
    )

    sophie = Cleaner(
        id="sophie",
        name="Sophie",
        phone="+33611111111",
        hourly_rate_eur=18.0,
        home_location_label="Douarnenez",
        included_radius_km=8.0,
        travel_rate_per_km_eur=0.60,
    )

    cleaners_by_id = {
        marie.id: marie,
        sophie.id: sophie,
    }

    # In V1, distance can be manually stored or pre-calculated.
    # Later this can come from geocoding / mapping APIs.
    distance_by_cleaner_id_km = {
        "marie": 7.0,
        "sophie": 22.0,
    }

    reservation = Reservation(
        id="res_001",
        property_id="peskerezh",
        guest_name="Example Guest",
        checkout_at=datetime(2026, 7, 10, 10, 0),
        next_checkin_at=datetime(2026, 7, 11, 16, 0),
        number_of_guests=2,
        nights=2,
        linen_required=True,
        laundry_required=True,
    )

    # For this example, owner/admin chooses "light".
    # Later the cockpit may suggest it based on guests/nights.
    request = create_cleaning_request_from_reservation(
        reservation=reservation,
        property_=property_,
        cleaning_profile_code="light",
    )

    existing_requests = []

    decision = assign_to_first_available_cleaner(
        request=request,
        property_=property_,
        cleaners_by_id=cleaners_by_id,
        distance_by_cleaner_id_km=distance_by_cleaner_id_km,
        existing_requests=existing_requests,
        now=datetime(2026, 7, 9, 9, 0),
    )

    print_offer(decision)

    if decision.selected_cleaner is not None:
        accepted_request = accept_request(
            request=decision.request,
            cleaner_id=decision.selected_cleaner.id,
            now=datetime(2026, 7, 9, 9, 10),
        )

        print(f"Cleaner accepted. New status: {accepted_request.status.value}")


if __name__ == "__main__":
    main()