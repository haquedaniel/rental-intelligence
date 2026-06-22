from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()


DEFAULT_CSV = Path("outputs/processed/normalized_reservations.csv")


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def field(row: dict[str, Any], candidates: list[str]) -> str | None:
    lower_map = {key.lower(): key for key in row.keys()}

    for candidate in candidates:
      key = lower_map.get(candidate.lower())
      if key is not None:
          value = clean(row.get(key))
          if value is not None:
              return value

    return None


def number(row: dict[str, Any], candidates: list[str]) -> float | None:
    value = field(row, candidates)
    if value is None:
        return None

    try:
        return float(str(value).replace(",", "."))
    except Exception:
        return None


def integer(row: dict[str, Any], candidates: list[str]) -> int | None:
    value = number(row, candidates)
    if value is None:
        return None
    return int(value)


def date_value(row: dict[str, Any], candidates: list[str]) -> str | None:
    value = field(row, candidates)
    if not value:
        return None
    return value[:10]


def payload_from_row(row: dict[str, Any]) -> dict[str, Any]:
    source_system = field(row, ["source_system", "source", "platform"]) or "unknown"
    source_booking_id = field(row, ["source_booking_id", "booking_id", "reservation_id", "id"])

    if not source_booking_id:
        return {}

    nights = integer(row, ["nights", "night_count"])
    gross = number(row, [
        "gross_booking_value_eur",
        "gross_booking_value",
        "booking_value_eur",
        "total_booking_value_eur",
        "total_price_eur",
        "total_eur",
        "total",
    ])

    accommodation = number(row, [
        "accommodation_revenue_eur",
        "accommodation_revenue",
        "rental_revenue_eur",
        "room_revenue_eur",
        "rent_eur",
        "lodging_revenue_eur",
    ])

    host_payout = number(row, [
        "host_payout_eur",
        "host_payout",
        "owner_payout_eur",
        "payout_eur",
        "net_payout_eur",
    ])

    cleaning_fee = number(row, [
        "cleaning_fee_charged_eur",
        "cleaning_fee_charged",
        "cleaning_fee_eur",
        "cleaning_fee",
        "cleaning_revenue_eur",
    ])

    adr = number(row, ["adr_eur", "adr", "average_daily_rate_eur", "daily_rate_eur"])
    if adr is None and accommodation is not None and nights:
        adr = accommodation / nights

    return {
        "source_system": source_system,
        "source_booking_id": source_booking_id,

        "client_id": field(row, ["client_id"]),
        "portfolio_id": field(row, ["portfolio_id"]),
        "portfolio_name": field(row, ["portfolio_name"]),
        "property_key": field(row, ["property_key", "listing_key"]),
        "property_name": field(row, ["property_name"]),
        "listing_name": field(row, ["listing_name", "room_name", "unit_name"]),
        "booking_channel": field(row, ["booking_channel", "channel", "booking_type"]),
        "reservation_status": field(row, ["status", "reservation_status"]),

        "checkin_date": date_value(row, ["checkin", "checkin_date", "checkin_at"]),
        "checkout_date": date_value(row, ["checkout", "checkout_date", "checkout_at"]),
        "nights": nights,
        "number_of_guests": integer(row, ["number_of_guests", "guest_count", "guests"]),

        "gross_booking_value_eur": gross,
        "accommodation_revenue_eur": accommodation,
        "host_payout_eur": host_payout,
        "cleaning_fee_charged_eur": cleaning_fee,
        "adr_eur": adr,

        "raw_payload": row,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default=str(DEFAULT_CSV))
    parser.add_argument("--sample-booking")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise FileNotFoundError(csv_path)

    supabase = get_supabase_client()

    rows: list[dict[str, Any]] = []
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            payload = payload_from_row(row)
            if not payload:
                continue

            if args.sample_booking and payload["source_booking_id"] != args.sample_booking:
                continue

            rows.append(payload)

    print(f"Rows to sync: {len(rows)}")

    for payload in rows[:5]:
        print(
            payload["source_system"],
            payload["source_booking_id"],
            payload.get("property_name"),
            payload.get("listing_name"),
            "gross=", payload.get("gross_booking_value_eur"),
            "accommodation=", payload.get("accommodation_revenue_eur"),
            "cleaning_fee=", payload.get("cleaning_fee_charged_eur"),
            "adr=", payload.get("adr_eur"),
        )

    if args.dry_run:
        return

    if rows:
        supabase.table("reservation_financials").upsert(
            rows,
            on_conflict="source_system,source_booking_id",
        ).execute()

    print("Done.")


if __name__ == "__main__":
    main()
