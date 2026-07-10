#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/cleaner-correspondence-owner-note-v2-$STAMP"

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
copy_file "apps/cleaner-web/app/owner/missions/[requestId]/page.tsx"

mkdir -p "$ROOT/supabase/migrations"
cp "$PKG_DIR/supabase/migrations/20260710_cleaning_request_owner_note.sql" "$ROOT/supabase/migrations/20260710_cleaning_request_owner_note.sql"

# Best-effort: ensure cleaner mission page exposes briefing link and owner priority note if present.
python - <<'PY'
from pathlib import Path
import re

path = Path("apps/cleaner-web/app/mission/[token]/page.tsx")
if not path.exists():
    print("Cleaner mission page not found; briefing route installed only.")
    raise SystemExit(0)

text = path.read_text()
original = text

if "from \"next/link\"" not in text and "from 'next/link'" not in text:
    text = 'import Link from "next/link";\n' + text

if "Briefing séjour" not in text:
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
    text = text2


# Repair v1 if it injected an unsafe `request.*` block into the cleaner mission page.
broken_block = """
      {(request.cleaner_priority_note || request.owner_note) ? (
        <section className="mb-4 rounded-3xl bg-[#112532] p-5 text-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Note propriétaire — important</p>
          <p className="mt-2 whitespace-pre-wrap text-base font-black leading-7 text-white/85">
            {request.cleaner_priority_note || request.owner_note}
          </p>
        </section>
      ) : null}
"""
if broken_block in text:
    text = text.replace(broken_block, "")
    print("Removed unsafe v1 owner-note block from cleaner mission page.")


if text != original:
    path.write_text(text)
    print(f"Patched cleaner mission page {path}")
else:
    print("Cleaner mission page unchanged.")
PY

echo "Installed cleaner correspondence + owner note v2"
echo "Migration copied to: supabase/migrations/20260710_cleaning_request_owner_note.sql"
echo "Apply SQL migration in Supabase if not already applied."
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
