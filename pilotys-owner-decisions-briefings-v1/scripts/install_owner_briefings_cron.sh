#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/rental-intelligence
cat >/etc/cron.d/pilotys-owner-briefings <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/10 * * * * ubuntu $ROOT/scripts/owner_briefings_cron.sh
EOF
chmod 644 /etc/cron.d/pilotys-owner-briefings
systemctl reload cron 2>/dev/null || systemctl restart cron
cat /etc/cron.d/pilotys-owner-briefings
