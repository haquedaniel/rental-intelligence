# Pilotys Beds24 reservation messages v2

v2 fixes the important discovery from the first real API test:

- Passing an Airbnb/reference-like value such as `HMTH2SZACE` to `bookingId` can return a page of recent messages across many numeric Beds24 booking IDs.
- Beds24 message rows include their real numeric `bookingId`.
- The sync therefore now links messages using `message.bookingId`, not the query argument.

## Included

- `scripts/discover_beds24_messages.py`
  - supports `--max-pages`
  - prints distinct numeric Beds24 booking IDs found in the response
  - warns when the response is not actually filtered to the requested booking id

- `scripts/sync_beds24_reservation_messages.py`
  - recommended usage is by Beds24 property id:
    `python scripts/sync_beds24_reservation_messages.py --property-id 331524 --max-pages 5 --dry-run`
  - uses each message's numeric `bookingId`
  - maps to `reservations.source_booking_id`
  - stores `source`, `read`, `roomId`, `propertyId`, etc. in `raw_payload`
  - maps `source=guest/host/system` to direction values

The previous v1 files for richer reservation/financial sync and lifecycle context are retained.

## Apply

From repo root:

```bash
bash pilotys-beds24-reservation-messages-v2/scripts/install-beds24-reservation-messages-v2.sh
```

## Suggested test

```bash
python scripts/discover_beds24_messages.py --property-id 331524 --max-pages 2
python scripts/sync_beds24_reservation_messages.py --property-id 331524 --max-pages 2 --dry-run
```

If dry-run looks good:

```bash
python scripts/sync_beds24_reservation_messages.py --property-id 331524 --max-pages 10
```
