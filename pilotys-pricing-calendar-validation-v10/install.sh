#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PKG="$(cd "$(dirname "$0")" && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.pilotys-backups/pricing-calendar-validation-v10-$TS"
[ -d "$ROOT/src/rental_intel" ] || { echo "Run from the rental-intelligence repository root."; exit 1; }
mkdir -p "$BACKUP"
install_file(){ src="$1"; dst="$2"; mkdir -p "$(dirname "$dst")"; if [ -f "$dst" ]; then mkdir -p "$BACKUP/$(dirname "${dst#$ROOT/}")"; cp "$dst" "$BACKUP/${dst#$ROOT/}"; fi; cp "$src" "$dst"; }
install_file "$PKG/src/rental_intel/pricing/publisher.py" "$ROOT/src/rental_intel/pricing/publisher.py"
install_file "$PKG/src/rental_intel/pricing/__init__.py" "$ROOT/src/rental_intel/pricing/__init__.py"
install_file "$PKG/src/rental_intel/scripts/publish_pricing.py" "$ROOT/src/rental_intel/scripts/publish_pricing.py"
python -m py_compile "$ROOT/src/rental_intel/pricing/publisher.py" "$ROOT/src/rental_intel/pricing/__init__.py" "$ROOT/src/rental_intel/scripts/publish_pricing.py"
echo "Installed pricing calendar validation v10. Backup: $BACKUP"
echo "No migration or frontend rebuild required. Rebuild cockpit and pricing-api."
