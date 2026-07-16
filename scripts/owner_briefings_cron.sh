#!/usr/bin/env bash
set -euo pipefail
cd /opt/rental-intelligence
LOG_FILE="${OWNER_BRIEFINGS_LOG_FILE:-/opt/rental-intelligence/outputs/logs/owner_briefings.log}"
LOCK_FILE="${OWNER_BRIEFINGS_LOCK_FILE:-/tmp/pilotys-owner-briefings.lock}"
mkdir -p "$(dirname "$LOG_FILE")"
exec 9>"$LOCK_FILE"; flock -n 9 || exit 0
{
 echo; echo "===== $(date -Is) owner decisions and briefings ====="
 docker compose exec -T cockpit python -m rental_intel.scripts.sync_ops_decisions
 docker compose exec -T cockpit python -m rental_intel.scripts.generate_owner_briefings
 docker compose exec -T -e SMS_MESSAGE_TYPES=owner_briefing -e SMS_SEND_ENABLED="${SMS_SEND_ENABLED:-true}" cockpit bash -lc '
  unset CLEANING_SMS_PROPERTY_IDS SMS_MESSAGE_TYPE_PREFIXES
  python -m rental_intel.cleaning.send_pending_outbound_messages
' 
 echo "===== $(date -Is) complete ====="
} >> "$LOG_FILE" 2>&1
