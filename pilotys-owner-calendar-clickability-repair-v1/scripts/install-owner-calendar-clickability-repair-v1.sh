#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/owner-calendar-clickability-repair-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

python - <<'PY'
from pathlib import Path
import re

roots = [
    Path("apps/cleaner-web/components/owner-planning"),
    Path("apps/cleaner-web/app/owner"),
    Path("apps/cleaner-web/app/admin/planning-v2"),
    Path("apps/cleaner-web/components"),
]

changed = []

def normalize_classes(value: str) -> str:
    classes = value.split()

    # Remove broad pointer-event changes from the previous patch.
    classes = [c for c in classes if c != "pointer-events-none"]

    # Deduplicate while preserving order.
    out = []
    for c in classes:
        if c not in out:
            out.append(c)

    return " ".join(out)

def add_tokens(value: str, tokens: list[str]) -> str:
    classes = normalize_classes(value).split()
    for token in tokens:
        if token not in classes:
            classes.append(token)
    return " ".join(classes)

def patch_links(text: str) -> str:
    # Reservation links.
    text = re.sub(
        r'(<Link\b[^>]*href=\{reservationHref\([^)]*\)[^>]*className=")([^"]*)(")',
        lambda m: m.group(1) + add_tokens(m.group(2), ["relative", "z-40", "pointer-events-auto", "cursor-pointer"]) + m.group(3),
        text,
        flags=re.S,
    )

    # Mission links: common helper/function names.
    text = re.sub(
        r'(<Link\b[^>]*href=\{(?:requestIssueHref|missionHref|requestHref|cleaningRequestHref)\([^)]*\)[^>]*className=")([^"]*)(")',
        lambda m: m.group(1) + add_tokens(m.group(2), ["relative", "z-50", "pointer-events-auto", "cursor-pointer"]) + m.group(3),
        text,
        flags=re.S,
    )

    # Direct owner mission hrefs.
    text = re.sub(
        r'(<Link\b[^>]*href=\{`/owner/missions/\$\{[^}]+\}`\}[^>]*className=")([^"]*)(")',
        lambda m: m.group(1) + add_tokens(m.group(2), ["relative", "z-50", "pointer-events-auto", "cursor-pointer"]) + m.group(3),
        text,
        flags=re.S,
    )

    # Direct owner reservation hrefs.
    text = re.sub(
        r'(<Link\b[^>]*href=\{`/owner/reservations/\$\{[^}]+\}`\}[^>]*className=")([^"]*)(")',
        lambda m: m.group(1) + add_tokens(m.group(2), ["relative", "z-40", "pointer-events-auto", "cursor-pointer"]) + m.group(3),
        text,
        flags=re.S,
    )

    return text

for root in roots:
    if not root.exists():
        continue

    for path in root.rglob("*"):
        if path.suffix not in {".tsx", ".ts"}:
            continue

        name = str(path).lower()
        text = path.read_text()

        # Limit to owner planning/cockpit-like files, or files already affected by pointer-events.
        if not (
            "ownertimeline" in path.name.lower()
            or "planning" in name
            or "cockpit" in name
            or "pointer-events-none" in text
            or "reservationhref" in text.lower()
            or "/owner/missions/" in text
        ):
            continue

        original = text

        # Remove broad pointer-events-none anywhere in these owner calendar files.
        text = re.sub(
            r'className="([^"]*pointer-events-none[^"]*)"',
            lambda m: 'className="' + normalize_classes(m.group(1)) + '"',
            text,
        )

        text = patch_links(text)

        # Preserve route fixes.
        text = text.replace("/owner/issues/request/", "/owner/missions/")
        text = text.replace("/owner/reservation/", "/owner/reservations/")
        text = text.replace("/owner/booking/", "/owner/reservations/")
        text = text.replace("/owner/bookings/", "/owner/reservations/")

        if text != original:
            backup = Path(".pilotys-backups/owner-calendar-clickability-repair-v1-inline") / path
            backup.parent.mkdir(parents=True, exist_ok=True)
            if not backup.exists():
                backup.write_text(original)
            path.write_text(text)
            changed.append(str(path))

if changed:
    print("Repaired calendar clickability in:")
    for item in changed:
        print(" -", item)
else:
    print("No owner calendar clickability changes were needed/found.")
PY

echo "Installed owner calendar clickability repair v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
