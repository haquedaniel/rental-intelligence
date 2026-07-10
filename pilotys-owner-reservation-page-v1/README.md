# Pilotys owner reservation page v1

A redesigned owner reservation page matching the cockpit visual language.

## Route

`apps/cleaner-web/app/owner/reservations/[reservationId]/page.tsx`

## Uses existing + new tables

- `reservations`
- `reservation_financials`
- `properties`
- `property_reference_photos`
- `cleaning_requests`
- `cleaning_reports`
- `analytics_expense_lines`
- `reservation_messages`
- `reservation_operational_context`

## Main sections

- Property-image hero with guest, dates, channel/reference
- Lifecycle-aware primary panel
- Financial cockpit: gross/customer paid, accommodation, host payout, cleaning fees, taxes/commission, known variable costs
- Simple price assessment versus comparable ADR median for the same listing
- Operational briefing: guests, language, country, pets, notes
- Previous/next reservation context
- Preparation mission and checkout mission cards
- Correspondence timeline from Beds24/OTA messages

## Apply

From repo root:

```bash
bash pilotys-owner-reservation-page-v1/scripts/install-owner-reservation-page-v1.sh
cd apps/cleaner-web
npm run build
```
