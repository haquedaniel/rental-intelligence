#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

required=(
  "src/rental_intel/decisions/briefings.py"
  "src/rental_intel/decisions/sync.py"
)

for file in "${required[@]}"; do
  if [ ! -f "$ROOT/$file" ]; then
    echo "Missing $file. Install the owner decisions/briefings package first."
    exit 1
  fi
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/situation-builder-v1-$STAMP"
mkdir -p "$BACKUP"

copy_file() {
  local rel="$1"
  mkdir -p "$ROOT/$(dirname "$rel")"
  cp "$SRC/$rel" "$ROOT/$rel"
}

copy_file "src/rental_intel/decisions/situations.py"
copy_file "src/rental_intel/scripts/build_ops_situations.py"
copy_file "supabase/migrations/20260717010000_ops_situations.sql"

python -m py_compile \
  "$ROOT/src/rental_intel/decisions/situations.py" \
  "$ROOT/src/rental_intel/scripts/build_ops_situations.py"

echo "Installed Pilotys situation builder v1."
echo
echo "Next:"
echo "  supabase db push"
echo "  docker compose up -d --build cockpit"
echo "  docker compose exec -T cockpit python -m rental_intel.scripts.build_ops_situations"
