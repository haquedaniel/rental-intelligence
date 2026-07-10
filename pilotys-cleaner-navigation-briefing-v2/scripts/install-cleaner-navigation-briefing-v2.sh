#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/cleaner-navigation-briefing-v2-$STAMP"

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

copy_file "apps/cleaner-web/components/navigation/CleanerMissionNav.tsx"
copy_file "apps/cleaner-web/app/mission/[token]/reservation/page.tsx"

if [ -f "$PKG_DIR/cleaner-pages/planning/page.tsx" ] && [ -f "$ROOT/apps/cleaner-web/app/cleaner/[token]/planning/page.tsx" ]; then
  backup_path "apps/cleaner-web/app/cleaner/[token]/planning/page.tsx"
  cp "$PKG_DIR/cleaner-pages/planning/page.tsx" "$ROOT/apps/cleaner-web/app/cleaner/[token]/planning/page.tsx"
fi

python - <<'PY'
from pathlib import Path
import re

mission_pages = [
    Path("apps/cleaner-web/app/mission/[token]/page.tsx"),
    Path("apps/cleaner-web/app/mission/[token]/ready-day/page.tsx"),
    Path("apps/cleaner-web/app/mission/[token]/report/page.tsx"),
    Path("apps/cleaner-web/app/mission/[token]/intervention/page.tsx"),
    Path("apps/cleaner-web/app/mission/[token]/reservation/page.tsx"),
]

for path in mission_pages:
    if not path.exists():
        continue

    text = path.read_text()
    original = text

    if "@/components/navigation/CleanerMissionNav" not in text:
        marker = 'import { getSupabaseAdmin } from "@/lib/supabaseAdmin";'
        if marker in text:
            text = text.replace(marker, marker + '\nimport CleanerMissionNav from "@/components/navigation/CleanerMissionNav";', 1)
        else:
            text = 'import CleanerMissionNav from "@/components/navigation/CleanerMissionNav";\n' + text

    if "<CleanerMissionNav" not in text:
        active = "planning" if "/reservation/" in str(path) else "missions"
        text = text.replace("</main>", f'      <CleanerMissionNav missionToken={{token}} active="{active}" />\n    </main>', 1)

    if "/reservation" not in str(path) and "Briefing séjour" not in text:
        snippet = """
      <Link
        href={`/mission/${token}/reservation`}
        className="mb-4 inline-flex rounded-full bg-[#112532] px-4 py-3 text-sm font-black text-white shadow-sm"
      >
        Briefing séjour →
      </Link>
"""
        if "from \"next/link\"" not in text and "from 'next/link'" not in text:
            text = 'import Link from "next/link";\n' + text

        text2 = re.sub(r"(<main[^>]*>)", r"\1\n" + snippet, text, count=1)
        if text2 != text:
            text = text2

    if text != original:
        path.write_text(text)
        print(f"Patched cleaner mission navigation in {path}")
PY

echo "Installed cleaner navigation + briefing v2"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
