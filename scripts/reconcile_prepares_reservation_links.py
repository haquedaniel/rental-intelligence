#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from rental_intel.cleaning.db import get_supabase_client


SAFE_TO_RELINK = {"created", "sent", "pending", "proposed", "accepted"}
LOCKED_STATUSES = {"completed", "report_submitted", "problem_reported", "cancelled", "refused"}


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def date_key(value: Optional[str]) -> Optional[str]:
    parsed = parse_iso(value)
    if not parsed:
        return None
    return parsed.astimezone(timezone.utc).date().isoformat()


def mission_date_key(request: Dict[str, Any]) -> Optional[str]:
    for field in ("ready_by_at", "work_window_start_at", "scheduled_start_at", "scheduled_end_at", "created_at"):
        key = date_key(request.get(field))
        if key:
            return key
    return None


def active_reservation(row: Dict[str, Any]) -> bool:
    return str(row.get("status") or "").lower() not in {"cancelled", "canceled"}


def find_prepared_reservation(
    request: Dict[str, Any],
    reservations_by_property: Dict[str, List[Dict[str, Any]]],
) -> Optional[Dict[str, Any]]:
    property_id = request.get("property_id")
    if not property_id:
        return None

    key = mission_date_key(request)
    if not key:
        return None

    for reservation in reservations_by_property.get(str(property_id), []):
        checkin_key = date_key(reservation.get("checkin_at"))
        if checkin_key and checkin_key >= key:
            return reservation

    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Materialise cleaning_requests.prepares_reservation_id.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--property-id")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    supabase = get_supabase_client()

    reservations_query = (
        supabase.table("reservations")
        .select("id,property_id,status,guest_name,checkin_at,checkout_at,cleaner_preparation_note")
        .order("checkin_at", desc=False)
    )
    requests_query = (
        supabase.table("cleaning_requests")
        .select(
            "id,property_id,status,schedule_status,reservation_id,prepares_reservation_id,"
            "ready_by_at,work_window_start_at,scheduled_start_at,scheduled_end_at,created_at"
        )
        .order("scheduled_start_at", desc=False)
    )

    if args.property_id:
        reservations_query = reservations_query.eq("property_id", args.property_id)
        requests_query = requests_query.eq("property_id", args.property_id)

    if args.limit:
        requests_query = requests_query.limit(args.limit)

    reservations = reservations_query.execute().data or []
    requests = requests_query.execute().data or []

    reservations_by_property: Dict[str, List[Dict[str, Any]]] = {}
    for reservation in reservations:
        if not active_reservation(reservation):
            continue
        property_id = reservation.get("property_id")
        if property_id:
            reservations_by_property.setdefault(str(property_id), []).append(reservation)

    updated = 0
    warnings = 0

    for request in requests:
        request_id = request.get("id")
        current = request.get("prepares_reservation_id")
        status = str(request.get("status") or "").lower()

        target = find_prepared_reservation(request, reservations_by_property)
        target_id = target.get("id") if target else None

        if current == target_id:
            continue

        if status in LOCKED_STATUSES or status not in SAFE_TO_RELINK:
            warnings += 1
            print("WARN not relinked:", request_id, "status=", status, "current=", current, "target=", target_id)
            continue

        print("LINK", request_id, "status=", status, "current=", current, "target=", target_id, "guest=", target.get("guest_name") if target else None)

        if not args.dry_run:
            supabase.table("cleaning_requests").update(
                {
                    "prepares_reservation_id": target_id,
                    "prepares_reservation_linked_at": datetime.now(timezone.utc).isoformat(),
                    "prepares_reservation_linked_by": "reconcile_prepares_reservation_links",
                }
            ).eq("id", request_id).execute()

        updated += 1

    print()
    print(f"Updated links: {updated}{' (dry run)' if args.dry_run else ''}")
    print(f"Warnings/manual review: {warnings}")


if __name__ == "__main__":
    main()
