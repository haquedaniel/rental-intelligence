#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REL="apps/cleaner-web/components/owner/OwnerBottomNav.tsx"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-app-nav-hotfix-v1-$STAMP"

mkdir -p "$BACKUP/$(dirname "$REL")"
if [ -f "$ROOT/$REL" ]; then
  cp "$ROOT/$REL" "$BACKUP/$REL"
fi

cp "$SRC/$REL" "$ROOT/$REL"

echo "Installed owner app navigation compatibility hotfix."
echo "Backup: $BACKUP"
echo
echo "Rebuild:"
echo "  docker compose up -d --build cleaner-web"
