#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"; PKG="$(cd "$(dirname "$0")" && pwd)"
[ -d "$ROOT/src/rental_intel" ] && [ -d "$ROOT/apps/cleaner-web/app" ] || { echo "Run from the rental-intelligence repository root."; exit 1; }
STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP="$ROOT/.pilotys-backups/pricing-temporality-mobile-v7-$STAMP"; mkdir -p "$BACKUP"
copy(){ local src="$1" dst="$2"; mkdir -p "$(dirname "$dst")"; if [ -e "$dst" ]; then mkdir -p "$BACKUP/$(dirname "${dst#$ROOT/}")"; cp -a "$dst" "$BACKUP/${dst#$ROOT/}"; fi; cp "$src" "$dst"; echo "Installed ${dst#$ROOT/}"; }
copy "$PKG/backend/rental_intel/pricing/engine.py" "$ROOT/src/rental_intel/pricing/engine.py"
for f in PricingDashboard.tsx PricingDashboard.module.css ExplainablePricingCalendar.tsx; do copy "$PKG/frontend/components/pricing/$f" "$ROOT/apps/cleaner-web/components/pricing/$f"; done
python -m py_compile "$ROOT/src/rental_intel/pricing/engine.py"
echo "Installed. Backup: $BACKUP"
echo "Next: docker compose up -d --build cockpit pricing-api cleaner-web"
