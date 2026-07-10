#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/repair-cleaner-report-newlines-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web/app" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web/app to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

python - <<'PY'
from pathlib import Path
import re

targets = [
    Path("apps/cleaner-web/app/mission/[token]/report/page.tsx"),
    Path("apps/cleaner-web/app/mission/[token]/intervention/report/page.tsx"),
]

changed = []

for path in targets:
    if not path.exists():
        print(f"Missing {path}; skipped.")
        continue

    original = path.read_text()
    text = original

    # Repair v1 corruption: literal backslash-n sequences were written into the TSX file.
    if "\\n" in text[:2000]:
        text = text.replace("\\n", "\n")

    # Repair accidental leading "n        " before JSX caused by the same newline bug.
    text = text.replace("\nn        <", "\n        <")
    text = text.replace("\nn      <", "\n      <")
    text = text.replace("\nn    <", "\n    <")

    # If import exists but was malformed after newline repair, normalize import line.
    text = text.replace(
        'import { CleanerPreparationNoteBanner } from "@/components/cleaner/CleanerPreparationNoteBanner";;',
        'import { CleanerPreparationNoteBanner } from "@/components/cleaner/CleanerPreparationNoteBanner";',
    )

    if "CleanerPreparationNoteBanner" in text and 'import { CleanerPreparationNoteBanner } from "@/components/cleaner/CleanerPreparationNoteBanner";' not in text:
        lines = text.splitlines()
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                insert_at = i + 1
        lines.insert(insert_at, 'import { CleanerPreparationNoteBanner } from "@/components/cleaner/CleanerPreparationNoteBanner";')
        text = "\n".join(lines) + ("\n" if original.endswith("\n") else "")

    if text != original:
        backup = Path(".pilotys-backups/repair-cleaner-report-newlines-v1-inline") / path
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_text(original)
        path.write_text(text)
        changed.append(str(path))

if changed:
    print("Repaired report TSX newlines in:")
    for item in changed:
        print(" -", item)
else:
    print("No newline corruption found.")
PY

echo "Installed cleaner report newline repair v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
