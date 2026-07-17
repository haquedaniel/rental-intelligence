#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REL='apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerPricingCalendar.tsx'
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-pricing-calendar-production-v4-$STAMP"
if [ ! -f "$ROOT/$REL" ]; then
  echo "Missing $REL"
  exit 1
fi
mkdir -p "$BACKUP/$(dirname "$REL")"
cp "$ROOT/$REL" "$BACKUP/$REL"
cp "$SRC/$REL" "$ROOT/$REL"
echo "Installed pricing calendar production v4."
echo "Backup: $BACKUP"
echo "Rebuild with: docker compose up -d --build cleaner-web"
