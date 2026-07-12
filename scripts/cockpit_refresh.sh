#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence
mkdir -p logs

OPS_SCRIPT_NAME="cockpit_refresh"
source scripts/lib/ops_event_log.sh

exec 9>/tmp/rental_intelligence_cockpit_refresh.lock
if ! flock -n 9; then
  echo "===== $(date -Is) cockpit_refresh already running; exiting ====="
  ops_event_skipped "Another cockpit_refresh run is already holding the lock."
  exit 0
fi

ops_event_start
ops_event_install_trap

run_optional() {
  echo
  echo "===== $(date -Is) running $* ====="
  if ! docker compose exec -T cockpit "$@"; then
    echo "WARNING: optional step failed: $*"
    ops_event_step_failed "$*"
  fi
}

echo "===== $(date -Is) starting cockpit_refresh ====="

run_optional python -m rental_intel.scripts.extract_availability
run_optional python -m rental_intel.scripts.extract_gap_offers
run_optional python -m rental_intel.scripts.build_forward_position

if docker compose exec -T cockpit test -f /app/outputs/processed/future_offers.csv; then
  run_optional python -m rental_intel.scripts.build_recommendations
else
  echo "===== $(date -Is) skipping build_recommendations: missing /app/outputs/processed/future_offers.csv ====="
fi

run_optional python -m rental_intel.scripts.build_data_quality_report

echo
echo "===== $(date -Is) syncing analytics CSVs to Supabase ====="
run_optional python -m rental_intel.analytics.sync_csv_to_supabase
run_optional python -m rental_intel.analytics.sync_listing_targets_to_supabase

echo
echo "===== $(date -Is) restarting cockpit container ====="
docker compose restart cockpit

echo "===== $(date -Is) cockpit_refresh complete ====="
ops_event_mark_complete
