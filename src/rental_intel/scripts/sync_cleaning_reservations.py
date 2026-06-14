from __future__ import annotations

from datetime import datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

from rental_intel.cleaning.db import get_supabase_client


CSV_PATH = Path("outputs/processed/normalized_reservations.csv")
PARIS = ZoneInfo("Europe/Paris")


def clean_value(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    return value


def text_value(value) -> str | None:
    value = clean_value(value)
    if value is None:
        return None
    return str(value).strip() or None


def int_value(value) -> int:
    value = clean_value(value)
    if value is None or value == "":
        return 0
    return int(float(value))


def date_at(value, hour: int, minute: int = 0) -> str | None:
    value = text_value(value)
    if not value:
        return None

    date_value = pd.to_datetime(value).date()
    dt = datetime.combine(date_value, time(hour, minute), tzinfo=PARIS)
    return dt.isoformat()


def guest_name(row: pd.Series) -> str | None:
    first = text_value(row.get("guest_first_name"))
    last = text_value(row.get("guest_last_name"))
    name = " ".join(part for part in [first, last] if part).strip()
    return name or None


def normalize_status(status: str | None) -> str:
    status = (status or "").lower().strip()

    if status in {"cancelled", "canceled"}:
        return "cancelled"

    if status in {"new", "confirmed", "modified"}:
        return "confirmed"

    return status or "unknown"


def load_property_links(supabase) -> dict[tuple[str, str, str], str]:
    result = (
        supabase.table("property_source_links")
        .select("property_id,source_system,source_property_id,source_room_id,active")
        .eq("active", True)
        .execute()
    )

    links: dict[tuple[str, str, str], str] = {}

    for row in result.data or []:
        key = (
            str(row["source_system"]),
            str(row["source_property_id"]),
            str(row.get("source_room_id") or ""),
        )
        links[key] = row["property_id"]

    return links


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Missing {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)
    supabase = get_supabase_client()
    links = load_property_links(supabase)

    upserted = 0
    unmatched: list[dict[str, str | None]] = []

    for _, row in df.iterrows():
        source_system = text_value(row.get("source_system")) or "unknown"
        source_property_id = text_value(row.get("source_property_id")) or ""
        source_room_id = text_value(row.get("source_room_id")) or ""
        source_booking_id = text_value(row.get("source_booking_id"))

        if not source_booking_id:
            continue

        property_id = links.get((source_system, source_property_id, source_room_id))

        if not property_id:
            unmatched.append(
                {
                    "source_system": source_system,
                    "source_property_id": source_property_id,
                    "source_room_id": source_room_id,
                    "listing_id": text_value(row.get("listing_id")),
                    "listing_name": text_value(row.get("listing_name")),
                }
            )
            continue

        num_adult = int_value(row.get("num_adult"))
        num_child = int_value(row.get("num_child"))

        payload = {
            "property_id": property_id,
            "source_system": source_system,
            "source_booking_id": source_booking_id,
            "guest_name": guest_name(row),
            "checkin_at": date_at(row.get("arrival"), 16, 0),
            "checkout_at": date_at(row.get("departure"), 10, 0),
            "number_of_guests": num_adult + num_child,
            "nights": int_value(row.get("nights")),
            "status": normalize_status(text_value(row.get("status"))),
            "linen_required": True,
            "laundry_required": True,
        }

        supabase.table("reservations").upsert(
            payload,
            on_conflict="property_id,source_system,source_booking_id",
        ).execute()

        upserted += 1

    print(f"Reservations upserted: {upserted}")

    if unmatched:
        print("\nUnmatched source links:")
        seen = set()
        for item in unmatched:
            key = (
                item["source_system"],
                item["source_property_id"],
                item["source_room_id"],
                item["listing_id"],
            )
            if key in seen:
                continue
            seen.add(key)

            print(
                "- "
                f"{item['source_system']} "
                f"property={item['source_property_id']} "
                f"room={item['source_room_id']} "
                f"listing_id={item['listing_id']} "
                f"name={item['listing_name']}"
            )

        raise SystemExit("Some reservations could not be mapped.")


if __name__ == "__main__":
    main()
