#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence

OPS_SCRIPT_NAME="payment_sms_cron"
source scripts/lib/ops_event_log.sh

SMS_SEND_ENABLED="${SMS_SEND_ENABLED:-true}"
LOG_FILE="${PAYMENT_SMS_LOG_FILE:-/opt/rental-intelligence/outputs/logs/payment_sms_cron.log}"
LOCK_FILE="${PAYMENT_SMS_LOCK_FILE:-/tmp/rental-payment-sms-cron.lock}"

mkdir -p "$(dirname "$LOG_FILE")"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  ops_event_skipped "Another payment_sms_cron run is already holding the lock."
  exit 0
fi

ops_event_start
ops_event_install_trap

{
  echo
  echo "===== $(date -Is) payment SMS cron start ====="
  echo "SMS_SEND_ENABLED: $SMS_SEND_ENABLED"
  echo "SMS_TEST_RECIPIENT: ${SMS_TEST_RECIPIENT:-}"
  echo "SMS_MESSAGE_TYPE_PREFIXES: monthly_payment_"

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
      echo "SMS_SEND_ENABLED is not true; dry run only."
      ;;
  esac

  docker compose exec -T \
    -e CLEANING_SMS_PROPERTY_IDS="" \
    -e SMS_MESSAGE_TYPE_PREFIXES="monthly_payment_" \
    -e SMS_SEND_ENABLED="$SMS_SEND_ENABLED" \
    -e SMS_TEST_RECIPIENT="${SMS_TEST_RECIPIENT:-}" \
    cockpit bash -lc 'cd /app && python -m rental_intel.cleaning.send_pending_outbound_messages'

  echo "===== $(date -Is) payment SMS cron end ====="
} >> "$LOG_FILE" 2>&1

ops_event_mark_complete
