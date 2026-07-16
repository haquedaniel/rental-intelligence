#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"; PKG="$(cd "$(dirname "$0")" && pwd)"; TS="$(date +%Y%m%d-%H%M%S)"; BACKUP="$ROOT/.pilotys-backups/automatic-pricing-publication-v8-$TS"
[ -d "$ROOT/src/rental_intel" ] && [ -d "$ROOT/apps/cleaner-web" ] || { echo "Run from the rental-intelligence repository root."; exit 1; }
mkdir -p "$BACKUP"
install_file(){ src="$1"; dst="$2"; mkdir -p "$(dirname "$dst")"; if [ -f "$dst" ]; then mkdir -p "$BACKUP/$(dirname "${dst#$ROOT/}")"; cp "$dst" "$BACKUP/${dst#$ROOT/}"; fi; cp "$src" "$dst"; }
install_file "$PKG/backend/rental_intel/pricing/engine.py" "$ROOT/src/rental_intel/pricing/engine.py"
install_file "$PKG/backend/rental_intel/pricing/publisher.py" "$ROOT/src/rental_intel/pricing/publisher.py"
install_file "$PKG/backend/rental_intel/scripts/regenerate_pricing.py" "$ROOT/src/rental_intel/scripts/regenerate_pricing.py"
install_file "$PKG/backend/rental_intel/scripts/publish_pricing.py" "$ROOT/src/rental_intel/scripts/publish_pricing.py"
install_file "$PKG/frontend/components/pricing/PricingDashboard.tsx" "$ROOT/apps/cleaner-web/components/pricing/PricingDashboard.tsx"
install_file "$PKG/frontend/components/pricing/PricingDashboard.module.css" "$ROOT/apps/cleaner-web/components/pricing/PricingDashboard.module.css"
install_file "$PKG/frontend/components/pricing/PricingSettingsForm.tsx" "$ROOT/apps/cleaner-web/components/pricing/PricingSettingsForm.tsx"
install_file "$PKG/frontend/components/pricing/PublicationStatusPanel.tsx" "$ROOT/apps/cleaner-web/components/pricing/PublicationStatusPanel.tsx"
install_file "$PKG/frontend/app/admin/pricing/actions.ts" "$ROOT/apps/cleaner-web/app/admin/pricing/actions.ts"
install_file "$PKG/frontend/app/owner/[ownerToken]/pricing/actions.ts" "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/pricing/actions.ts"
install_file "$PKG/scripts/pricing_daily_cron.sh" "$ROOT/scripts/pricing_daily_cron.sh"
install_file "$PKG/scripts/pricing_publish_cron.sh" "$ROOT/scripts/pricing_publish_cron.sh"
install_file "$PKG/scripts/install_pricing_cron.sh" "$ROOT/scripts/install_pricing_cron.sh"
install_file "$PKG/migration/20260716130000_automatic_pricing_publication.sql" "$ROOT/supabase/migrations/20260716130000_automatic_pricing_publication.sql"
chmod +x "$ROOT/scripts/pricing_daily_cron.sh" "$ROOT/scripts/pricing_publish_cron.sh" "$ROOT/scripts/install_pricing_cron.sh"
python -m py_compile "$ROOT/src/rental_intel/pricing/engine.py" "$ROOT/src/rental_intel/pricing/publisher.py" "$ROOT/src/rental_intel/scripts/regenerate_pricing.py" "$ROOT/src/rental_intel/scripts/publish_pricing.py"
echo "Installed automatic pricing publication v8. Backup: $BACKUP"
echo "Next: supabase db push && docker compose up -d --build"
