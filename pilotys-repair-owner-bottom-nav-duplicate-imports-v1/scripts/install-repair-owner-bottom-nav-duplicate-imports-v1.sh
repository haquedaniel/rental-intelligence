#!/usr/bin/env bash
set -euo pipefail

START_DIR="$(pwd)"
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

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/repair-owner-bottom-nav-duplicate-imports-v1-$STAMP"
mkdir -p "$BACKUP_DIR"

python - "$APP_ROOT" "$BACKUP_DIR" <<'PY'
from pathlib import Path
import sys
import re

app_root = Path(sys.argv[1])
backup_dir = Path(sys.argv[2])

changed = []

for scan_root in [app_root / "app/owner", app_root / "app/admin"]:
    if not scan_root.exists():
        continue

    for path in scan_root.rglob("*.tsx"):
        text = path.read_text()
        original = text

        if "OwnerBottomNav" not in text:
            continue

        lines = text.splitlines()
        owner_nav_imports = [
            i for i, line in enumerate(lines)
            if line.startswith("import ") and "@/components/owner/OwnerBottomNav" in line
        ]

        if len(owner_nav_imports) <= 1:
            continue

        needs_top = any("OwnerTopNav" in lines[i] for i in owner_nav_imports)
        needs_bottom = "OwnerBottomNav" in text

        replacement = None
        if needs_top and needs_bottom:
            replacement = 'import OwnerBottomNav, { OwnerTopNav } from "@/components/owner/OwnerBottomNav";'
        elif needs_top:
            replacement = 'import { OwnerTopNav } from "@/components/owner/OwnerBottomNav";'
        else:
            replacement = 'import OwnerBottomNav from "@/components/owner/OwnerBottomNav";'

        new_lines = []
        inserted = False
        for i, line in enumerate(lines):
            if i in owner_nav_imports:
                if not inserted:
                    new_lines.append(replacement)
                    inserted = True
                continue
            new_lines.append(line)

        text = "\n".join(new_lines) + ("\n" if original.endswith("\n") else "")

        rel = path.relative_to(app_root)
        backup = backup_dir / rel
        backup.parent.mkdir(parents=True, exist_ok=True)
        backup.write_text(original)

        path.write_text(text)
        changed.append(str(rel))

if changed:
    print("Deduplicated OwnerBottomNav imports in:")
    for item in changed:
        print(" -", item)
else:
    print("No duplicate OwnerBottomNav imports found.")
PY

echo "Installed OwnerBottomNav duplicate import repair v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
