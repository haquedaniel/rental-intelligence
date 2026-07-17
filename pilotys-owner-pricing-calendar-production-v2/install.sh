#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-pricing-calendar-production-v2-$STAMP"
FILES=(
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerPricingCalendar.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/data.ts"
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/types.ts"
)
for rel in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$rel")" "$ROOT/$(dirname "$rel")"
  [ ! -f "$ROOT/$rel" ] || cp "$ROOT/$rel" "$BACKUP/$rel"
  cp "$SRC/$rel" "$ROOT/$rel"
done
echo "Installed. Backup: $BACKUP"
echo "Deploy: docker compose up -d --build cleaner-web"
