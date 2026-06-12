from __future__ import annotations
import secrets

from datetime import datetime, timedelta, timezone, time
from zoneinfo import ZoneInfo

from rental_intel.cleaning.db import get_supabase_client


def parse_dt(value: str | None) -> datetime | None:
    if value is None:
        return None

    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def money(value: float) -> float:
    return round(float(value), 2)


def main() -> None:
    supabase = get_supabase_client()

    reservation_result = (
        supabase.table("reservations")
        .select("*")
        .eq("source_booking_id", "demo-res-001")
        .single()
        .execute()
    )

    reservation = reservation_result.data

    property_result = (
        supabase.table("properties")
        .select("*")
        .eq("id", reservation["property_id"])
        .single()
        .execute()
    )

    property_ = property_result.data

    cleaner_result = (
        supabase.table("cleaners")
        .select("*")
        .eq("id", property_["preferred_cleaner_id"])
        .single()
        .execute()
    )

    cleaner = cleaner_result.data

    profile_result = (
        supabase.table("property_cleaning_profiles")
        .select("*")
        .eq("property_id", property_["id"])
        .eq("code", "light")
        .single()
        .execute()
    )

    profile = profile_result.data

    checkout_at = parse_dt(reservation["checkout_at"])
    next_checkin_at = parse_dt(reservation["next_checkin_at"])

    property_timezone = ZoneInfo("Europe/Paris")

    checkout_local = checkout_at.astimezone(property_timezone)

    scheduled_start_local = datetime.combine(
        checkout_local.date(),
        time(hour=14, minute=0),
        tzinfo=property_timezone,
    )

    scheduled_end_local = scheduled_start_local + timedelta(
        hours=float(profile["estimated_hours"])
    )

    scheduled_start_at = scheduled_start_local.astimezone(timezone.utc)
    scheduled_end_at = scheduled_end_local.astimezone(timezone.utc)

    urgent = False
    if next_checkin_at:
        urgent = (next_checkin_at - checkout_at) <= timedelta(hours=36)

    distance_km = 7.0
    billable_travel_km = max(
        0,
        distance_km - float(cleaner["included_radius_km"]),
    )

    cleaning_cost = float(profile["estimated_hours"]) * float(cleaner["hourly_rate_eur"])
    travel_cost = billable_travel_km * float(cleaner["travel_rate_per_km_eur"])

    subtotal = cleaning_cost + travel_cost
    urgency_bonus_percent = 15.0 if urgent else 0.0
    urgency_bonus = subtotal * (urgency_bonus_percent / 100)

    total = subtotal + urgency_bonus

    response_deadline_at = datetime.now(timezone.utc) + timedelta(
        hours=3 if urgent else 12
    )

    payload = {
        "property_id": property_["id"],
        "reservation_id": reservation["id"],
        "cleaning_profile_id": profile["id"],
        "assigned_cleaner_id": cleaner["id"],
        "scheduled_start_at": scheduled_start_at.isoformat(),
        "scheduled_end_at": scheduled_end_at.isoformat(),
        "status": "sent",
        "urgent": urgent,
        "response_deadline_at": response_deadline_at.isoformat(),
        "number_of_guests": reservation["number_of_guests"],
        "linen_required": reservation["linen_required"],
        "laundry_required": reservation["laundry_required"],
        "estimated_hours": float(profile["estimated_hours"]),
        "cleaning_cost_eur": money(cleaning_cost),
        "travel_distance_km": money(distance_km),
        "billable_travel_km": money(billable_travel_km),
        "travel_cost_eur": money(travel_cost),
        "urgency_bonus_percent": money(urgency_bonus_percent),
        "urgency_bonus_eur": money(urgency_bonus),
        "total_cost_eur": money(total),
        "public_token": secrets.token_urlsafe(24),
        "public_token_expires_at": (
            datetime.now(timezone.utc) + timedelta(days=30)
        ).isoformat(),
    }

    result = supabase.table("cleaning_requests").insert(payload).execute()

    request = result.data[0]

    print(f"Cleaner link: http://localhost:3000/mission/{request['public_token']}")

    print()
    print("Cleaning request created")
    print("-" * 50)
    print(f"Property: {property_['name']}")
    print(f"Cleaner: {cleaner['first_name']}")
    print(f"Profile: {profile['label']}")
    print(f"Urgent: {urgent}")
    print(f"Total: {request['total_cost_eur']} €")
    print(f"Status: {request['status']}")
    print()

    cleaner_link = f"http://localhost:3000/mission/{request['public_token']}"

    print()
    print("WhatsApp message")
    print("-" * 50)
    print(f"Bonjour {cleaner['first_name']} 👋")
    print()
    print("Nouvelle mission proposée :")
    print()
    print(f"🏠 {property_['name']}")
    print(f"📅 {scheduled_start_local.strftime('%A %d/%m à %Hh%M')}")
    print(f"🧹 {profile['label']} — {float(profile['estimated_hours']):.1f}h")
    print(f"💶 Total proposé : {money(total):.2f} €")
    print()
    print("Merci de répondre ici :")
    print(cleaner_link)
    print()


if __name__ == "__main__":
    main()