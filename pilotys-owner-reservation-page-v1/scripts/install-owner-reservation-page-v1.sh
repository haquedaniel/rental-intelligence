#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/owner-reservation-page-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web/app" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web/app to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if [ -d "$ROOT/apps/cleaner-web/app/owner/reservations/[reservationId]" ]; then
  mkdir -p "$BACKUP_DIR/apps/cleaner-web/app/owner/reservations"
  cp -R "$ROOT/apps/cleaner-web/app/owner/reservations/[reservationId]" "$BACKUP_DIR/apps/cleaner-web/app/owner/reservations/"
fi

mkdir -p "$ROOT/apps/cleaner-web/app/owner/reservations/[reservationId]"
cp "$PKG_DIR/apps/cleaner-web/app/owner/reservations/[reservationId]/page.tsx" "$ROOT/apps/cleaner-web/app/owner/reservations/[reservationId]/page.tsx"

echo "Installed owner reservation page v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
