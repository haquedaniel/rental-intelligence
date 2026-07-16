#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="$ROOT/src/rental_intel/pricing"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/pricing-publication-import-fix-$STAMP"

if [ ! -d "$ROOT/src/rental_intel" ]; then
  echo "Run this installer from the rental-intelligence repository root." >&2
  exit 1
fi

mkdir -p "$TARGET" "$BACKUP"
for file in __init__.py publisher.py; do
  if [ -f "$TARGET/$file" ]; then
    cp "$TARGET/$file" "$BACKUP/$file"
  fi
  cp "$SRC/src/rental_intel/pricing/$file" "$TARGET/$file"
done

python -m py_compile "$TARGET/__init__.py" "$TARGET/publisher.py"
echo "Installed publication import compatibility fix."
echo "Backup: $BACKUP"
