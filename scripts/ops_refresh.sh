#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence
mkdir -p logs

OPS_SCRIPT_NAME="ops_refresh"
source scripts/lib/ops_event_log.sh

exec 9>/tmp/rental_intelligence_ops_refresh.lock
if ! flock -n 9; then
  echo "===== $(date -Is) ops_refresh already running; exiting ====="
  ops_event_skipped "Another ops_refresh run is already holding the lock."
  exit 0
fi

ops_event_start
ops_event_install_trap

run_required() {
  echo
  echo "===== $(date -Is) running $* ====="
  docker compose exec -T cockpit "$@"
}

echo "===== $(date -Is) starting ops_refresh ====="

run_required python -m rental_intel.scripts.extract_bookings

# Beds24 / OTA correspondence sync.
# Must run after bookings extraction so reservation_messages can link to fresh reservation rows.
if [ -x scripts/beds24_messages_cron.sh ]; then
  echo
  echo "===== $(date -Is) running Beds24 correspondence sync ====="
  bash scripts/beds24_messages_cron.sh
else
  echo "===== $(date -Is) skipping Beds24 correspondence sync: scripts/beds24_messages_cron.sh not found ====="
fi

run_required python -m rental_intel.scripts.build_metrics
run_required python -m rental_intel.scripts.sync_cleaning_reservations

# Cleaning request generation, SMS enqueueing, and SMS sending are handled only by:
#   scripts/cleaning_sms_cron.sh
#   scripts/payment_sms_cron.sh

echo "===== $(date -Is) ops_refresh complete ====="
ops_event_mark_complete
