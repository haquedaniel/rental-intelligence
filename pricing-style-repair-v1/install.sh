#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$ROOT/apps/cleaner-web/components/pricing/PricingVersionPanel.tsx"
SOURCE="$PACKAGE_DIR/frontend/components/pricing/PricingVersionPanel.tsx"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/pricing-style-repair-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web" ]; then
  echo "Run this installer from the rental-intelligence repository root." >&2
  exit 1
fi

mkdir -p "$BACKUP"
if [ -f "$TARGET" ]; then
  mkdir -p "$(dirname "$BACKUP/${TARGET#$ROOT/}")"
  cp "$TARGET" "$BACKUP/${TARGET#$ROOT/}"
fi

mkdir -p "$(dirname "$TARGET")"
cp "$SOURCE" "$TARGET"

echo "Installed server-compatible PricingVersionPanel.tsx"
echo "Backup: $BACKUP"
echo "Now run: cd apps/cleaner-web && npm run build"
