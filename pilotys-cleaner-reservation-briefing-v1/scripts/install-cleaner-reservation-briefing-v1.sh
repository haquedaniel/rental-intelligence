#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/cleaner-reservation-briefing-v1-$STAMP"

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

copy_file "apps/cleaner-web/app/mission/[token]/reservation/page.tsx"

python - <<'PY'
from pathlib import Path
import re

path = Path("apps/cleaner-web/app/mission/[token]/page.tsx")
if not path.exists():
    print("Cleaner mission page not found; briefing route installed only.")
    raise SystemExit(0)

text = path.read_text()

if "Briefing séjour" in text and "/reservation" in text:
    print("Cleaner mission page already has a briefing link.")
    raise SystemExit(0)

if "from \"next/link\"" not in text and "from 'next/link'" not in text:
    text = 'import Link from "next/link";\n' + text

snippet = """
      <Link
        href={`/mission/${token}/reservation`}
        className="mb-4 inline-flex rounded-full bg-[#112532] px-4 py-3 text-sm font-black text-white shadow-sm"
      >
        Briefing séjour →
      </Link>
"""

text2 = re.sub(r"(<main[^>]*>)", r"\1\n" + snippet, text, count=1)

if text2 == text:
    text2 = re.sub(r"(return\s*\(\s*<[^>]+>)", r"\1\n" + snippet, text, count=1, flags=re.S)

if text2 != text:
    path.write_text(text2)
    print(f"Added briefing link to {path}")
else:
    print("Could not safely patch cleaner mission page; route installed only.")
PY

echo "Installed cleaner reservation briefing v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
