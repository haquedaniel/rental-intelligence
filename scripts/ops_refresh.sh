#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence
mkdir -p logs

exec 9>/tmp/rental_intelligence_ops_refresh.lock
if ! flock -n 9; then
  echo "===== $(date -Is) ops_refresh already running; exiting ====="
  exit 0
fi

run_required() {
  echo
  echo "===== $(date -Is) running $* ====="
  docker compose exec -T cockpit "$@"
}

echo "===== $(date -Is) starting ops_refresh ====="

run_required python -m rental_intel.scripts.extract_bookings
run_required python -m rental_intel.scripts.build_metrics
run_required python -m rental_intel.scripts.sync_cleaning_reservations
run_required python -m rental_intel.cleaning.create_requests_from_reservations
run_required python -m rental_intel.cleaning.enqueue_mission_offer_messages
run_required python -m rental_intel.cleaning.send_pending_outbound_messages

echo "===== $(date -Is) ops_refresh complete ====="
