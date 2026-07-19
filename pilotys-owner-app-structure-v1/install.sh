#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-app-structure-v1-$STAMP"

files=(
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/cockpit/page.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/pricing/page.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/pricing/settings/page.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/operations/page.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/operations/payments/page.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/admin/page.tsx"
  "apps/cleaner-web/components/owner/OwnerBottomNav.tsx"
  "apps/cleaner-web/app/admin/page.tsx"
)

for rel in "${files[@]}"; do
  mkdir -p "$ROOT/$(dirname "$rel")" "$BACKUP/$(dirname "$rel")"
  if [ -f "$ROOT/$rel" ]; then cp "$ROOT/$rel" "$BACKUP/$rel"; fi
  cp "$SRC/$rel" "$ROOT/$rel"
done

echo "Installed Pilotys owner app structure v1"
echo "Backup: $BACKUP"
echo
echo "Build:"
echo "  docker compose up -d --build cleaner-web"
