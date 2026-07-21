#!/usr/bin/env bash
set -euo pipefail
cd /opt/rental-intelligence
LOG_FILE="${AIRBNB_REVIEWS_LOG_FILE:-/opt/rental-intelligence/outputs/logs/airbnb_reviews_cron.log}"
LOCK_FILE="${AIRBNB_REVIEWS_LOCK_FILE:-/tmp/pilotys-airbnb-reviews.lock}"
mkdir -p "$(dirname "$LOG_FILE")"
{
  echo "=== $(date -Is) Airbnb review sync ==="
  flock -n 9 || { echo "Another sync is running; exiting."; exit 0; }
  python scripts/sync_airbnb_reviews.py --modified-from "$(date -u -d '3 days ago' +%Y-%m-%dT%H:%M:%SZ)" --max-pages 20
} 9>"$LOCK_FILE" >>"$LOG_FILE" 2>&1
