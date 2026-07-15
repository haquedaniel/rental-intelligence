#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(pwd)"
PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$REPO_ROOT/src/rental_intel/pricing/engine.py"
SOURCE="$PACKAGE_ROOT/backend/rental_intel/pricing/engine.py"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$REPO_ROOT/.pilotys-backups/pricing-recovery-repair-$STAMP"

if [ ! -d "$REPO_ROOT/src/rental_intel" ] || [ ! -d "$REPO_ROOT/apps/cleaner-web" ]; then
  echo "ERROR: run this from the rental-intelligence repository root."
  exit 1
fi

if [ ! -f "$SOURCE" ]; then
  echo "ERROR: missing package source: $SOURCE"
  exit 1
fi

mkdir -p "$(dirname "$TARGET")"
if [ -f "$TARGET" ]; then
  mkdir -p "$BACKUP_ROOT/src/rental_intel/pricing"
  cp "$TARGET" "$BACKUP_ROOT/src/rental_intel/pricing/engine.py"
  echo "Backed up existing engine to: $BACKUP_ROOT"
fi

cp "$SOURCE" "$TARGET"
python -m py_compile "$TARGET"

echo "Installed pricing engine recovery repair:"
echo "  $TARGET"
echo
echo "No SQL or frontend changes are required."
echo "Commit/deploy this file, restart cockpit, then rerun regenerate_pricing."
