#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/owner-navigation-missions-v3-$STAMP"

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

echo "Installed owner navigation + mission page v3"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
