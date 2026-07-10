#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/owner-calendar-clickable-reservations-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

python - <<'PY'
from pathlib import Path
import re

candidate_roots = [
    Path("apps/cleaner-web/components/owner-planning"),
    Path("apps/cleaner-web/app/owner"),
    Path("apps/cleaner-web/app/admin/planning-v2"),
]

paths = []
for root in candidate_roots:
    if root.exists():
        paths.extend([p for p in root.rglob("*.tsx") if "OwnerTimeline" in p.name or "cockpit" in str(p) or "planning" in str(p)])

changed = []

def add_class_token(class_string: str, token: str) -> str:
    if token in class_string.split():
        return class_string
    return class_string + " " + token

for path in paths:
    text = path.read_text()
    original = text

    # Ensure reservation route helper references are the detail page.
    text = text.replace("/owner/reservation/", "/owner/reservations/")
    text = text.replace("/owner/booking/", "/owner/reservations/")
    text = text.replace("/owner/bookings/", "/owner/reservations/")
    text = text.replace("/owner/stays/", "/owner/reservations/")

    text = re.sub(
        r"export function reservationHref\(reservation: Row\): string \{\s*return `[^`]*\$\{reservation\.id\}`;\s*\}",
        "export function reservationHref(reservation: Row): string {\n  return `/owner/reservations/${reservation.id}`;\n}",
        text,
        flags=re.S,
    )

    # Background calendar layers should never steal clicks from reservation bars.
    text = re.sub(
        r'className="([^"]*\babsolute\b[^"]*\bgrid\b[^"]*)"',
        lambda m: 'className="' + add_class_token(m.group(1), "pointer-events-none") + '"',
        text,
    )
    text = re.sub(
        r'className="([^"]*\babsolute\b[^"]*\binset[^"]*)"',
        lambda m: 'className="' + add_class_token(m.group(1), "pointer-events-none") + '"',
        text,
    )

    # Reservation links should explicitly receive pointer events and a cursor.
    text = re.sub(
        r'(<Link[^>]+href=\{reservationHref\(reservation\)[^>]+className=")([^"]*)(")',
        lambda m: m.group(1) + add_class_token(add_class_token(m.group(2), "pointer-events-auto"), "cursor-pointer") + m.group(3),
        text,
        flags=re.S,
    )

    # Some newer timeline versions calculate a href first.
    text = re.sub(
        r'(<Link[^>]+href=\{reservationHref\([^)]*\)[^>]+className=")([^"]*)(")',
        lambda m: m.group(1) + add_class_token(add_class_token(m.group(2), "pointer-events-auto"), "cursor-pointer") + m.group(3),
        text,
        flags=re.S,
    )

    # If a reservation bar is a positioned div inside a Link, make its z-index high enough.
    text = re.sub(
        r'className="([^"]*\breservation[^"]*)"',
        lambda m: 'className="' + add_class_token(add_class_token(m.group(1), "pointer-events-auto"), "cursor-pointer") + '"',
        text,
        flags=re.I,
    )

    # Absolute-positioned reservation links need to sit above connector lines/missions.
    text = re.sub(
        r'(<Link[^>]+href=\{reservationHref\(reservation\)[^>]+className=")([^"]*)(")',
        lambda m: m.group(1) + add_class_token(m.group(2), "z-30") + m.group(3),
        text,
        flags=re.S,
    )

    if text != original:
        backup = Path(".pilotys-backups/owner-calendar-clickable-reservations-v1-inline") / path
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_text(original)
        path.write_text(text)
        changed.append(str(path))

if changed:
    print("Patched files:")
    for item in changed:
        print(" -", item)
else:
    print("No matching owner calendar files changed. The reservation links may be rendered in another component.")
PY

echo "Installed owner calendar clickable reservations v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
