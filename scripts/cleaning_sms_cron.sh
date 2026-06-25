#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence

PROPERTY_ID="20000000-0000-0000-0000-000000000001"
BASE_URL="https://missions.leclosdelavoilerie.com"
LOG_FILE="/opt/rental-intelligence/outputs/logs/cleaning_sms_cron.log"
LOCK_FILE="/tmp/rental-cleaning-sms-cron.lock"

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

{
  echo
  echo "===== $(date -Is) cleaning SMS cron start ====="

  docker compose exec -T cockpit bash -lc '
    missing=0
    for v in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM_NUMBER; do
      if [ -z "${!v:-}" ]; then
        echo "MISSING $v"
        missing=1
      fi
    done
    exit "$missing"
  '

  docker compose exec -T \
    -e CLEANING_REQUEST_PROPERTY_IDS="$PROPERTY_ID" \
    -e CLEANING_REQUEST_INITIAL_STATUS="created" \
    -e CLEANING_READY_DAY_MAX_DAYS="3" \
    cockpit bash -lc 'cd /app && python -m rental_intel.cleaning.create_requests_from_reservations'

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="$PROPERTY_ID" \
    -e CLEANER_WEB_BASE_URL="$BASE_URL" \
    cockpit bash -lc 'cd /app && python -m rental_intel.cleaning.enqueue_mission_offer_messages'

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="$PROPERTY_ID" \
    -e CLEANER_WEB_BASE_URL="$BASE_URL" \
    cockpit bash -lc 'cd /app && python -m rental_intel.scripts.enqueue_accepted_cleaning_reminders --lookahead-days 30'

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="$PROPERTY_ID" \
    -e CLEANER_WEB_BASE_URL="$BASE_URL" \
    cockpit bash -lc 'cd /app && python -m rental_intel.scripts.enqueue_overdue_cleaning_alerts --grace-minutes 90 --lookback-days 14'

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="$PROPERTY_ID" \
    -e SMS_SEND_ENABLED="true" \
    cockpit bash -lc 'cd /app && python -m rental_intel.cleaning.send_pending_outbound_messages'

  echo "===== $(date -Is) cleaning SMS cron end ====="
} >> "$LOG_FILE" 2>&1
