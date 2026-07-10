#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/owner-calendar-targeted-fix-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

python - <<'PY'
from pathlib import Path
import re

targets = [
    Path("apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx"),
    Path("apps/cleaner-web/app/owner/app/demo/OwnerDemoCockpit.tsx"),
]

changed = []

for path in targets:
    if not path.exists():
        print(f"Missing {path}; skipped.")
        continue

    text = path.read_text()
    original = text

    # 1) The mission overlay covers the whole planning row. Let clicks pass through
    # except on the actual mission bubbles/popovers.
    text = text.replace(
        'className="absolute inset-0 z-30"',
        'className="absolute inset-0 z-30 pointer-events-none"',
    )

    text = text.replace(
        'className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"',
        'className="pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2"',
    )

    # 2) Reservation layer and anchors should be clickable and sit below mission bubbles
    # but above background cells/connector lines.
    text = text.replace(
        'className="absolute inset-0 z-20"',
        'className="absolute inset-0 z-20 pointer-events-auto"',
    )

    text = re.sub(
        r'(className=`group absolute top-1/2 block h-\[2\.75rem\])',
        r'\1 cursor-pointer',
        text,
    )

    # 3) Free-day prices were still present but hidden as sr-only. Make them visible
    # as a subtle grey price at the bottom of the empty day cell.
    old_price = '{!covered && price ? <div className="sr-only">{Math.round(price.price)}€</div> : null}'
    new_price = '''{!covered && price ? (
                                <div
                                  title="Prix jour libre"
                                  className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-black text-[#112532]/38 ring-1 ring-[#112532]/5"
                                >
                                  {Math.round(price.price)}€
                                </div>
                              ) : null}'''
    text = text.replace(old_price, new_price)

    # The day cell now contains an absolute child.
    text = text.replace(
        'className="rounded-xl bg-white/88 ring-1 ring-white/70"',
        'className="relative rounded-xl bg-white/88 ring-1 ring-white/70"',
    )

    # 4) Keep route fixes for literal links if present.
    text = text.replace("/owner/issues/request/", "/owner/missions/")
    text = text.replace("/owner/reservation/", "/owner/reservations/")

    if text != original:
        backup = Path(".pilotys-backups/owner-calendar-targeted-fix-v1-inline") / path
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_text(original)
        path.write_text(text)
        changed.append(str(path))

if changed:
    print("Patched:")
    for item in changed:
        print(" -", item)
else:
    print("No targeted owner calendar changes made.")
PY

echo "Installed owner calendar targeted fix v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
