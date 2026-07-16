#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$ROOT/src/rental_intel/decisions/sync.py"

if [ ! -f "$TARGET" ]; then
  echo "Run this from the rental-intelligence repository root."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-decisions-payload-fix-$STAMP"
mkdir -p "$BACKUP/src/rental_intel/decisions"
cp "$TARGET" "$BACKUP/src/rental_intel/decisions/sync.py"
cp "$SRC/src/rental_intel/decisions/sync.py" "$TARGET"

python -m py_compile "$TARGET"

echo "Installed owner decision payload compatibility fix."
echo "Backup: $BACKUP"
