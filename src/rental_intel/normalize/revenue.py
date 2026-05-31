from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


def _to_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    return float(value)


def invoice_total(items: List[Dict[str, Any]], subtype: Optional[int] = None) -> float:
    total = 0.0
    for item in items or []:
        if subtype is None or item.get("subType") == subtype:
            total += _to_float(item.get("lineTotal"))
    return round(total, 2)


def extract_money_from_rate_description(label: str, text: Optional[str]) -> float:
    """
    Extract values from lines like:
      Base Price 1548.5 EUR
      Cleaning fee 85.00 EUR
      Host Fee -58.81 EUR
      Expected Payout Amount 1574.69 EUR
    """
    if not text:
        return 0.0

    pattern = rf"{re.escape(label)}\s+(-?\d+(?:\.\d+)?)\s*EUR"
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        return 0.0

    return round(float(match.group(1)), 2)


def extract_airbnb_taxes(text: Optional[str]) -> float:
    if not text:
        return 0.0

    total = 0.0
    patterns = [
        r"AIRBNB Taxe de Sejour.*?\s+(\d+(?:\.\d+)?)\s*EUR",
        r"AIRBNB Taxe Additionnelle Departementale.*?\s+(\d+(?:\.\d+)?)\s*EUR",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            total += float(match.group(1))

    return round(total, 2)


def parse_revenue(booking: Dict[str, Any]) -> Dict[str, float]:
    """
    Return normalized revenue fields.

    Definitions:
    - gross_booking_value: total booking value visible in Beds24 price field
    - accommodation_revenue: room/base revenue excluding cleaning and tourist tax, before channel commission
    - cleaning_fee: cleaning fee charged to guest where visible
    - tourist_tax: tourist tax where visible
    - channel_commission: platform/OTA commission, positive number
    - host_payout: expected payout / net after platform commission where visible
    """
    channel = (booking.get("channel") or booking.get("apiSource") or "").lower()
    invoice_items = booking.get("invoiceItems") or []
    rate_description = booking.get("rateDescription") or ""

    gross_booking_value = _to_float(booking.get("price"))
    beds24_commission = _to_float(booking.get("commission"))

    # Direct bookings currently expose separate invoice lines.
    direct_room_charge = invoice_total(invoice_items, subtype=1)
    direct_cleaning_fee = invoice_total(invoice_items, subtype=15)
    direct_tourist_tax = invoice_total(invoice_items, subtype=3)

    # Airbnb exposes richer detail in rateDescription.
    airbnb_base_price = extract_money_from_rate_description("Base Price", rate_description)
    airbnb_cleaning_fee = extract_money_from_rate_description("Cleaning fee", rate_description)
    airbnb_taxes = extract_airbnb_taxes(rate_description)
    airbnb_host_fee = abs(extract_money_from_rate_description("Host Fee", rate_description))
    airbnb_expected_payout = extract_money_from_rate_description("Expected Payout Amount", rate_description)

    if channel == "airbnb":
        accommodation_revenue = airbnb_base_price
        cleaning_fee = airbnb_cleaning_fee
        tourist_tax = airbnb_taxes
        channel_commission = airbnb_host_fee or beds24_commission
        host_payout = airbnb_expected_payout or round(gross_booking_value - channel_commission, 2)

    elif channel in {"direct", ""}:
        accommodation_revenue = direct_room_charge
        cleaning_fee = direct_cleaning_fee
        tourist_tax = direct_tourist_tax
        channel_commission = beds24_commission
        host_payout = round(gross_booking_value - channel_commission, 2)

    else:
        # Booking.com and others may not have full breakdown yet.
        # For now, use the cleanest visible fields and refine once we inspect more examples.
        accommodation_revenue = direct_room_charge or gross_booking_value
        cleaning_fee = direct_cleaning_fee
        tourist_tax = direct_tourist_tax
        channel_commission = beds24_commission
        host_payout = round(gross_booking_value - channel_commission, 2)

    return {
        "gross_booking_value": round(gross_booking_value, 2),
        "accommodation_revenue": round(accommodation_revenue, 2),
        "cleaning_fee": round(cleaning_fee, 2),
        "tourist_tax": round(tourist_tax, 2),
        "channel_commission": round(channel_commission, 2),
        "host_payout": round(host_payout, 2),
    }
