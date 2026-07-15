#!/usr/bin/env bash
set -euo pipefail
cd /opt/rental-intelligence
OPS_SCRIPT_NAME="pricing_refresh"
source scripts/lib/ops_event_log.sh
exec 9>/tmp/rental_intelligence_pricing_refresh.lock
if ! flock -n 9; then ops_event_skipped "Another pricing_refresh run is active."; exit 0; fi
ops_event_start; ops_event_install_trap
docker compose exec -T cockpit python -m rental_intel.scripts.regenerate_pricing
if [ "${PRICING_PUBLISH_ENABLED:-false}" = "true" ]; then
  docker compose exec -T cockpit python -m rental_intel.scripts.publish_pricing --limit "${PRICING_PUBLISH_LIMIT:-100}"
fi
ops_event_mark_complete
