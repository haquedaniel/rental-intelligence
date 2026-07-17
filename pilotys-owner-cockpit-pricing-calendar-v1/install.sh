#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-cockpit-pricing-calendar-v1-$STAMP"
FILES=(
  'apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx'
  'apps/cleaner-web/app/owner/[ownerToken]/cockpit/data.ts'
  'apps/cleaner-web/app/owner/[ownerToken]/cockpit/types.ts'
  'apps/cleaner-web/components/pricing/ExplainablePricingCalendar.tsx'
)
for rel in "${FILES[@]}"; do
  if [ ! -f "$ROOT/$rel" ]; then echo "Missing $rel"; exit 1; fi
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp "$ROOT/$rel" "$BACKUP/$rel"
  cp "$SRC/$rel" "$ROOT/$rel"
done
echo "Installed owner cockpit pricing calendar v1"
echo "Backup: $BACKUP"
echo "Rebuild with: docker compose up -d --build cleaner-web"
