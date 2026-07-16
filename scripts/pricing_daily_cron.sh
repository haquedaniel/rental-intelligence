#!/usr/bin/env bash
set -euo pipefail
cd /opt/rental-intelligence
OPS_SCRIPT_NAME="pricing_daily"
source scripts/lib/ops_event_log.sh
LOG_FILE="${PRICING_DAILY_LOG_FILE:-/opt/rental-intelligence/outputs/logs/pricing_daily.log}"
LOCK_FILE="${PRICING_DAILY_LOCK_FILE:-/tmp/rental-pricing-daily.lock}"
mkdir -p "$(dirname "$LOG_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then ops_event_skipped "Another daily pricing run holds the lock."; exit 0; fi
ops_event_start; ops_event_install_trap
{
 echo; echo "===== $(date -Is) daily pricing recalculation ====="
 docker compose exec -T cockpit python -m rental_intel.scripts.regenerate_pricing
 echo "===== $(date -Is) publishing changed live prices ====="
 docker compose exec -T cockpit python -m rental_intel.scripts.publish_pricing --limit "${PRICING_PUBLICATION_LIMIT:-30}"
 echo "===== $(date -Is) daily pricing run complete ====="
} >>"$LOG_FILE" 2>&1
ops_event_mark_complete
