from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date
from datetime import timedelta
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import yaml
from dotenv import load_dotenv

from rental_intel.ingest.beds24 import Beds24Client


ROOT = Path(__file__).resolve().parents[3]

DEFAULT_RESERVATIONS_DIR = ROOT / "data" / "manual" / "reservations" 
DEFAULT_SHEET_NAME = "Reservations"

ACTIVE_STATUSES = {"new", "confirmed", "request"}

# Sheet listing code -> internal listing_id.
SHEET_LISTING_MAP = {
    "0": "peskerezh_house",
    "2": "apt2",
    "4": "apt4",
    "5": "apt5",
    # Do not import these as Beds24 short-term bookings.
    "6": "lot6_long_term",
    "8": "lot8_long_term",
}

LONG_TERM_SHEET_LISTINGS = {"6", "8"}

AIRBNB_SOURCES = {"airbnb", "airbnb "}
DIRECTISH_SOURCES = {
    "website",
    "fg website",
    "fg web site",
    "leboncoin",
    "direct",
    "other",
}


@dataclass
class ListingMeta:
    listing_id: str
    portfolio_id: str
    property_id: int
    room_id: int
    unit_id: int = 1


def normalize_text(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def normalize_source(value: Any) -> str:
    return normalize_text(value).lower().replace("  ", " ")


def money(value: Any) -> float:
    if value is None or pd.isna(value) or value == "":
        return 0.0
    return round(float(value), 2)


def parse_date(value: Any) -> date | None:
    if value is None or pd.isna(value) or value == "":
        return None
    parsed = pd.to_datetime(value, dayfirst=True, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def find_latest_reservations_file() -> Path:
    files = sorted(DEFAULT_RESERVATIONS_DIR.glob("*.xlsx"))
    if not files:
        raise FileNotFoundError(f"No .xlsx files found in {DEFAULT_RESERVATIONS_DIR}")
    return files[-1]


def load_client_listing_meta(client_id: str = "daniel_aurore") -> dict[str, ListingMeta]:
    path = ROOT / "config" / "clients" / f"{client_id}.yaml"

    listing_meta: dict[str, ListingMeta] = {}

    if path.exists():
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}

        for portfolio in data.get("portfolios", []):
            portfolio_id = str(
                portfolio.get("portfolio_id")
                or portfolio.get("id")
                or ""
            )

            source_property_id = (
                portfolio.get("source_property_id")
                or portfolio.get("property_id")
                or portfolio.get("beds24_property_id")
            )

            possible_listings = (
                portfolio.get("listings")
                or portfolio.get("rooms")
                or portfolio.get("units")
                or []
            )

            for listing in possible_listings:
                listing_id = str(
                    listing.get("listing_id")
                    or listing.get("id")
                    or listing.get("unit_id")
                    or ""
                )

                property_id = (
                    listing.get("source_property_id")
                    or listing.get("property_id")
                    or listing.get("beds24_property_id")
                    or source_property_id
                )

                room_id = (
                    listing.get("source_room_id")
                    or listing.get("room_id")
                    or listing.get("beds24_room_id")
                )

                unit_id = (
                    listing.get("source_unit_id")
                    or listing.get("unit_id")
                    or listing.get("beds24_unit_id")
                    or 1
                )

                if listing_id and property_id and room_id:
                    listing_meta[listing_id] = ListingMeta(
                        listing_id=listing_id,
                        portfolio_id=portfolio_id,
                        property_id=int(property_id),
                        room_id=int(room_id),
                        unit_id=int(unit_id),
                    )

    # Fallback mappings from what we already know.
    # These ensure the import script can work even if the YAML shape changes.
    fallback = {
        "peskerezh_house": ListingMeta(
            listing_id="peskerezh_house",
            portfolio_id="peskerezh",
            property_id=330389,
            room_id=685219,
            unit_id=1,
        ),
        "apt4": ListingMeta(
            listing_id="apt4",
            portfolio_id="voilerie",
            property_id=331524,
            room_id=687189,
            unit_id=1,
        ),
        "apt5": ListingMeta(
            listing_id="apt5",
            portfolio_id="voilerie",
            property_id=331524,
            room_id=687116,
            unit_id=1,
        ),
        # Only keep this if apt2 now exists in Beds24.
        # If apt2 has no Beds24 room yet, remove/comment it out.
        # "apt2": ListingMeta(
        #     listing_id="apt2",
        #     portfolio_id="voilerie",
        #     property_id=331524,
        #     room_id=XXXXX,
        #     unit_id=1,
        # ),
    }

    for listing_id, meta in fallback.items():
        listing_meta.setdefault(listing_id, meta)

    if not listing_meta:
        raise RuntimeError(
            f"No Beds24 listing mappings found in {path} and no fallback mappings loaded."
        )

    return listing_meta


def load_reservations_sheet(path: Path, sheet_name: str) -> pd.DataFrame:
    try:
        df = pd.read_excel(path, sheet_name=sheet_name)
    except ValueError:
        # Fall back to first sheet if the tab name is slightly different.
        df = pd.read_excel(path, sheet_name=0)

    df = df.dropna(how="all").copy()
    df.columns = [str(c).strip() for c in df.columns]

    required = [
        "Guest Name",
        "Listing",
        "Booking Source",
        "Check in Date",
        "Number of Nights",
        "Total Revenue",
        "Cleaning Fees",
    ]

    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns in reservation sheet: {missing}")

    return df


def normalize_legacy_rows(df: pd.DataFrame) -> pd.DataFrame:
    rows: List[Dict[str, Any]] = []

    for idx, row in df.iterrows():
        raw_listing = normalize_text(row.get("Listing"))
        # Some sheets load listing as 4.0 rather than 4.
        if raw_listing.endswith(".0"):
            raw_listing = raw_listing[:-2]

        check_in = parse_date(row.get("Check in Date"))
        nights = int(row.get("Number of Nights") or 0) if not pd.isna(row.get("Number of Nights")) else 0

        if not raw_listing or check_in is None or nights <= 0:
            continue

        departure = check_in + timedelta(days=nights)
        source_raw = normalize_text(row.get("Booking Source"))
        source_norm = normalize_source(source_raw)

        listing_id = SHEET_LISTING_MAP.get(raw_listing)

        total_revenue = money(row.get("Total Revenue"))
        cleaning_fee = money(row.get("Cleaning Fees"))
        accommodation_revenue = round(max(total_revenue - cleaning_fee, 0), 2)

        rows.append(
            {
                "legacy_row_number": int(idx) + 2,
                "guest_name": normalize_text(row.get("Guest Name")),
                "sheet_listing_raw": raw_listing,
                "listing_id": listing_id,
                "booking_source_raw": source_raw,
                "booking_source_norm": source_norm,
                "confirmation_code": normalize_text(row.get("Confirmation Code")),
                "booking_date": parse_date(row.get("Booking Date")),
                "arrival": check_in.isoformat(),
                "departure": departure.isoformat(),
                "nights": nights,
                "total_revenue": total_revenue,
                "cleaning_fee": cleaning_fee,
                "accommodation_revenue": accommodation_revenue,
                "concierge_commission_sheet": money(row.get("Concierge Commission")),
                "revenue_net_sheet": money(row.get("Revenue Net")),
            }
        )

    return pd.DataFrame(rows)


def date_ranges_overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    a1 = pd.to_datetime(a_start).date()
    a2 = pd.to_datetime(a_end).date()
    b1 = pd.to_datetime(b_start).date()
    b2 = pd.to_datetime(b_end).date()
    return a1 < b2 and b1 < a2


def fetch_existing_beds24_bookings(
    client: Beds24Client,
    property_ids: list[int],
) -> pd.DataFrame:
    rows: List[Dict[str, Any]] = []

    for property_id in sorted(set(property_ids)):
        print(f"Fetching existing Beds24 bookings for property {property_id}")

        response = client.get_bookings(
            property_id=property_id,
            booking_time_from="2024-01-01T00:00:00Z",
            booking_time_to="2027-12-31T23:59:59Z",
            statuses=["new", "confirmed", "request", "cancelled"],
            include_invoice_items=True,
            include_guests=True,
        )

        for b in response.get("data", []):
            rows.append(
                {
                    "beds24_booking_id": b.get("id"),
                    "property_id": b.get("propertyId"),
                    "room_id": b.get("roomId"),
                    "unit_id": b.get("unitId"),
                    "arrival": b.get("arrival"),
                    "departure": b.get("departure"),
                    "status": str(b.get("status") or "").lower(),
                    "channel": str(b.get("channel") or "").lower(),
                    "api_reference": b.get("apiReference"),
                    "first_name": b.get("firstName"),
                    "last_name": b.get("lastName"),
                    "referer": b.get("referer") or b.get("refererEditable"),
                }
            )

        response_by_arrival = client.get_bookings(
            property_id=property_id,
            arrival_from="2026-01-01",
            arrival_to="2026-12-31",
            statuses=["new", "confirmed", "request", "cancelled"],
            include_invoice_items=True,
            include_guests=True,
        )

        for b in response_by_arrival.get("data", []):
            rows.append(
                {
                    "beds24_booking_id": b.get("id"),
                    "property_id": b.get("propertyId"),
                    "room_id": b.get("roomId"),
                    "unit_id": b.get("unitId"),
                    "arrival": b.get("arrival"),
                    "departure": b.get("departure"),
                    "status": str(b.get("status") or "").lower(),
                    "channel": str(b.get("channel") or "").lower(),
                    "api_reference": b.get("apiReference"),
                    "first_name": b.get("firstName"),
                    "last_name": b.get("lastName"),
                    "referer": b.get("referer") or b.get("refererEditable"),
                }
            )
        
    if not rows:
        return pd.DataFrame()

    existing = pd.DataFrame(rows)
    existing = existing.drop_duplicates(subset=["beds24_booking_id"])
    return existing


def classify_plan_row(
    row: pd.Series,
    meta: ListingMeta | None,
    existing: pd.DataFrame,
    include_airbnb: bool,
) -> tuple[str, str, int | None]:
    raw_listing = str(row["sheet_listing_raw"])
    source = str(row["booking_source_norm"])
    listing_id = row.get("listing_id")

    if raw_listing in LONG_TERM_SHEET_LISTINGS:
        return "SKIP_LONG_TERM", "Lot 6/8 are modelled as long-term income, not Beds24 bookings.", None

    if not listing_id or pd.isna(listing_id):
        return "SKIP_UNMAPPED_LISTING", f"No listing mapping for sheet listing {raw_listing}.", None

    if meta is None:
        return "SKIP_NO_BEDS24_META", f"No Beds24 property/room mapping for {listing_id}.", None

    room_existing = existing[
        (existing["property_id"].astype(int) == int(meta.property_id))
        & (existing["room_id"].astype(int) == int(meta.room_id))
        & (existing["status"].isin(ACTIVE_STATUSES))
    ].copy()

    exact = room_existing[
        (room_existing["arrival"].astype(str) == str(row["arrival"]))
        & (room_existing["departure"].astype(str) == str(row["departure"]))
    ]

    if not exact.empty:
        return (
            "SKIP_EXISTING_EXACT",
            f"Exact Beds24 active booking/block already exists: {exact.iloc[0]['beds24_booking_id']}",
            int(exact.iloc[0]["beds24_booking_id"]),
        )

    overlaps = room_existing[
        room_existing.apply(
            lambda b: date_ranges_overlap(
                str(row["arrival"]),
                str(row["departure"]),
                str(b["arrival"]),
                str(b["departure"]),
            ),
            axis=1,
        )
    ]

    if not overlaps.empty:
        ids = ", ".join(overlaps["beds24_booking_id"].astype(str).tolist())
        return "SKIP_CONFLICT", f"Overlaps existing active Beds24 booking/block(s): {ids}", None

    is_airbnb = source in AIRBNB_SOURCES

    if is_airbnb and not include_airbnb:
        return (
            "MISSING_AIRBNB_NOT_CREATED",
            "Airbnb row not found in Beds24. Not creating by default; investigate first.",
            None,
        )

    return "CREATE", "No duplicate or conflict found.", None


def build_booking_payload(row: pd.Series, meta: ListingMeta) -> Dict[str, Any]:
    guest = normalize_text(row.get("guest_name")) or "Legacy import"
    parts = guest.split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    source_raw = normalize_text(row.get("booking_source_raw"))
    source_norm = normalize_source(source_raw)

    # For manual imports, put them in Beds24 as direct/manual.
    if source_norm == "airbnb":
        channel = "direct"
        referer = "Legacy Airbnb import"
    else:
        channel = "direct"
        referer = source_raw or "Legacy import"

    accommodation = money(row.get("accommodation_revenue"))
    cleaning = money(row.get("cleaning_fee"))

    invoice_items = []

    if accommodation:
        invoice_items.append(
            {
                "type": "charge",
                "subType": 1,
                "description": "Legacy import accommodation",
                "qty": 1,
                "amount": accommodation,
            }
        )

    if cleaning:
        invoice_items.append(
            {
                "type": "charge",
                "subType": 15,
                "description": "Legacy import cleaning fee",
                "qty": 1,
                "amount": cleaning,
            }
        )

    notes = (
        "Imported from legacy reservation spreadsheet. "
        "This is a manual historical import, not an OTA API-synced booking. "
        f"Legacy source={source_raw}; legacy row={row.get('legacy_row_number')}; "
        f"legacy total revenue={row.get('total_revenue')}; "
        f"legacy revenue net={row.get('revenue_net_sheet')}."
    )

    payload: Dict[str, Any] = {
        "propertyId": meta.property_id,
        "roomId": meta.room_id,
        "unitId": meta.unit_id,
        "status": "confirmed",
        "arrival": row["arrival"],
        "departure": row["departure"],
        "numAdult": 2,
        "numChild": 0,
        "firstName": first_name,
        "lastName": last_name,
        "channel": channel,
        "referer": referer,
        "refererEditable": referer,
        "notes": notes,
    }

    if invoice_items:
        payload["invoiceItems"] = invoice_items

    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", type=Path, default=None)
    parser.add_argument("--sheet", default=DEFAULT_SHEET_NAME)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--include-airbnb", action="store_true")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env", override=True)

    source_file = args.file or find_latest_reservations_file()
    print(f"Using reservations file: {source_file}")

    listing_meta = load_client_listing_meta()
    print("Loaded listing metadata:")
    for listing_id, meta in listing_meta.items():
        print(listing_id, meta)
    reservations_raw = load_reservations_sheet(source_file, args.sheet)
    legacy = normalize_legacy_rows(reservations_raw)

    property_ids = sorted({m.property_id for m in listing_meta.values()})
    beds24 = Beds24Client()
    existing = fetch_existing_beds24_bookings(beds24, property_ids)

    plan_rows: List[Dict[str, Any]] = []
    payloads: List[Dict[str, Any]] = []

    for _, row in legacy.iterrows():
        listing_id = row.get("listing_id")
        meta = listing_meta.get(str(listing_id)) if listing_id and not pd.isna(listing_id) else None

        status, reason, existing_id = classify_plan_row(
            row=row,
            meta=meta,
            existing=existing,
            include_airbnb=args.include_airbnb,
        )

        payload = None
        if status == "CREATE" and meta is not None:
            payload = build_booking_payload(row, meta)
            payloads.append(payload)

        plan_rows.append(
            {
                **row.to_dict(),
                "property_id": meta.property_id if meta else None,
                "room_id": meta.room_id if meta else None,
                "plan_status": status,
                "plan_reason": reason,
                "existing_beds24_booking_id": existing_id,
                "payload_json": json.dumps(payload, ensure_ascii=False) if payload else "",
            }
        )

    plan = pd.DataFrame(plan_rows)

    out_dir = ROOT / "outputs" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)

    plan_path = out_dir / "legacy_reservation_import_plan.csv"
    plan.to_csv(plan_path, index=False)

    payload_path = ROOT / "outputs" / "raw" / "legacy_reservation_import_payloads.json"
    payload_path.parent.mkdir(parents=True, exist_ok=True)
    payload_path.write_text(json.dumps(payloads, indent=2, ensure_ascii=False), encoding="utf-8")

    print()
    print(f"Wrote import plan to {plan_path}")
    print(f"Wrote payloads to {payload_path}")
    print()
    print("Plan summary:")
    print(plan.groupby("plan_status").size().to_string())

    preview_cols = [
        "plan_status",
        "listing_id",
        "guest_name",
        "booking_source_raw",
        "arrival",
        "departure",
        "nights",
        "total_revenue",
        "cleaning_fee",
        "plan_reason",
    ]
    print()
    print(plan[preview_cols].to_string(index=False))

    if not args.apply:
        print()
        print("Dry run only. No bookings were created.")
        print("Review outputs/processed/legacy_reservation_import_plan.csv")
        print("To apply CREATE rows, rerun with --apply")
        return

    create_plan = plan[plan["plan_status"] == "CREATE"].copy()

    if create_plan.empty:
        print("No CREATE rows to apply.")
        return

    print()
    print(f"Applying {len(create_plan)} bookings to Beds24...")

    created_rows = []

    for _, row in create_plan.iterrows():
        payload = json.loads(row["payload_json"])
        print(
            f"Creating {row['listing_id']} {row['arrival']} → {row['departure']} "
            f"{row['guest_name']} / {row['booking_source_raw']}"
        )

        response = beds24.create_booking(payload)

        created_rows.append(
            {
                "legacy_row_number": row["legacy_row_number"],
                "listing_id": row["listing_id"],
                "arrival": row["arrival"],
                "departure": row["departure"],
                "guest_name": row["guest_name"],
                "response_json": json.dumps(response, ensure_ascii=False),
            }
        )

    created = pd.DataFrame(created_rows)
    created_path = out_dir / "legacy_reservation_import_created.csv"
    created.to_csv(created_path, index=False)

    print()
    print(f"Wrote created booking log to {created_path}")
    print("Done.")


if __name__ == "__main__":
    main()
