#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

required=(
  "src/rental_intel/decisions/situations.py"
  "src/rental_intel/decisions/briefings.py"
  "apps/cleaner-web/app/owner/[ownerToken]/activity/page.tsx"
)

for file in "${required[@]}"; do
  if [ ! -f "$ROOT/$file" ]; then
    echo "Missing $file. Install the situation builder and Activity/Briefings packages first."
    exit 1
  fi
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/property-manager-narrative-v2-$STAMP"

copy_file() {
  local rel="$1"
  mkdir -p "$BACKUP/$(dirname "$rel")" "$ROOT/$(dirname "$rel")"
  if [ -f "$ROOT/$rel" ]; then cp "$ROOT/$rel" "$BACKUP/$rel"; fi
  cp "$SRC/$rel" "$ROOT/$rel"
}

copy_file "src/rental_intel/decisions/briefings.py"
copy_file "apps/cleaner-web/app/owner/[ownerToken]/activity/page.tsx"
copy_file "supabase/migrations/20260717013000_briefings_use_situations.sql"

python -m py_compile "$ROOT/src/rental_intel/decisions/briefings.py"

echo "Installed Pilotys property-manager narrative v2."
echo "Backup: $BACKUP"
echo
echo "Next:"
echo "  supabase db push"
echo "  docker compose up -d --build cockpit cleaner-web"
echo "  docker compose exec -T cockpit python -m rental_intel.scripts.build_ops_situations"
