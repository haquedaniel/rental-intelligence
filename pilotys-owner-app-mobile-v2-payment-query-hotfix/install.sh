#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REL="apps/cleaner-web/app/owner/[ownerToken]/cockpit/data.ts"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/owner-app-mobile-v2-payment-query-hotfix-$STAMP"

mkdir -p "$BACKUP/$(dirname "$REL")"
if [ -f "$ROOT/$REL" ]; then
  cp "$ROOT/$REL" "$BACKUP/$REL"
fi

cp "$SRC/$REL" "$ROOT/$REL"

echo "Installed owner app payment-query hotfix."
echo "Backup: $BACKUP"
echo "Rebuild with: docker compose up -d --build cleaner-web"
