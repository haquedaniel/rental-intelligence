#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/repair-use-client-directives-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

python - <<'PY'
from pathlib import Path
import re

roots = [
    Path("apps/cleaner-web/app/owner"),
    Path("apps/cleaner-web/components"),
]

changed = []

def repair_use_client(text: str) -> str:
    if '"use client";' not in text and "'use client';" not in text:
        return text

    # Already valid.
    stripped = text.lstrip("\ufeff\n\r\t ")
    if stripped.startswith('"use client";') or stripped.startswith("'use client';"):
        return text

    # Remove all use client directives wherever they were pushed.
    text = re.sub(r'^\s*["\']use client["\'];\s*\n?', '', text, flags=re.M)

    # Put it first, preserving file content after it.
    return '"use client";\n\n' + text.lstrip("\ufeff\n\r\t ")

for root in roots:
    if not root.exists():
        continue

    for path in root.rglob("*"):
        if path.suffix not in {".tsx", ".ts", ".jsx", ".js"}:
            continue

        original = path.read_text()
        fixed = repair_use_client(original)

        if fixed != original:
            backup = Path(".pilotys-backups/repair-use-client-directives-v1-inline") / path
            backup.parent.mkdir(parents=True, exist_ok=True)
            if not backup.exists():
                backup.write_text(original)
            path.write_text(fixed)
            changed.append(str(path))

if changed:
    print("Repaired use client directives:")
    for item in changed:
        print(" -", item)
else:
    print("No misplaced use client directives found.")
PY

echo "Installed use-client directive repair v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
