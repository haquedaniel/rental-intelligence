#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-pricing-calendar-production-v3-$STAMP"
FILES=(
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerPricingCalendar.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/data.ts"
)
for rel in "${FILES[@]}"; do
  test -f "$ROOT/$rel" || { echo "Missing $rel"; exit 1; }
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp "$ROOT/$rel" "$BACKUP/$rel"
  cp "$SRC/$rel" "$ROOT/$rel"
done
echo "Installed owner pricing calendar production v3."
echo "Backup: $BACKUP"
echo "Rebuild cleaner-web to deploy."
