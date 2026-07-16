#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

required=(
  "src/rental_intel/decisions/briefings.py"
  "src/rental_intel/scripts/generate_owner_briefings.py"
  "apps/cleaner-web/app/owner/[ownerToken]/activity/page.tsx"
  "apps/cleaner-web/app/owner/[ownerToken]/activity/actions.ts"
)

for file in "${required[@]}"; do
  if [ ! -f "$ROOT/$file" ]; then
    echo "Missing $file. Run from the current rental-intelligence repository root."
    exit 1
  fi
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-activity-briefings-v3-$STAMP"
mkdir -p "$BACKUP"

copy_file() {
  local rel="$1"
  mkdir -p "$BACKUP/$(dirname "$rel")" "$ROOT/$(dirname "$rel")"
  if [ -f "$ROOT/$rel" ]; then cp "$ROOT/$rel" "$BACKUP/$rel"; fi
  cp "$SRC/$rel" "$ROOT/$rel"
}

copy_file "src/rental_intel/decisions/briefings.py"
copy_file "src/rental_intel/scripts/generate_owner_briefings.py"
copy_file "apps/cleaner-web/app/owner/[ownerToken]/activity/page.tsx"
copy_file "apps/cleaner-web/app/owner/[ownerToken]/activity/actions.ts"
copy_file "apps/cleaner-web/components/owner/activity/BriefingPreferencesForm.tsx"
copy_file "apps/cleaner-web/components/owner/activity/BriefingPreviewRequest.tsx"
copy_file "supabase/migrations/20260716190000_owner_activity_briefing_preview.sql"

python -m py_compile \
  "$ROOT/src/rental_intel/decisions/briefings.py" \
  "$ROOT/src/rental_intel/scripts/generate_owner_briefings.py"

echo "Installed owner Activity / Briefings v3."
echo "Backup: $BACKUP"
echo
echo "Next:"
echo "  supabase db push"
echo "  docker compose up -d --build cockpit cleaner-web"
