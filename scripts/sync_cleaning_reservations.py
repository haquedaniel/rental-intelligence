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



def timestamp_value(value) -> str | None:
    value = text_value(value)
    if not value:
        return None
    try:
        return pd.to_datetime(value, utc=True).isoformat()
    except Exception:
        return value


def nullable_int_value(value) -> int | None:
    value = clean_value(value)
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except Exception:
        return None

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
            "source_property_id": source_property_id or None,
            "source_room_id": source_room_id or None,

            "guest_name": guest_name(row),
            "guest_first_name": text_value(row.get("guest_first_name")),
            "guest_last_name": text_value(row.get("guest_last_name")),
            "guest_email": text_value(row.get("guest_email")),
            "guest_phone": text_value(row.get("guest_phone")),
            "guest_mobile": text_value(row.get("guest_mobile")),
            "guest_city": text_value(row.get("guest_city")),
            "guest_postcode": text_value(row.get("guest_postcode")),
            "guest_country": text_value(row.get("guest_country")),
            "guest_language": text_value(row.get("guest_language")),

            "channel": text_value(row.get("channel")),
            "api_source": text_value(row.get("api_source")),
            "api_reference": text_value(row.get("api_reference")),
            "referer": text_value(row.get("referer")),

            "checkin_at": date_at(row.get("arrival"), 16, 0),
            "checkout_at": date_at(row.get("departure"), 10, 0),
            "checkin_time_text": text_value(row.get("checkin_time_text")),
            "checkout_time_text": text_value(row.get("checkout_time_text")),

            "number_of_guests": num_adult + num_child,
            "num_adult": num_adult,
            "num_child": num_child,
            "nights": int_value(row.get("nights")),
            "status": normalize_status(text_value(row.get("status"))),

            "guest_comments": text_value(row.get("guest_comments")),
            "internal_notes": text_value(row.get("internal_notes")),
            "special_requests": text_value(row.get("special_requests")),
            "pets_count": nullable_int_value(row.get("pets_count")),
            "pets_notes": text_value(row.get("pets_notes")),

            "booking_time": timestamp_value(row.get("booking_time")),
            "modified_time": timestamp_value(row.get("modified_time")),
            "cancel_time": timestamp_value(row.get("cancel_time")),

            "linen_required": True,
            "laundry_required": True,
            "raw_payload": row.to_dict(),
            "synced_at": datetime.now(tz=ZoneInfo("UTC")).isoformat(),
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
