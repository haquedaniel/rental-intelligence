#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/pricing-ui-journal-v4-$STAMP"
FILES=(
  "apps/cleaner-web/components/pricing/PricingDashboard.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/activity/page.tsx"
  "src/rental_intel/decisions/sync.py"
  "src/rental_intel/decisions/situations.py"
  "src/rental_intel/decisions/briefings.py"
  "supabase/migrations/20260717133000_owner_journal_corrective_v4.sql"
)
for rel in "${FILES[@]}"; do
  mkdir -p "$ROOT/$(dirname "$rel")" "$BACKUP/$(dirname "$rel")"
  if [ -f "$ROOT/$rel" ]; then cp "$ROOT/$rel" "$BACKUP/$rel"; fi
  cp "$SRC/$rel" "$ROOT/$rel"
done
python -m py_compile \
  "$ROOT/src/rental_intel/decisions/sync.py" \
  "$ROOT/src/rental_intel/decisions/situations.py" \
  "$ROOT/src/rental_intel/decisions/briefings.py"
echo "Installed corrective v4. Backup: $BACKUP"
echo "Next: supabase db push && docker compose up -d --build cockpit cleaner-web"
echo "Then: docker compose exec -T cockpit python -m rental_intel.scripts.build_ops_situations"
