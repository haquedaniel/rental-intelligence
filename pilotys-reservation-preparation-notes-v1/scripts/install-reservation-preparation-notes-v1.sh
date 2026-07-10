#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/reservation-preparation-notes-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web/app" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web/app to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
mkdir -p "$ROOT/supabase/migrations" "$ROOT/scripts"

cp "$PKG_DIR/supabase/migrations/20260710_reservation_preparation_notes.sql" "$ROOT/supabase/migrations/20260710_reservation_preparation_notes.sql"
cp "$PKG_DIR/scripts/reconcile_prepares_reservation_links.py" "$ROOT/scripts/reconcile_prepares_reservation_links.py"
cp "$PKG_DIR/scripts/patch_reservation_preparation_notes.py" "$ROOT/scripts/patch_reservation_preparation_notes.py"
chmod +x "$ROOT/scripts/reconcile_prepares_reservation_links.py"

python "$ROOT/scripts/patch_reservation_preparation_notes.py"

echo "Installed reservation preparation notes v1"
echo "Migration copied to: supabase/migrations/20260710_reservation_preparation_notes.sql"
echo "Reconciliation script copied to: scripts/reconcile_prepares_reservation_links.py"
echo "Backup: $BACKUP_DIR"
echo ""
echo "After applying SQL, run:"
echo "  python scripts/reconcile_prepares_reservation_links.py --dry-run"
echo "  python scripts/reconcile_prepares_reservation_links.py"
echo ""
echo "Then build:"
echo "  cd apps/cleaner-web && npm run build"
