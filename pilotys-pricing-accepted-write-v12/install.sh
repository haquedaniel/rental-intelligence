#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(pwd)"
TARGET="$REPO/src/rental_intel/pricing/publisher.py"
SOURCE="$ROOT/src/rental_intel/pricing/publisher.py"

if [ ! -f "$REPO/pyproject.toml" ] || [ ! -d "$REPO/src/rental_intel" ]; then
  echo "Run this installer from the rental-intelligence repository root." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$REPO/.pilotys-backups/pricing-accepted-write-v12-$STAMP"
mkdir -p "$BACKUP"
if [ -f "$TARGET" ]; then
  cp "$TARGET" "$BACKUP/publisher.py"
fi
cp "$SOURCE" "$TARGET"
python -m py_compile "$TARGET"

echo "Installed simplified publication acceptance logic."
echo "Backup: $BACKUP"
echo "Rebuild: docker compose up -d --build cockpit pricing-api"
