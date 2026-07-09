#!/usr/bin/env bash
set -euo pipefail

if [ ! -d "apps/cleaner-web/app" ]; then
  echo "ERROR: apps/cleaner-web/app not found. Run this from the rental-intelligence repo root." >&2
  exit 1
fi

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="apps/cleaner-web"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".pilotys-backups/owner-cockpit-v10-$STAMP"

mkdir -p "$BACKUP_DIR"

backup_if_exists() {
  local path="$1"
  if [ -e "$path" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$path")"
    cp -R "$path" "$BACKUP_DIR/$path"
  fi
}

backup_if_exists "$APP_DIR/app/owner/[ownerToken]/cockpit"
backup_if_exists "$APP_DIR/app/owner/cockpit/page.tsx"
backup_if_exists "$APP_DIR/public/pilotys-assets"
backup_if_exists "$APP_DIR/public/owner/cockpit"

mkdir -p "$APP_DIR/app/owner/[ownerToken]/cockpit"
mkdir -p "$APP_DIR/app/owner/cockpit"
mkdir -p "$APP_DIR/public/pilotys-assets"
mkdir -p "$APP_DIR/public/owner/cockpit"

cp -R "$PACKAGE_DIR/apps/cleaner-web/app/owner/[ownerToken]/cockpit/"* "$APP_DIR/app/owner/[ownerToken]/cockpit/"
cp "$PACKAGE_DIR/apps/cleaner-web/app/owner/cockpit/page.tsx" "$APP_DIR/app/owner/cockpit/page.tsx"
cp -R "$PACKAGE_DIR/apps/cleaner-web/public/pilotys-assets/"* "$APP_DIR/public/pilotys-assets/"
cp -R "$PACKAGE_DIR/apps/cleaner-web/public/owner/cockpit/"* "$APP_DIR/public/owner/cockpit/"

echo "Installed v10 into $APP_DIR"
echo "Backup, if any: $BACKUP_DIR"
echo
echo "Check routes with:"
echo "  find apps/cleaner-web/app -path '*owner*cockpit*page.tsx' -print"
echo
echo "Then build with your usual command, for example:"
echo "  npm run build --workspace apps/cleaner-web"
echo "or your Docker compose build command."
