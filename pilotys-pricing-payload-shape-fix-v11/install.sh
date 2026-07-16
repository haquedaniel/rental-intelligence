#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$ROOT/src/rental_intel/pricing/publisher.py"
SOURCE="$PACKAGE_DIR/src/rental_intel/pricing/publisher.py"

if [ ! -d "$ROOT/src/rental_intel" ]; then
  echo "Run this installer from the rental-intelligence repository root." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/pricing-payload-shape-fix-v11-$STAMP"
mkdir -p "$BACKUP/src/rental_intel/pricing"
if [ -f "$TARGET" ]; then
  cp "$TARGET" "$BACKUP/src/rental_intel/pricing/publisher.py"
fi
cp "$SOURCE" "$TARGET"
python -m py_compile "$TARGET"
echo "Installed pricing publication payload-shape fix v11."
echo "Backup: $BACKUP"
