# Revenue Definitions

This document tracks how Beds24 booking financial fields are interpreted.

## Core fields

### gross_booking_value
The total booking value visible in Beds24 `price`.

For direct bookings, this generally includes:
- accommodation
- cleaning fee
- tourist tax

For Airbnb, this appears to include:
- base price
- cleaning fee
but not necessarily tourist tax in the same way as direct bookings.

### accommodation_revenue
The stay/accommodation component only, excluding cleaning fee and tourist tax where we can identify them.

This is the main field for:
- ADR
- pricing analytics
- pricing recommendations

### cleaning_fee
Cleaning fee charged to the guest where visible.

### tourist_tax
Tourist tax / taxe de séjour where visible.

### channel_commission
OTA/platform commission or host fee, stored as a positive number.

### host_payout
Expected payout or estimated amount received after platform commission.

## Current parser status

### Direct bookings
Uses Beds24 invoice item subtypes:
- subType 1: room/accommodation charge
- subType 15: cleaning fee
- subType 3: tourist tax

Confidence: medium-high based on first test bookings.

### Airbnb
Parses `rateDescription` lines:
- Base Price
- Cleaning fee
- AIRBNB Taxe de Sejour
- AIRBNB Taxe Additionnelle Departementale
- Host Fee
- Expected Payout Amount

Confidence: medium based on first imported Airbnb bookings.

### Booking.com
Currently incomplete.

Known issue:
- We currently use Beds24 `price` as accommodation revenue if no better breakdown is available.
- Need to confirm whether Booking.com price includes cleaning, tourist tax, or other fees.
- Need more real examples.

Confidence: low.

## Open questions

- Does Beds24 `price` always mean the same thing across channels?
- For Booking.com, how are cleaning fee and tourist tax represented?
- For direct bookings, should `host_payout` include tourist tax or should we create a separate `cash_collected` field?
- Should owner revenue include or exclude cleaning fee if cleaning is passed through to cleaners?
- How do cancelled bookings appear in financial totals?
- How are modified bookings represented after date/price changes?

## Decision log

- 2026-05-31: Use `accommodation_revenue` as the main ADR/pricing field.
- 2026-05-31: Keep `gross_booking_value`, `cleaning_fee`, `tourist_tax`, `channel_commission`, and `host_payout` separately rather than relying on one revenue number.
