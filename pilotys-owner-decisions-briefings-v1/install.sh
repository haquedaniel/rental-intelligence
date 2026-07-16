#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"; SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -d "$ROOT/src/rental_intel" ] && [ -d "$ROOT/apps/cleaner-web" ] || { echo "Run from repository root"; exit 1; }
STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP="$ROOT/.pilotys-backups/owner-decisions-briefings-$STAMP"; mkdir -p "$BACKUP"
for path in src/rental_intel/decisions src/rental_intel/scripts/sync_ops_decisions.py src/rental_intel/scripts/generate_owner_briefings.py apps/cleaner-web/app/owner/'[ownerToken]'/activity apps/cleaner-web/components/owner/OwnerBottomNav.tsx scripts/owner_briefings_cron.sh scripts/install_owner_briefings_cron.sh; do if [ -e "$ROOT/$path" ]; then mkdir -p "$BACKUP/$(dirname "$path")"; cp -R "$ROOT/$path" "$BACKUP/$path"; fi; done
cp -R "$SRC/src/rental_intel/decisions" "$ROOT/src/rental_intel/"
cp "$SRC/src/rental_intel/scripts/"*.py "$ROOT/src/rental_intel/scripts/"
mkdir -p "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/activity"; cp "$SRC/apps/cleaner-web/app/owner/[ownerToken]/activity/"* "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/activity/"
cp "$SRC/apps/cleaner-web/components/owner/OwnerBottomNav.tsx" "$ROOT/apps/cleaner-web/components/owner/OwnerBottomNav.tsx"
cp "$SRC/scripts/"*.sh "$ROOT/scripts/"; chmod +x "$ROOT/scripts/owner_briefings_cron.sh" "$ROOT/scripts/install_owner_briefings_cron.sh"
cp "$SRC/supabase/migrations/20260716183000_owner_decisions_briefings.sql" "$ROOT/supabase/migrations/"
python -m py_compile "$ROOT/src/rental_intel/decisions/"*.py "$ROOT/src/rental_intel/scripts/sync_ops_decisions.py" "$ROOT/src/rental_intel/scripts/generate_owner_briefings.py"
echo "Installed owner decisions + briefings. Backup: $BACKUP"
echo "Next: supabase db push; docker compose up -d --build cockpit cleaner-web; sudo bash scripts/install_owner_briefings_cron.sh"
