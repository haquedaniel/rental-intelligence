#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/owner-navigation-missions-v4-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web/app" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web/app to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

backup_path() {
  local target="$1"
  if [ -e "$ROOT/$target" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$target")"
    cp -R "$ROOT/$target" "$BACKUP_DIR/$target"
  fi
}

copy_file() {
  local target="$1"
  backup_path "$target"
  mkdir -p "$ROOT/$(dirname "$target")"
  cp "$PKG_DIR/$target" "$ROOT/$target"
}

copy_file "apps/cleaner-web/components/owner/OwnerBottomNav.tsx"
copy_file "apps/cleaner-web/app/owner/reservations/[reservationId]/page.tsx"
copy_file "apps/cleaner-web/app/owner/missions/[requestId]/page.tsx"


# Compatibility redirect routes for old/suspect reservation URLs.
for target in \
  "apps/cleaner-web/app/owner/reservation/[reservationId]/page.tsx" \
  "apps/cleaner-web/app/owner/booking/[reservationId]/page.tsx" \
  "apps/cleaner-web/app/owner/bookings/[reservationId]/page.tsx" \
  "apps/cleaner-web/app/owner/stays/[reservationId]/page.tsx" \
  "apps/cleaner-web/app/admin/reservation/[reservationId]/page.tsx" \
  "apps/cleaner-web/app/admin/reservations/[reservationId]/page.tsx" \
  "apps/cleaner-web/app/admin/booking/[reservationId]/page.tsx" \
  "apps/cleaner-web/app/admin/bookings/[reservationId]/page.tsx" \
  "apps/cleaner-web/app/owner/issues/request/[requestId]/page.tsx"
do
  copy_file "$target"
done

# Navigation compatibility: update old owner issue links wherever they remain.
python - <<'PY'
from pathlib import Path

roots = [
    Path("apps/cleaner-web/app/owner"),
    Path("apps/cleaner-web/components"),
]

for root in roots:
    if not root.exists():
        continue

    for path in root.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue

        text = path.read_text()
        original = text

        text = text.replace("/owner/issues/request/", "/owner/missions/")
        text = text.replace("/owner/reservation/", "/owner/reservations/")

        if text != original:
            path.write_text(text)
            print(f"Patched owner navigation links in {path}")
PY

# Soft-patch existing owner report and old issue pages to include the bottom nav, without replacing their content.
python - <<'PY'
from pathlib import Path

patches = [
    ("apps/cleaner-web/app/owner/reports/[requestId]/page.tsx", "reports"),
    ("apps/cleaner-web/app/owner/issues/request/[requestId]/page.tsx", "missions"),
    ("apps/cleaner-web/app/owner/issues/missing/[reservationId]/page.tsx", "missions"),
    ("apps/cleaner-web/app/owner/payments/page.tsx", "payments"),
]

for file_name, active in patches:
    path = Path(file_name)
    if not path.exists():
        continue

    text = path.read_text()
    if "@/components/owner/OwnerBottomNav" not in text:
        marker = 'import { getSupabaseAdmin } from "@/lib/supabaseAdmin";'
        if marker in text:
            text = text.replace(marker, marker + '\nimport OwnerBottomNav from "@/components/owner/OwnerBottomNav";', 1)
        else:
            text = 'import OwnerBottomNav from "@/components/owner/OwnerBottomNav";\n' + text

    nav = f'<OwnerBottomNav active="{active}" />'
    if nav not in text:
        text = text.replace("</main>", f"      {nav}\n    </main>")

    path.write_text(text)
    print(f"Ensured bottom nav in {path}")
PY


# Strong owner navigation patch for cockpit/timeline/components.
python - <<'PY'
from pathlib import Path
import re

roots = [
    Path("apps/cleaner-web/app/owner"),
    Path("apps/cleaner-web/app/admin/planning-v2"),
    Path("apps/cleaner-web/components"),
]

for root in roots:
    if not root.exists():
        continue

    for path in root.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue

        text = path.read_text()
        original = text

        # Mission route migration.
        text = text.replace("/owner/issues/request/", "/owner/missions/")

        # Common old reservation route variants.
        text = text.replace("/owner/reservation/", "/owner/reservations/")
        text = text.replace("/owner/booking/", "/owner/reservations/")
        text = text.replace("/owner/bookings/", "/owner/reservations/")
        text = text.replace("/owner/stays/", "/owner/reservations/")
        text = text.replace("/admin/reservation/", "/owner/reservations/")
        text = text.replace("/admin/reservations/", "/owner/reservations/")
        text = text.replace("/admin/booking/", "/owner/reservations/")
        text = text.replace("/admin/bookings/", "/owner/reservations/")

        # Template-string variants with ${reservation.id}.
        replacements = {
            "`/owner/reservation/${reservation.id}`": "`/owner/reservations/${reservation.id}`",
            "`/owner/booking/${reservation.id}`": "`/owner/reservations/${reservation.id}`",
            "`/owner/bookings/${reservation.id}`": "`/owner/reservations/${reservation.id}`",
            "`/owner/stays/${reservation.id}`": "`/owner/reservations/${reservation.id}`",
            "`/admin/reservation/${reservation.id}`": "`/owner/reservations/${reservation.id}`",
            "`/admin/reservations/${reservation.id}`": "`/owner/reservations/${reservation.id}`",
            "`/admin/booking/${reservation.id}`": "`/owner/reservations/${reservation.id}`",
            "`/admin/bookings/${reservation.id}`": "`/owner/reservations/${reservation.id}`",
        }
        for old, new in replacements.items():
            text = text.replace(old, new)

        # Force known helper functions if they exist.
        text = re.sub(
            r"export function requestIssueHref\(request: Row\): string \{\s*return `[^`]*\$\{request\.id\}`;\s*\}",
            "export function requestIssueHref(request: Row): string {\n  return `/owner/missions/${request.id}`;\n}",
            text,
            flags=re.S,
        )
        text = re.sub(
            r"export function reservationHref\(reservation: Row\): string \{\s*return `[^`]*\$\{reservation\.id\}`;\s*\}",
            "export function reservationHref(reservation: Row): string {\n  return `/owner/reservations/${reservation.id}`;\n}",
            text,
            flags=re.S,
        )

        # If a component is still using a source booking id for owner reservation navigation,
        # prefer the Supabase UUID. This is deliberately conservative.
        text = text.replace("${reservation.source_booking_id}", "${reservation.id}")
        text = text.replace("${booking.source_booking_id}", "${booking.id}")

        if text != original:
            path.write_text(text)
            print(f"Patched owner navigation links in {path}")
PY

echo "Installed owner navigation + mission page v4"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
