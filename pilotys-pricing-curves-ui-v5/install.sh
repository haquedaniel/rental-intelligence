#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"; PKG="$(cd "$(dirname "$0")" && pwd)"
[ -d "$ROOT/src/rental_intel" ] && [ -d "$ROOT/apps/cleaner-web/app" ] || { echo "Run from the rental-intelligence repository root."; exit 1; }
STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP="$ROOT/.pilotys-backups/pricing-curves-ui-v5-$STAMP"; mkdir -p "$BACKUP"
copy(){ local src="$1" dst="$2"; mkdir -p "$(dirname "$dst")"; if [ -e "$dst" ]; then mkdir -p "$BACKUP/$(dirname "${dst#$ROOT/}")"; cp -a "$dst" "$BACKUP/${dst#$ROOT/}"; fi; cp "$src" "$dst"; echo "Installed ${dst#$ROOT/}"; }
copy "$PKG/backend/rental_intel/pricing/engine.py" "$ROOT/src/rental_intel/pricing/engine.py"
for f in CurvePresetSelector.tsx SubmitStatusButton.tsx PricingSettingsForm.tsx SeasonEditor.tsx PricingDashboard.tsx PricingVersionPanel.tsx; do copy "$PKG/frontend/components/pricing/$f" "$ROOT/apps/cleaner-web/components/pricing/$f"; done
copy "$PKG/frontend/app/admin/pricing/actions.ts" "$ROOT/apps/cleaner-web/app/admin/pricing/actions.ts"
copy "$PKG/frontend/app/owner/[ownerToken]/pricing/actions.ts" "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/pricing/actions.ts"
copy "$PKG/migration/20260716022000_pricing_curve_presets.sql" "$ROOT/supabase/migrations/20260716022000_pricing_curve_presets.sql"
python -m py_compile "$ROOT/src/rental_intel/pricing/engine.py"
echo
echo "Installed. Backup: $BACKUP"
echo "Next: supabase db push && docker compose up -d --build"
