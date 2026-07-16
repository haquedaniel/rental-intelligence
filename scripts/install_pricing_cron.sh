#!/usr/bin/env bash
set -euo pipefail
ROOT="${ROOT:-/opt/rental-intelligence}"
CRON_FILE="/etc/cron.d/pilotys-pricing"
if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo: sudo bash scripts/install_pricing_cron.sh"; exit 1; fi
cat > "$CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Recalculate all enabled calendars daily. The same run publishes its first safe batch.
15 4 * * * ubuntu $ROOT/scripts/pricing_daily_cron.sh
# Drain changed live prices automatically in API-safe batches.
*/10 * * * * ubuntu $ROOT/scripts/pricing_publish_cron.sh
EOF
chmod 0644 "$CRON_FILE"
echo "Installed $CRON_FILE"
cat "$CRON_FILE"
