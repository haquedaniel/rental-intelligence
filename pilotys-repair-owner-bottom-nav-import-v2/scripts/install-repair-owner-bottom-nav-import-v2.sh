#!/usr/bin/env bash
set -euo pipefail

START_DIR="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Support being run either from repo root or from apps/cleaner-web.
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

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/repair-owner-bottom-nav-import-v2-$STAMP"
mkdir -p "$BACKUP_DIR"

python - "$APP_ROOT" "$BACKUP_DIR" <<'PY'
from pathlib import Path
import sys

app_root = Path(sys.argv[1])
backup_dir = Path(sys.argv[2])

IMPORT_LINE = 'import OwnerBottomNav from "@/components/owner/OwnerBottomNav";'

targets = [
    app_root / "app/owner/payments/[token]/page.tsx",
    app_root / "app/owner/payments/page.tsx",
]

# Also scan all owner/admin files in case there are more missed imports.
for scan_root in [app_root / "app/owner", app_root / "app/admin"]:
    if scan_root.exists():
        targets.extend(scan_root.rglob("*.tsx"))

seen = set()
changed = []

for path in targets:
    if path in seen or not path.exists():
        continue
    seen.add(path)

    text = path.read_text()
    original = text

    if "<OwnerBottomNav" not in text:
        continue

    if IMPORT_LINE in text:
        continue

    lines = text.splitlines()
    insert_at = 0

    # Preserve "use client" if present.
    if lines and lines[0].strip() in {'"use client";', "'use client';"}:
        insert_at = 1

    # Insert after last import.
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1

    lines.insert(insert_at, IMPORT_LINE)
    text = "\n".join(lines) + ("\n" if original.endswith("\n") else "")

    rel = path.relative_to(app_root)
    backup = backup_dir / rel
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(original)

    path.write_text(text)
    changed.append(str(rel))

if changed:
    print("Added missing OwnerBottomNav imports in:")
    for item in changed:
        print(" -", item)
else:
    print("No missing OwnerBottomNav imports found.")
PY

echo "Installed OwnerBottomNav import repair v2"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
