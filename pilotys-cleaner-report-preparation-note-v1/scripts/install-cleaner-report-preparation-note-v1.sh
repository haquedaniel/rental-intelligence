#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/cleaner-report-preparation-note-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web/app" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web/app to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

copy_file() {
  local target="$1"
  if [ -e "$ROOT/$target" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$target")"
    cp "$ROOT/$target" "$BACKUP_DIR/$target"
  fi
  mkdir -p "$ROOT/$(dirname "$target")"
  cp "$PKG_DIR/$target" "$ROOT/$target"
}

copy_file "apps/cleaner-web/components/cleaner/CleanerPreparationNoteBanner.tsx"

python - <<'PY'
from pathlib import Path
import re

report_paths = [
    Path("apps/cleaner-web/app/mission/[token]/report/page.tsx"),
    Path("apps/cleaner-web/app/mission/[token]/intervention/report/page.tsx"),
]

changed = []

def patch_report_page(path: Path) -> None:
    if not path.exists():
        print(f"Missing {path}; skipped.")
        return

    original = path.read_text()
    text = original

    if "CleanerPreparationNoteBanner" not in text:
        lines = text.splitlines()
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                insert_at = i + 1
        lines.insert(insert_at, 'import { CleanerPreparationNoteBanner } from "@/components/cleaner/CleanerPreparationNoteBanner";')
        text = "\\n".join(lines) + ("\\n" if original.endswith("\\n") else "")

    banner = """
        <CleanerPreparationNoteBanner missionToken={token} />

"""

    if "<CleanerPreparationNoteBanner missionToken={token}" not in text:
        patterns = [
            r'(<div className="mx-auto[^"]*space-y-[^"]*"[^>]*>\\s*)',
            r'(<div className="mx-auto[^"]*max-w-[^"]*"[^>]*>\\s*)',
            r'(<main[^>]*>\\s*)',
        ]

        inserted = False
        for pattern in patterns:
            new_text, count = re.subn(pattern, lambda m: m.group(1) + banner, text, count=1, flags=re.S)
            if count:
                text = new_text
                inserted = True
                break

        if not inserted:
            print(f"Could not find insertion point in {path}; import only.")

    if text != original:
        backup = Path(".pilotys-backups/cleaner-report-preparation-note-v1-inline") / path
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_text(original)
        path.write_text(text)
        changed.append(str(path))
    else:
        print(f"Unchanged {path}")

for path in report_paths:
    patch_report_page(path)

if changed:
    print("Patched report pages:")
    for item in changed:
        print(" -", item)
else:
    print("No report pages changed.")
PY

echo "Installed cleaner report preparation note v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
