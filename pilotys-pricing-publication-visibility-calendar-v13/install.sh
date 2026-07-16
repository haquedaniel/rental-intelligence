#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/pricing-publication-visibility-calendar-v13-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web/app" ]; then
  echo "Run this installer from the rental-intelligence repository root." >&2
  exit 1
fi

backup_and_copy() {
  local source="$1" target="$2"
  if [ -e "$target" ]; then
    mkdir -p "$BACKUP/$(dirname "${target#$ROOT/}")"
    cp -a "$target" "$BACKUP/${target#$ROOT/}"
  fi
  mkdir -p "$(dirname "$target")"
  cp "$source" "$target"
  echo "Installed ${target#$ROOT/}"
}

backup_and_copy "$PACKAGE_ROOT/frontend/components/pricing/PublicationStatusPanel.tsx" "$ROOT/apps/cleaner-web/components/pricing/PublicationStatusPanel.tsx"
backup_and_copy "$PACKAGE_ROOT/frontend/components/pricing/ExplainablePricingCalendar.tsx" "$ROOT/apps/cleaner-web/components/pricing/ExplainablePricingCalendar.tsx"
backup_and_copy "$PACKAGE_ROOT/frontend/components/pricing/PricingDashboard.tsx" "$ROOT/apps/cleaner-web/components/pricing/PricingDashboard.tsx"
backup_and_copy "$PACKAGE_ROOT/frontend/app/admin/pricing/page.tsx" "$ROOT/apps/cleaner-web/app/admin/pricing/page.tsx"
backup_and_copy "$PACKAGE_ROOT/frontend/app/owner/[ownerToken]/pricing/page.tsx" "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/pricing/page.tsx"

echo
echo "Installed publication progress and reservation calendar v13."
echo "No migration or Python rebuild is required."
echo "Run: docker compose up -d --build cleaner-web"
