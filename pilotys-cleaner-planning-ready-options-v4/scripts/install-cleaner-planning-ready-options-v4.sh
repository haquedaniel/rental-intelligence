#!/usr/bin/env bash
set -euo pipefail

START_DIR="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ -d "$START_DIR/apps/cleaner-web/app" ]; then
  APP_ROOT="$START_DIR/apps/cleaner-web"
  REPO_ROOT="$START_DIR"
elif [ -d "$START_DIR/app" ] && [ -d "$START_DIR/components" ]; then
  APP_ROOT="$START_DIR"
  REPO_ROOT="$(cd "$START_DIR/../.." && pwd)"
else
  echo "Run this from either the repository root or apps/cleaner-web."
  exit 1
fi

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/cleaner-planning-ready-options-v4-$STAMP"
mkdir -p "$BACKUP_DIR"

python "$PKG_DIR/scripts/patch-cleaner-planning-ready-options-v4.py" "$APP_ROOT" "$BACKUP_DIR"

echo "Installed cleaner planning ready options v4"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
