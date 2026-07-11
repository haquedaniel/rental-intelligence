#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence

PROPERTY_IDS="${BEDS24_MESSAGE_PROPERTY_IDS:-330389,331524}"
MAX_PAGES="${BEDS24_MESSAGE_MAX_PAGES:-10}"
DRY_RUN="${BEDS24_MESSAGE_DRY_RUN:-false}"
LOG_FILE="${BEDS24_MESSAGES_LOG_FILE:-/opt/rental-intelligence/outputs/logs/beds24_messages_cron.log}"
LOCK_FILE="${BEDS24_MESSAGES_LOCK_FILE:-/tmp/rental-beds24-messages-cron.lock}"

mkdir -p "$(dirname "$LOG_FILE")"

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

{
  echo
  echo "===== $(date -Is) Beds24 messages sync start ====="
  echo "BEDS24_MESSAGE_PROPERTY_IDS: $PROPERTY_IDS"
  echo "BEDS24_MESSAGE_MAX_PAGES: $MAX_PAGES"
  echo "BEDS24_MESSAGE_DRY_RUN: $DRY_RUN"

  if [ ! -f scripts/sync_beds24_reservation_messages.py ]; then
    echo "Missing scripts/sync_beds24_reservation_messages.py"
    exit 1
  fi

  IFS=',' read -r -a PROPERTY_ARRAY <<< "$PROPERTY_IDS"

  for raw_property_id in "${PROPERTY_ARRAY[@]}"; do
    property_id="$(echo "$raw_property_id" | xargs)"
    if [ -z "$property_id" ]; then
      continue
    fi

    echo
    echo "===== $(date -Is) syncing Beds24 messages for property_id=$property_id ====="

    case "${DRY_RUN,,}" in
      1|true|yes)
        docker compose exec -T cockpit bash -lc "cd /app && python scripts/sync_beds24_reservation_messages.py --property-id '$property_id' --max-pages '$MAX_PAGES' --dry-run"
        ;;
      *)
        docker compose exec -T cockpit bash -lc "cd /app && python scripts/sync_beds24_reservation_messages.py --property-id '$property_id' --max-pages '$MAX_PAGES'"
        ;;
    esac
  done

  if [ -f scripts/generate_reservation_operational_context.py ]; then
    echo
    echo "===== $(date -Is) regenerating reservation operational context ====="
    docker compose exec -T cockpit bash -lc "cd /app && python scripts/generate_reservation_operational_context.py"
  else
    echo
    echo "===== $(date -Is) skipping operational context: scripts/generate_reservation_operational_context.py not found ====="
  fi

  echo "===== $(date -Is) Beds24 messages sync complete ====="
} >> "$LOG_FILE" 2>&1
