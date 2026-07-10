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

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/repair-usepathname-import-v1-$STAMP"
mkdir -p "$BACKUP_DIR"

python - "$APP_ROOT" "$BACKUP_DIR" <<'PY'
from pathlib import Path
import sys

app_root = Path(sys.argv[1])
backup_dir = Path(sys.argv[2])

targets = [
    app_root / "app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx",
    app_root / "app/owner/app/demo/OwnerDemoCockpit.tsx",
]

IMPORT_LINE = 'import { usePathname } from "next/navigation";'

changed = []

def find_import_section_end(lines: list[str]) -> int:
    """
    Return index after the full top import section, respecting multiline imports.
    """
    in_import = False
    last_import_end = -1

    for i, line in enumerate(lines):
        stripped = line.strip()

        if not in_import and (stripped.startswith('"use client"') or stripped.startswith("'use client'") or stripped == ""):
            continue

        if not in_import and stripped.startswith("import "):
            in_import = True
            # single-line import
            if stripped.endswith(";"):
                in_import = False
                last_import_end = i
            continue

        if in_import:
            if stripped.endswith(";"):
                in_import = False
                last_import_end = i
            continue

        # once imports have started and then ended, stop at first non-import top-level line
        if last_import_end >= 0:
            break

    return last_import_end + 1 if last_import_end >= 0 else 0

for path in targets:
    if not path.exists():
        print(f"Missing {path}; skipped.")
        continue

    original = path.read_text()
    text = original

    # Remove all existing usePathname import lines wherever they landed.
    lines = [
        line for line in text.splitlines()
        if line.strip() != IMPORT_LINE
    ]

    # Insert once after the complete import section.
    insert_at = find_import_section_end(lines)
    lines.insert(insert_at, IMPORT_LINE)

    text = "\n".join(lines) + ("\n" if original.endswith("\n") else "")

    if text != original:
        rel = path.relative_to(app_root)
        backup = backup_dir / rel
        backup.parent.mkdir(parents=True, exist_ok=True)
        backup.write_text(original)

        path.write_text(text)
        changed.append(str(rel))

if changed:
    print("Repaired usePathname import placement in:")
    for item in changed:
        print(" -", item)
else:
    print("No usePathname import placement changes needed.")
PY

echo "Installed usePathname import repair v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
