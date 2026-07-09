#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/owner-cockpit-v37-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web/app" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web/app to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if [ -d "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/cockpit" ]; then
  mkdir -p "$BACKUP_DIR/apps/cleaner-web/app/owner/[ownerToken]"
  cp -R "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/cockpit" "$BACKUP_DIR/apps/cleaner-web/app/owner/[ownerToken]/"
fi

if [ -d "$ROOT/apps/cleaner-web/app/owner/cockpit" ]; then
  mkdir -p "$BACKUP_DIR/apps/cleaner-web/app/owner"
  cp -R "$ROOT/apps/cleaner-web/app/owner/cockpit" "$BACKUP_DIR/apps/cleaner-web/app/owner/"
fi

mkdir -p "$ROOT/apps/cleaner-web/app/owner/[ownerToken]"
mkdir -p "$ROOT/apps/cleaner-web/app/owner/cockpit"
mkdir -p "$ROOT/apps/cleaner-web/public/pilotys-assets"
mkdir -p "$ROOT/apps/cleaner-web/public/owner/cockpit"

rm -rf "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/cockpit"
cp -R "$PKG_DIR/apps/cleaner-web/app/owner/[ownerToken]/cockpit" "$ROOT/apps/cleaner-web/app/owner/[ownerToken]/cockpit"

cp "$PKG_DIR/apps/cleaner-web/app/owner/cockpit/page.tsx" "$ROOT/apps/cleaner-web/app/owner/cockpit/page.tsx"
cp -R "$PKG_DIR/apps/cleaner-web/public/pilotys-assets/"* "$ROOT/apps/cleaner-web/public/pilotys-assets/"
cp -R "$PKG_DIR/apps/cleaner-web/public/owner/cockpit/"* "$ROOT/apps/cleaner-web/public/owner/cockpit/"

echo "Installed v37 into apps/cleaner-web"
echo "Backup, if any: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
