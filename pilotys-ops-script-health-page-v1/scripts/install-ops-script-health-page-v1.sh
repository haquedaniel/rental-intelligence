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

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/ops-script-health-page-v1-$STAMP"
mkdir -p "$BACKUP_DIR"

copy_file() {
  local src="$1"
  local dest="$APP_ROOT/$src"

  if [ -e "$dest" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$src")"
    cp "$dest" "$BACKUP_DIR/$src"
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$PKG_DIR/$src" "$dest"
}

copy_file "app/admin/ops-health/page.tsx"
copy_file "app/admin/health/page.tsx"

echo "Installed ops script health page v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
echo ""
echo "Route: /admin/ops-health"
echo "Alias: /admin/health"
