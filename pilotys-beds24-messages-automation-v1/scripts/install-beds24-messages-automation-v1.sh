#!/usr/bin/env bash
set -euo pipefail

START_DIR="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ -d "$START_DIR/apps/cleaner-web" ] || [ -d "$START_DIR/rental_intel" ] || [ -d "$START_DIR/scripts" ]; then
  REPO_ROOT="$START_DIR"
elif [ -d "$START_DIR/../../rental_intel" ] || [ -d "$START_DIR/../../scripts" ]; then
  REPO_ROOT="$(cd "$START_DIR/../.." && pwd)"
else
  echo "Run this from the repository root."
  exit 1
fi

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/beds24-messages-automation-v1-$STAMP"
mkdir -p "$BACKUP_DIR"

copy_script() {
  local rel="$1"
  local src="$PKG_DIR/$rel"
  local dest="$REPO_ROOT/$rel"

  if [ -e "$dest" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
    cp "$dest" "$BACKUP_DIR/$rel"
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  chmod +x "$dest" || true
}

copy_script "scripts/sync_beds24_reservation_messages.py"
copy_script "scripts/beds24_messages_cron.sh"

python - "$REPO_ROOT" "$BACKUP_DIR" <<'PY'
from pathlib import Path
import sys

repo = Path(sys.argv[1])
backup_dir = Path(sys.argv[2])

candidates = [
    repo / "scripts/ops_refresh.sh",
    repo / "ops_refresh.sh",
]

ops_path = next((p for p in candidates if p.exists()), None)

if not ops_path:
    print("No ops_refresh.sh found; installed standalone scripts only.")
    raise SystemExit(0)

original = ops_path.read_text()
text = original

marker = "bash scripts/beds24_messages_cron.sh"
if marker not in text:
    needle = "run_required python -m rental_intel.scripts.extract_bookings\n"
    insert = '''
# Beds24 / OTA correspondence sync.
# Must run after bookings extraction so reservation_messages can link to fresh reservation rows.
if [ -x scripts/beds24_messages_cron.sh ]; then
  echo
  echo "===== $(date -Is) running Beds24 correspondence sync ====="
  bash scripts/beds24_messages_cron.sh
else
  echo "===== $(date -Is) skipping Beds24 correspondence sync: scripts/beds24_messages_cron.sh not found ====="
fi
'''
    if needle in text:
        text = text.replace(needle, needle + insert, 1)
    else:
        fallback = 'echo "===== $(date -Is) starting ops_refresh ====="\n'
        if fallback in text:
            text = text.replace(fallback, fallback + insert, 1)
        else:
            raise SystemExit("Could not find safe insertion point in ops_refresh.sh")

if text != original:
    rel = ops_path.relative_to(repo)
    backup = backup_dir / rel
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(original)
    ops_path.write_text(text)
    print(f"Patched {rel}")
else:
    print("ops_refresh.sh already contains Beds24 correspondence sync.")
PY

echo "Installed Beds24 messages automation v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Dry run:"
echo "  BEDS24_MESSAGE_DRY_RUN=true bash scripts/beds24_messages_cron.sh"
echo ""
echo "Normal run:"
echo "  bash scripts/beds24_messages_cron.sh"
echo ""
echo "Then ops refresh will call it automatically if scripts/ops_refresh.sh is the active cron target."
