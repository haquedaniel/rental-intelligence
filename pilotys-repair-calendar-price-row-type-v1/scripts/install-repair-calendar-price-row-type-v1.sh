#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/repair-calendar-price-row-type-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

python - <<'PY'
from pathlib import Path

roots = [
    Path("apps/cleaner-web/app/owner"),
    Path("apps/cleaner-web/components"),
]

changed = []

for root in roots:
    if not root.exists():
        continue

    for path in root.rglob("*"):
        if path.suffix not in {".tsx", ".ts"}:
            continue

        text = path.read_text()
        original = text

        if "calendarDayPriceAmount" not in text and "calendarDayPriceLabel" not in text:
            continue

        text = text.replace(
            "function calendarDayPriceAmount(day: Row | null | undefined): number | null",
            "function calendarDayPriceAmount(day: Record<string, any> | null | undefined): number | null",
        )
        text = text.replace(
            "function calendarDayPriceLabel(day: Row | null | undefined): string | null",
            "function calendarDayPriceLabel(day: Record<string, any> | null | undefined): string | null",
        )
        text = text.replace(
            "function isCalendarDayBooked(day: Row | null | undefined): boolean",
            "function isCalendarDayBooked(day: Record<string, any> | null | undefined): boolean",
        )

        if text != original:
            backup = Path(".pilotys-backups/repair-calendar-price-row-type-v1-inline") / path
            backup.parent.mkdir(parents=True, exist_ok=True)
            if not backup.exists():
                backup.write_text(original)
            path.write_text(text)
            changed.append(str(path))

if changed:
    print("Repaired calendar price helper Row types in:")
    for item in changed:
        print(" -", item)
else:
    print("No calendar price Row type helpers found.")
PY

echo "Installed calendar price Row type repair v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
