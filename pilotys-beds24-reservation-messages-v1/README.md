# Pilotys Beds24 reservation messages v1

This package extends the existing Python/Supabase pipeline rather than creating a parallel one.

## Included

- `src/rental_intel/ingest/beds24.py`
  - adds `Beds24Client.get_booking_messages()`

- `scripts/sync_cleaning_reservations.py`
  - keeps the existing reservation upsert
  - now writes richer reservation fields into columns added by the migration:
    source property/room/channel fields, guest contact/language/country fields,
    guest notes fields, booking/modified/cancel timestamps, raw payload, synced_at

- `scripts/sync_reservation_financials.py`
  - keeps the existing financial upsert
  - now writes source property/room fields, API references, tourist tax,
    channel commission, invoice total, customer paid, ADR host payout, timestamps

- `scripts/discover_beds24_messages.py`
  - diagnostic raw fetcher for Beds24 `/bookings/messages`

- `scripts/sync_beds24_reservation_messages.py`
  - fetches Beds24 messages per booking
  - links them to reservations by `source_system='beds24'` and `source_booking_id`
  - upserts into `reservation_messages`

- `scripts/generate_reservation_operational_context.py`
  - populates `reservation_operational_context`
  - computes lifecycle state, previous/next reservation, preparation mission,
    checkout mission, latest cleaning report, and primary owner message

## Apply

From repo root:

```bash
bash pilotys-beds24-reservation-messages-v1/scripts/install-beds24-reservation-messages-v1.sh
```

## Suggested first run

```bash
python scripts/discover_beds24_messages.py --limit 3
python scripts/sync_cleaning_reservations.py
python scripts/sync_reservation_financials.py
python scripts/sync_beds24_reservation_messages.py --limit 3 --dry-run
python scripts/generate_reservation_operational_context.py
```

If the message endpoint returns a different shape than expected, inspect:

```bash
ls outputs/raw/beds24_messages_*.json
```
