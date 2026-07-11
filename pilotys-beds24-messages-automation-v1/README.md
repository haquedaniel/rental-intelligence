# Pilotys Beds24 messages automation v1

Adds automated Beds24/OTA correspondence extraction.

Installs:
- `scripts/sync_beds24_reservation_messages.py`
- `scripts/beds24_messages_cron.sh`

Patches `scripts/ops_refresh.sh` when found, inserting the messages sync immediately after:

```bash
run_required python -m rental_intel.scripts.extract_bookings
```

Why there:
- bookings must be fresh first;
- messages can then link to `reservations`;
- cleaning SMS and payment SMS crons stay separate;
- cockpit analytics refresh stays separate.

Defaults:
- `BEDS24_MESSAGE_PROPERTY_IDS=330389,331524`
- `BEDS24_MESSAGE_MAX_PAGES=10`
- `BEDS24_MESSAGE_DRY_RUN=false`
- log: `/opt/rental-intelligence/outputs/logs/beds24_messages_cron.log`

Apply from repo root:

```bash
bash pilotys-beds24-messages-automation-v1/scripts/install-beds24-messages-automation-v1.sh
```

Test:

```bash
BEDS24_MESSAGE_DRY_RUN=true bash scripts/beds24_messages_cron.sh
tail -n 200 outputs/logs/beds24_messages_cron.log
```

Run normally:

```bash
bash scripts/beds24_messages_cron.sh
```
