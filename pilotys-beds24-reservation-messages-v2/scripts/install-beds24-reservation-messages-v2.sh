#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/beds24-messages-v2-$STAMP"

mkdir -p "$BACKUP_DIR"

backup_file() {
  local target="$1"
  if [ -f "$ROOT/$target" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$target")"
    cp "$ROOT/$target" "$BACKUP_DIR/$target"
  fi
}

backup_file "src/rental_intel/ingest/beds24.py"
backup_file "scripts/sync_cleaning_reservations.py"
backup_file "scripts/sync_reservation_financials.py"
backup_file "scripts/discover_beds24_messages.py"
backup_file "scripts/sync_beds24_reservation_messages.py"
backup_file "scripts/generate_reservation_operational_context.py"

mkdir -p "$ROOT/src/rental_intel/ingest"
mkdir -p "$ROOT/scripts"

cp "$PKG_DIR/src/rental_intel/ingest/beds24.py" "$ROOT/src/rental_intel/ingest/beds24.py"
cp "$PKG_DIR/scripts/sync_cleaning_reservations.py" "$ROOT/scripts/sync_cleaning_reservations.py"
cp "$PKG_DIR/scripts/sync_reservation_financials.py" "$ROOT/scripts/sync_reservation_financials.py"
cp "$PKG_DIR/scripts/discover_beds24_messages.py" "$ROOT/scripts/discover_beds24_messages.py"
cp "$PKG_DIR/scripts/sync_beds24_reservation_messages.py" "$ROOT/scripts/sync_beds24_reservation_messages.py"
cp "$PKG_DIR/scripts/generate_reservation_operational_context.py" "$ROOT/scripts/generate_reservation_operational_context.py"

echo "Installed Beds24 reservation messages v2"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Suggested test commands:"
echo "  python scripts/discover_beds24_messages.py --property-id 331524 --max-pages 2"
echo "  python scripts/sync_cleaning_reservations.py"
echo "  python scripts/sync_reservation_financials.py"
echo "  python scripts/sync_beds24_reservation_messages.py --property-id 331524 --max-pages 2 --dry-run"
echo "  python scripts/generate_reservation_operational_context.py"
