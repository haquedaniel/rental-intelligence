#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/owner-branding-pass-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web/app" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web/app to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

copy_file() {
  local src="$1"
  local dest="apps/cleaner-web/$src"

  if [ -e "$ROOT/$dest" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$dest")"
    cp "$ROOT/$dest" "$BACKUP_DIR/$dest"
  fi

  mkdir -p "$ROOT/$(dirname "$dest")"
  cp "$PKG_DIR/$src" "$ROOT/$dest"
}

copy_file "components/owner/OwnerBottomNav.tsx"

python - <<'PY'
from pathlib import Path

app = Path("apps/cleaner-web/app")
owner_roots = [
    app / "owner",
    app / "admin" / "settings",
    app / "admin" / "payments",
    app / "admin" / "cleaners",
    app / "admin" / "operations",
    app / "admin" / "owners",
]

SKIP_NAMES = {"actions.ts", "PrintButton.tsx", "OwnerCockpit.tsx", "OwnerDemoCockpit.tsx"}

changed = []

replacements = [
    ("bg-slate-50", "bg-[#F6F3EF]"),
    ("bg-slate-100", "bg-[#112532]/6"),
    ("bg-slate-200", "bg-[#112532]/10"),
    ("bg-slate-950", "bg-[#112532]"),
    ("text-slate-950", "text-[#112532]"),
    ("text-slate-900", "text-[#112532]"),
    ("text-slate-800", "text-[#112532]/86"),
    ("text-slate-700", "text-[#112532]/76"),
    ("text-slate-600", "text-[#112532]/60"),
    ("text-slate-500", "text-[#112532]/48"),
    ("text-slate-400", "text-[#112532]/36"),
    ("border-slate-200", "border-[#112532]/10"),
    ("ring-slate-200", "ring-[#112532]/10"),
    ("ring-slate-300", "ring-[#112532]/14"),
    ("rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#112532]/10", "rounded-[2rem] bg-white/92 p-6 shadow-sm ring-1 ring-[#112532]/8"),
    ("rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#112532]/10", "rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8"),
    ("rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#112532]/10", "rounded-[1.75rem] bg-white/92 p-4 shadow-sm ring-1 ring-[#112532]/8"),
]

def active_for_path(path: Path) -> str:
    s = str(path)
    if "/payments" in s:
        return "payments"
    if "/reports" in s:
        return "reports"
    if "/missions" in s or "/issues" in s:
        return "missions"
    if "/reservations" in s or "/reservation" in s or "/bookings" in s or "/booking" in s or "/stays" in s:
        return "reservations"
    if "/settings" in s:
        return "settings"
    return "cockpit"

def add_owner_nav_import(text: str) -> str:
    if "OwnerBottomNav" in text:
        return text

    if 'import Link from "next/link";' in text:
        return text.replace(
            'import Link from "next/link";\n',
            'import Link from "next/link";\nimport OwnerBottomNav from "@/components/owner/OwnerBottomNav";\n',
            1,
        )

    return text

def add_bottom_nav(text: str, active: str) -> str:
    if "<OwnerBottomNav" in text:
        return text

    idx = text.rfind("</main>")
    if idx == -1:
        return text

    return text[:idx] + f'      <OwnerBottomNav active="{active}" />\n' + text[idx:]

def patch_main_padding(text: str) -> str:
    text = text.replace(
        'className="min-h-screen bg-[#F6F3EF] px-4 py-6"',
        'className="min-h-screen bg-[#F6F3EF] px-4 pb-28 pt-6 text-[#112532]"',
    )
    text = text.replace(
        'className="min-h-screen bg-[#F6F3EF] px-4 py-10"',
        'className="min-h-screen bg-[#F6F3EF] px-4 pb-28 pt-10 text-[#112532]"',
    )
    text = text.replace(
        'className="min-h-screen bg-[#F6F3EF] pb-2 text-[#112532]"',
        'className="min-h-screen bg-[#F6F3EF] pb-28 text-[#112532]"',
    )
    text = text.replace(
        'className="min-h-screen bg-[#F6F3EF] text-[#112532]"',
        'className="min-h-screen bg-[#F6F3EF] pb-28 text-[#112532]"',
    )
    return text

def add_brand_ribbons(text: str) -> str:
    if "Pilotys · pilotage" not in text:
        text = text.replace(
            '<div className="mx-auto max-w-6xl space-y-6">',
            '<div className="mx-auto max-w-6xl space-y-6">\n'
            '        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8">\n'
            '          <span className="h-2 w-2 rounded-full bg-[#E0680E]" />\n'
            '          Pilotys · pilotage\n'
            '        </div>',
            1,
        )

    if "Pilotys · suivi mission" not in text:
        text = text.replace(
            '<div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">',
            '<div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">\n'
            '        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8">\n'
            '          <span className="h-2 w-2 rounded-full bg-[#E0680E]" />\n'
            '          Pilotys · suivi mission\n'
            '        </div>',
            1,
        )

    if "Pilotys · rapport" not in text:
        text = text.replace(
            '<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">',
            '<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">\n'
            '        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8">\n'
            '          <span className="h-2 w-2 rounded-full bg-[#E0680E]" />\n'
            '          Pilotys · rapport\n'
            '        </div>',
            1,
        )

    return text

def patch_page(path: Path) -> None:
    if path.name in SKIP_NAMES:
        return

    if path.suffix != ".tsx":
        return

    s = str(path)
    if "/app/mission/" in s or "/app/cleaner/" in s:
        return

    original = path.read_text()
    text = original

    for old, new in replacements:
        text = text.replace(old, new)

    text = patch_main_padding(text)
    text = add_brand_ribbons(text)

    if "<main" in text and ("/app/owner/" in s or "/app/admin/" in s):
        text = add_owner_nav_import(text)
        text = add_bottom_nav(text, active_for_path(path))

    text = text.replace(
        'className="text-sm font-semibold text-[#112532]/60"',
        'className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-black text-[#112532]/60 ring-1 ring-[#112532]/8"',
    )
    text = text.replace(
        'className="rounded-full bg-[#112532] px-5 py-3 text-sm font-black text-white shadow-sm"',
        'className="rounded-full bg-[#E0680E] px-5 py-3 text-sm font-black text-white shadow-sm shadow-[#E0680E]/20"',
    )
    text = text.replace(
        'className="rounded-full bg-[#112532] px-4 py-2 text-sm font-black text-white"',
        'className="rounded-full bg-[#E0680E] px-4 py-2 text-sm font-black text-white shadow-sm shadow-[#E0680E]/20"',
    )

    if text != original:
        backup = Path(".pilotys-backups/owner-branding-pass-v1-inline") / path
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_text(original)
        path.write_text(text)
        changed.append(str(path))

for root in owner_roots:
    if not root.exists():
        continue

    for path in root.rglob("*.tsx"):
        patch_page(path)

if changed:
    print("Pilotys branding pass patched:")
    for item in changed:
        print(" -", item)
else:
    print("No owner/admin TSX pages changed.")
PY

echo "Installed Pilotys owner branding pass v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
