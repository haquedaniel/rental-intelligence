#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$ROOT/scripts/lib/ops_event_log.sh"

if [ ! -f "$TARGET" ]; then
  echo "Run this from the rental-intelligence repository root."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/pricing-cron-ops-fix-$STAMP"
mkdir -p "$BACKUP/scripts/lib"
cp "$TARGET" "$BACKUP/scripts/lib/ops_event_log.sh"

cp "$SRC/scripts/lib/ops_event_log.sh" "$TARGET"
chmod +x "$TARGET"

echo "Installed non-blocking ops event logging."
echo "Backup: $BACKUP"
echo
echo "Commit scripts/lib/ops_event_log.sh, deploy, then test:"
echo "  bash -x scripts/pricing_publish_cron.sh"
