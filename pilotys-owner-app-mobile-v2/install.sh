#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-app-mobile-v2-$STAMP"
FILES=(
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerPricingCalendar.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/types.ts"
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/data.ts"
  "apps/cleaner-web/components/owner/OwnerBottomNav.tsx"
)
for REL in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$REL")"
  [ ! -f "$ROOT/$REL" ] || cp "$ROOT/$REL" "$BACKUP/$REL"
  mkdir -p "$ROOT/$(dirname "$REL")"
  cp "$SRC/$REL" "$ROOT/$REL"
done
echo "Installed Pilotys Owner App Mobile UX v2."
echo "Backup: $BACKUP"
echo "Rebuild with: docker compose up -d --build cleaner-web"
