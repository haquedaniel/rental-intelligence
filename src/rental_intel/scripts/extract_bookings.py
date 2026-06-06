from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import yaml
from dotenv import load_dotenv

from rental_intel.ingest.beds24 import Beds24Client
from rental_intel.normalize.revenue import parse_revenue
from rental_intel.normalize.calendar import expand_reservations_to_daily


ROOT = Path(__file__).resolve().parents[3]


def load_client_config(client_id: str) -> Dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing client config: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def build_room_mapping(config: Dict[str, Any]) -> Dict[int, Dict[str, str]]:
    mapping: Dict[int, Dict[str, str]] = {}

    for portfolio in config.get("portfolios", []):
        portfolio_id = portfolio["portfolio_id"]
        portfolio_name = portfolio["name"]

        for listing in portfolio.get("listings", []):
            room_id = int(listing["source_room_id"])
            mapping[room_id] = {
                "portfolio_id": portfolio_id,
                "portfolio_name": portfolio_name,
                "listing_id": listing["listing_id"],
                "listing_name": listing["name"],
            }

    return mapping


def invoice_total(items: List[Dict[str, Any]], subtype: Optional[int] = None) -> float:
    total = 0.0
    for item in items or []:
        if subtype is None or item.get("subType") == subtype:
            total += float(item.get("lineTotal") or 0)
    return total


def parse_legacy_invoice_items(booking: Dict[str, Any]) -> Dict[str, float]:
    """
    Beds24 manual/legacy imports may have booking.price = 0 but valid invoiceItems.

    For our legacy imports, both accommodation and cleaning were stored as subType 7,
    so we identify them by description rather than subtype.
    """
    accommodation = 0.0
    cleaning = 0.0
    tourist_tax = 0.0
    channel_commission = 0.0

    for item in booking.get("invoiceItems") or []:
        if item.get("type") != "charge":
            continue

        amount = float(item.get("lineTotal") or item.get("amount") or 0)
        desc = str(item.get("description") or "").lower()

        if "cleaning" in desc or "ménage" in desc or "menage" in desc:
            cleaning += amount
        elif "tourist" in desc or "taxe" in desc or "séjour" in desc or "sejour" in desc:
            tourist_tax += amount
        elif "commission" in desc:
            channel_commission += amount
        else:
            accommodation += amount

    gross = accommodation + cleaning + tourist_tax + channel_commission

    return {
        "gross_booking_value": round(gross, 2),
        "accommodation_revenue": round(accommodation, 2),
        "cleaning_fee": round(cleaning, 2),
        "tourist_tax": round(tourist_tax, 2),
        "channel_commission": round(channel_commission, 2),
        "host_payout": round(gross - channel_commission, 2),
    }

def normalize_booking(
    booking: Dict[str, Any],
    client_id: str,
    room_mapping: Dict[int, Dict[str, str]],
) -> Dict[str, Any]:
    room_id = int(booking.get("roomId"))
    mapped = room_mapping.get(room_id, {})

    arrival = pd.to_datetime(booking.get("arrival")).date()
    departure = pd.to_datetime(booking.get("departure")).date()
    nights = (departure - arrival).days

    invoice_items = booking.get("invoiceItems") or []
    total_invoice_items = invoice_total(invoice_items)

    revenue = parse_revenue(booking)

    price = float(booking.get("price") or 0)
    commission = float(booking.get("commission") or 0)
    tax = float(booking.get("tax") or 0)

    # Legacy/manual Beds24 imports may have price = 0 but valid invoiceItems.
    # In that case, override the normal parser with invoice-item-derived revenue.
    legacy_invoice_revenue = parse_legacy_invoice_items(booking)

    invoice_gross = legacy_invoice_revenue["gross_booking_value"]

    channel_raw = str(
        booking.get("channel")
        or booking.get("apiSource")
        or booking.get("referer")
        or ""
    ).lower()

    referer_raw = str(booking.get("referer") or "").lower()
    referer_editable = str(booking.get("refererEditable") or "").lower()

    is_direct_like = (
        "direct" in channel_raw
        or "direct" in str(booking.get("apiSource") or "").lower()
        or referer_raw in {"api", "app"}
        or "legacy" in referer_editable
    )

    if invoice_gross > 0 and (price == 0 or is_direct_like):
        revenue = legacy_invoice_revenue

    channel = booking.get("channel") or booking.get("apiSource") or booking.get("referer")

    return {
        "client_id": client_id,
        "portfolio_id": mapped.get("portfolio_id"),
        "portfolio_name": mapped.get("portfolio_name"),
        "listing_id": mapped.get("listing_id"),
        "listing_name": mapped.get("listing_name"),
        "source_system": "beds24",
        "source_booking_id": booking.get("id"),
        "source_property_id": booking.get("propertyId"),
        "source_room_id": room_id,
        "status": booking.get("status"),
        "sub_status": booking.get("subStatus"),
        "arrival": arrival.isoformat(),
        "departure": departure.isoformat(),
        "nights": nights,
        "num_adult": booking.get("numAdult"),
        "num_child": booking.get("numChild"),
        "guest_first_name": booking.get("firstName"),
        "guest_last_name": booking.get("lastName"),
        "guest_email": booking.get("email"),
        "guest_phone": booking.get("phone"),
        "guest_mobile": booking.get("mobile"),
        "guest_city": booking.get("city"),
        "guest_postcode": booking.get("postcode"),
        "guest_country": booking.get("country2") or booking.get("country"),
        "guest_language": booking.get("lang"),
        "channel": channel,
        "api_source": booking.get("apiSource"),
        "api_reference": booking.get("apiReference"),
        "referer": booking.get("referer"),
        "booking_time": booking.get("bookingTime"),
        "modified_time": booking.get("modifiedTime"),
        "cancel_time": booking.get("cancelTime"),
        "price_total": price,
        "commission": commission,
        "tax": tax,
        "invoice_total": total_invoice_items,
        "gross_booking_value": revenue["gross_booking_value"],
        "accommodation_revenue": revenue["accommodation_revenue"],
        "cleaning_fee": revenue["cleaning_fee"],
        "tourist_tax": revenue["tourist_tax"],
        "channel_commission": revenue["channel_commission"],
        "host_payout": revenue["host_payout"],
        "adr_accommodation": round(revenue["accommodation_revenue"] / nights, 2) if nights else 0,
        "adr_host_payout": round(revenue["host_payout"] / nights, 2) if nights else 0,
    }


def main() -> None:
    load_dotenv(ROOT / ".env", override=True)
    client_id = "daniel_aurore"
    config = load_client_config(client_id)
    room_mapping = build_room_mapping(config)

    beds24 = Beds24Client()

    all_bookings: List[Dict[str, Any]] = []

    for portfolio in config.get("portfolios", []):
        source = portfolio.get("source", {})
        if source.get("system") != "beds24":
            continue

        property_id = int(source["property_id"])
        response = beds24.get_bookings(
            property_id=property_id,
            arrival_from="2026-01-01",
            arrival_to="2026-12-31",
            statuses=["confirmed", "new", "request", "cancelled"],
            include_invoice_items=True,
            include_guests=True,
        )

        raw_path = ROOT / "outputs" / "raw" / f"bookings_property_{property_id}.json"
        raw_path.write_text(json.dumps(response, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote raw bookings to {raw_path}")

        all_bookings.extend(response.get("data", []))

    normalized = [
        normalize_booking(b, client_id=client_id, room_mapping=room_mapping)
        for b in all_bookings
    ]

    df = pd.DataFrame(normalized)

    out_path = ROOT / "outputs" / "processed" / "normalized_reservations.csv"
    df.to_csv(out_path, index=False)
    print(f"Wrote normalized reservations to {out_path}")
    
    daily_df = expand_reservations_to_daily(df)

    daily_out_path = ROOT / "outputs" / "processed" / "daily_calendar.csv"
    daily_df.to_csv(daily_out_path, index=False)

    print(f"Wrote daily calendar to {daily_out_path}")

    if not df.empty:
        print()
        print("Bookings by listing/channel:")
        print(df.groupby(["listing_id", "channel"], dropna=False).size())

        print()
        print("Basic revenue check:")
        cols = [
            "listing_id",
            "arrival",
            "departure",
            "nights",
            "channel",
            "gross_booking_value",
            "accommodation_revenue",
            "cleaning_fee",
            "tourist_tax",
            "channel_commission",
            "host_payout",
            "adr_accommodation",
        ]        
        print(df[cols].to_string(index=False))

        if not daily_df.empty:
            print()
            print("Booked nights by listing/month:")
            print(
                daily_df.groupby(["listing_id", "year_month"], dropna=False)
                .agg(
                    booked_nights=("is_booked", "sum"),
                    accommodation_revenue=("accommodation_revenue_allocated", "sum"),
                    host_payout=("host_payout_allocated", "sum"),
                )
                .round(2)
            )


if __name__ == "__main__":
    main()
