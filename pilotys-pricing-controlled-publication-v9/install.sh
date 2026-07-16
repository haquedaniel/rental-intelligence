#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PKG="$(cd "$(dirname "$0")" && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/controlled-pricing-publication-v9-$TS"
[ -d "$ROOT/src/rental_intel" ] && [ -d "$ROOT/apps/cleaner-web" ] || { echo "Run from the rental-intelligence repository root."; exit 1; }
mkdir -p "$BACKUP"
install_file(){ src="$1"; dst="$2"; mkdir -p "$(dirname "$dst")"; if [ -f "$dst" ]; then mkdir -p "$BACKUP/$(dirname "${dst#$ROOT/}")"; cp "$dst" "$BACKUP/${dst#$ROOT/}"; fi; cp "$src" "$dst"; }
install_file "$PKG/src/rental_intel/pricing/publisher.py" "$ROOT/src/rental_intel/pricing/publisher.py"
install_file "$PKG/src/rental_intel/pricing/__init__.py" "$ROOT/src/rental_intel/pricing/__init__.py"
install_file "$PKG/src/rental_intel/scripts/publish_pricing.py" "$ROOT/src/rental_intel/scripts/publish_pricing.py"
install_file "$PKG/apps/cleaner-web/components/pricing/PricingSettingsForm.tsx" "$ROOT/apps/cleaner-web/components/pricing/PricingSettingsForm.tsx"
install_file "$PKG/apps/cleaner-web/components/pricing/PublicationStatusPanel.tsx" "$ROOT/apps/cleaner-web/components/pricing/PublicationStatusPanel.tsx"
install_file "$PKG/apps/cleaner-web/app/admin/pricing/actions.ts" "$ROOT/apps/cleaner-web/app/admin/pricing/actions.ts"
install_file "$PKG/apps/cleaner-web/app/owner/[ownerToken]/pricing/actions.ts" "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/pricing/actions.ts"
python -m py_compile "$ROOT/src/rental_intel/pricing/publisher.py" "$ROOT/src/rental_intel/pricing/__init__.py" "$ROOT/src/rental_intel/scripts/publish_pricing.py"
echo "Installed controlled pricing publication v9. Backup: $BACKUP"
echo "No migration required. Rebuild: docker compose up -d --build cockpit pricing-api cleaner-web"
