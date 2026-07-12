#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence

OPS_SCRIPT_NAME="cleaning_sms_cron"
source scripts/lib/ops_event_log.sh

DEFAULT_PROPERTY_IDS="20000000-0000-0000-0000-000000000001,20000000-0000-0000-0000-000000000002"

REQUEST_PROPERTY_IDS="${CLEANING_REQUEST_PROPERTY_IDS:-${CLEANING_SMS_PROPERTY_IDS:-$DEFAULT_PROPERTY_IDS}}"
SMS_PROPERTY_IDS="${CLEANING_SMS_PROPERTY_IDS:-$REQUEST_PROPERTY_IDS}"
SMS_SEND_ENABLED="${SMS_SEND_ENABLED:-true}"
BASE_URL="${CLEANER_WEB_BASE_URL:-https://missions.leclosdelavoilerie.com}"
LOG_FILE="${CLEANING_SMS_LOG_FILE:-/opt/rental-intelligence/outputs/logs/cleaning_sms_cron.log}"
LOCK_FILE="${CLEANING_SMS_LOCK_FILE:-/tmp/rental-cleaning-sms-cron.lock}"

mkdir -p "$(dirname "$LOG_FILE")"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  ops_event_skipped "Another cleaning_sms_cron run is already holding the lock."
  exit 0
fi

ops_event_start
ops_event_install_trap

{
  echo
  echo "===== $(date -Is) cleaning SMS cron start ====="
  echo "Request property filter: $REQUEST_PROPERTY_IDS"
  echo "SMS property filter: $SMS_PROPERTY_IDS"
  echo "SMS_SEND_ENABLED: $SMS_SEND_ENABLED"
  echo "SMS_TEST_RECIPIENT: ${SMS_TEST_RECIPIENT:-}"

  case "${SMS_SEND_ENABLED,,}" in
    1|true|yes)
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
      ;;
    *)
      echo "SMS_SEND_ENABLED is not true; skipping Twilio env check."
      ;;
  esac

  docker compose exec -T \
    -e CLEANING_REQUEST_PROPERTY_IDS="$REQUEST_PROPERTY_IDS" \
    -e CLEANING_REQUEST_INITIAL_STATUS="${CLEANING_REQUEST_INITIAL_STATUS:-created}" \
    -e CLEANING_READY_DAY_MAX_DAYS="${CLEANING_READY_DAY_MAX_DAYS:-3}" \
    cockpit bash -lc 'cd /app && python -m rental_intel.cleaning.create_requests_from_reservations'

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="$SMS_PROPERTY_IDS" \
    -e CLEANER_WEB_BASE_URL="$BASE_URL" \
    cockpit bash -lc 'cd /app && python -m rental_intel.cleaning.enqueue_mission_offer_messages'

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="$SMS_PROPERTY_IDS" \
    -e CLEANER_WEB_BASE_URL="$BASE_URL" \
    cockpit bash -lc 'cd /app && python -m rental_intel.scripts.enqueue_accepted_cleaning_reminders --lookahead-days 30'

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="$SMS_PROPERTY_IDS" \
    -e CLEANER_WEB_BASE_URL="$BASE_URL" \
    cockpit bash -lc 'cd /app && python -m rental_intel.scripts.enqueue_overdue_cleaning_alerts --grace-minutes 90 --lookback-days 14'

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="$SMS_PROPERTY_IDS" \
    -e CLEANER_WEB_BASE_URL="$BASE_URL" \
    -e CLEANING_REPORT_ALERT_LOOKBACK_DAYS="${CLEANING_REPORT_ALERT_LOOKBACK_DAYS:-7}" \
    cockpit bash -lc 'cd /app && python -m rental_intel.scripts.enqueue_cleaning_report_owner_alerts
python -m rental_intel.scripts.enqueue_cleaner_payment_request_reminders
APPLY=true python -m rental_intel.scripts.enqueue_payment_request_outcome_messages --lookback-days 14'

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="$SMS_PROPERTY_IDS" \
    -e SMS_MESSAGE_TYPE_PREFIXES="mission_,cleaning_,accepted_cleaning_reminder" \
    -e SMS_SEND_ENABLED="$SMS_SEND_ENABLED" \
    -e SMS_TEST_RECIPIENT="${SMS_TEST_RECIPIENT:-}" \
    cockpit bash -lc 'cd /app && unset CLEANING_SMS_PROPERTY_IDS
unset SMS_MESSAGE_TYPES
unset SMS_MESSAGE_TYPE_PREFIXES
export SMS_SEND_ENABLED=true
python -m rental_intel.cleaning.send_pending_outbound_messages'

  echo "===== $(date -Is) cleaning SMS cron end ====="
} >> "$LOG_FILE" 2>&1

ops_event_mark_complete
