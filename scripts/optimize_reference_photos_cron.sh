#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence

LIMIT="${PHOTO_OPTIMIZE_LIMIT:-20}"
LOG_FILE="${PHOTO_OPTIMIZE_LOG_FILE:-/opt/rental-intelligence/outputs/logs/optimize_reference_photos.log}"
LOCK_FILE="${PHOTO_OPTIMIZE_LOCK_FILE:-/tmp/rental-optimize-reference-photos.lock}"

mkdir -p "$(dirname "$LOG_FILE")"

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

{
  echo
  echo "===== $(date -Is) reference photo optimization start ====="
  echo "PHOTO_OPTIMIZE_LIMIT: $LIMIT"

  docker compose exec -T cockpit bash -lc \
    "cd /app && python -m rental_intel.scripts.optimize_property_reference_photos --limit $LIMIT"

  echo "===== $(date -Is) reference photo optimization end ====="
} >> "$LOG_FILE" 2>&1
