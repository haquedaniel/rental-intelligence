#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$ROOT/src/rental_intel/pricing/publisher.py"
if [ ! -f "$TARGET" ]; then
  echo "Run this installer from the rental-intelligence repository root." >&2
  exit 1
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/pricing-publication-counter-fix-v14-$STAMP"
mkdir -p "$BACKUP"
cp "$TARGET" "$BACKUP/publisher.py"
cp "$SRC_DIR/src/rental_intel/pricing/publisher.py" "$TARGET"
python -m py_compile "$TARGET"
echo "Installed publication counter fix v14."
echo "Backup: $BACKUP"
