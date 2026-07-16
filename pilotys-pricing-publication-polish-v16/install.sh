#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"; PKG="$(cd "$(dirname "$0")" && pwd)"; TS="$(date +%Y%m%d-%H%M%S)"; BACKUP="$ROOT/.pilotys-backups/pricing-publication-polish-v16-$TS"
[ -d "$ROOT/src/rental_intel" ] && [ -d "$ROOT/apps/cleaner-web" ] || { echo "Run from the rental-intelligence repository root."; exit 1; }
install_file(){ src="$1"; dst="$2"; if [ -e "$dst" ]; then mkdir -p "$BACKUP/$(dirname "${dst#$ROOT/}")"; cp -a "$dst" "$BACKUP/${dst#$ROOT/}"; fi; mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"; echo "Installed ${dst#$ROOT/}"; }
install_file "$PKG/src/rental_intel/pricing/engine.py" "$ROOT/src/rental_intel/pricing/engine.py"
install_file "$PKG/src/rental_intel/pricing/publisher.py" "$ROOT/src/rental_intel/pricing/publisher.py"
install_file "$PKG/apps/cleaner-web/components/pricing/PublicationStatusPanel.tsx" "$ROOT/apps/cleaner-web/components/pricing/PublicationStatusPanel.tsx"
install_file "$PKG/apps/cleaner-web/components/pricing/PricingSettingsForm.tsx" "$ROOT/apps/cleaner-web/components/pricing/PricingSettingsForm.tsx"
install_file "$PKG/apps/cleaner-web/app/admin/pricing/actions.ts" "$ROOT/apps/cleaner-web/app/admin/pricing/actions.ts"
install_file "$PKG/apps/cleaner-web/app/owner/[ownerToken]/pricing/actions.ts" "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/pricing/actions.ts"
install_file "$PKG/supabase/migrations/20260716160000_pricing_publication_polish.sql" "$ROOT/supabase/migrations/20260716160000_pricing_publication_polish.sql"
python -m py_compile "$ROOT/src/rental_intel/pricing/engine.py" "$ROOT/src/rental_intel/pricing/publisher.py"
echo "Installed pricing publication polish v16. Backup: $BACKUP"
echo "Next: supabase db push && docker compose up -d --build cockpit pricing-api cleaner-web"
