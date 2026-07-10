#!/usr/bin/env bash
set -euo pipefail

START_DIR="$(pwd)"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ -d "$START_DIR/apps/cleaner-web/app" ]; then
  APP_ROOT="$START_DIR/apps/cleaner-web"
  REPO_ROOT="$START_DIR"
elif [ -d "$START_DIR/app" ] && [ -d "$START_DIR/components" ]; then
  APP_ROOT="$START_DIR"
  REPO_ROOT="$(cd "$START_DIR/../.." && pwd)"
else
  echo "Run this from either the repository root or apps/cleaner-web."
  exit 1
fi

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/ui-unification-pass-v2-$STAMP"
mkdir -p "$BACKUP_DIR"

copy_file() {
  local src="$1"
  local dest="$APP_ROOT/$src"

  if [ -e "$dest" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$src")"
    cp "$dest" "$BACKUP_DIR/$src"
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$PKG_DIR/$src" "$dest"
}

copy_file "components/owner/OwnerBottomNav.tsx"

python - "$APP_ROOT" "$BACKUP_DIR" <<'PY'
from pathlib import Path
import re
import sys

app_root = Path(sys.argv[1])
backup_dir = Path(sys.argv[2])

changed = []

def backup_and_write(path: Path, original: str, text: str) -> None:
    if text == original:
        return

    rel = path.relative_to(app_root)
    backup = backup_dir / rel
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(original)
    path.write_text(text)
    changed.append(str(rel))

cockpit_bottom_nav = '''
function cockpitNavBase(pathname: string | null) {
  const path = pathname || "";
  const tokenMatch = path.match(/^\\/owner\\/([^/]+)\\/cockpit/);
  if (tokenMatch?.[1]) return `/owner/${tokenMatch[1]}/cockpit`;
  return "/owner/cockpit";
}

function BottomNav() {
  const pathname = usePathname();
  const cockpit = cockpitNavBase(pathname);

  const items = [
    { label: "Cockpit", short: "Cockpit", icon: "✦", href: cockpit, active: true },
    { label: "Réservations", short: "Séjours", icon: "▦", href: `${cockpit}?view=planning` },
    { label: "Missions", short: "Missions", icon: "✓", href: `${cockpit}?view=alerts` },
    { label: "Paiements", short: "€", icon: "€", href: "/owner/payments" },
    { label: "Réglages", short: "Réglages", icon: "⚙", href: "/admin/settings" },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3 xl:hidden">
      <nav className="pointer-events-auto relative mx-auto max-w-md overflow-hidden rounded-[1.7rem] bg-white/90 p-1.5 shadow-2xl shadow-[#112532]/18 ring-1 ring-[#112532]/10 backdrop-blur-xl">
        <div className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-gradient-to-r from-[#E0680E] via-[#F4B044] to-[#80A5B7]" />

        <div className="grid grid-cols-5 gap-1">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={[
                "relative flex min-h-[3.55rem] flex-col items-center justify-center rounded-[1.25rem] px-1 text-center transition",
                item.active
                  ? "bg-[#112532] text-white shadow-lg shadow-[#112532]/18 ring-[#112532]/10"
                  : "bg-white/78 text-[#112532]/62 ring-[#112532]/8 hover:bg-white hover:text-[#112532]",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-6 w-6 place-items-center rounded-full text-[11px] font-black",
                  item.active ? "bg-white/16 text-white" : "bg-[#112532]/6 text-[#112532]/50",
                ].join(" ")}
              >
                {item.icon}
              </span>
              <span className="mt-1 max-w-full truncate text-[10px] font-black leading-none">
                {item.short}
              </span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}

'''

for rel in [
    Path("app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx"),
    Path("app/owner/app/demo/OwnerDemoCockpit.tsx"),
]:
    path = app_root / rel
    if not path.exists():
        continue

    original = path.read_text()
    text = original

    if 'from "next/navigation"' not in text:
        lines = text.splitlines()
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                insert_at = i + 1
        lines.insert(insert_at, 'import { usePathname } from "next/navigation";')
        text = "\n".join(lines) + ("\n" if original.endswith("\n") else "")

    export_name = "OwnerCockpit" if "OwnerCockpit.tsx" in str(path) else "OwnerDemoCockpit"
    pattern = rf'function BottomNav\(\) \{{[\s\S]*?\n\}}\n\nexport function {export_name}'
    replacement = cockpit_bottom_nav + f"export function {export_name}"
    text = re.sub(pattern, replacement, text, count=1)

    backup_and_write(path, original, text)

for scan_root in [app_root / "app/owner", app_root / "app/admin"]:
    if not scan_root.exists():
        continue

    for path in scan_root.rglob("*.tsx"):
        original = path.read_text()
        text = original

        if "@/components/owner/OwnerBottomNav" not in text:
            continue

        lines = text.splitlines()
        import_indexes = [
            i for i, line in enumerate(lines)
            if line.startswith("import ") and "@/components/owner/OwnerBottomNav" in line
        ]

        if len(import_indexes) > 1:
            needs_top = any("OwnerTopNav" in lines[i] for i in import_indexes)
            replacement = (
                'import OwnerBottomNav, { OwnerTopNav } from "@/components/owner/OwnerBottomNav";'
                if needs_top
                else 'import OwnerBottomNav from "@/components/owner/OwnerBottomNav";'
            )

            new_lines = []
            inserted = False
            for i, line in enumerate(lines):
                if i in import_indexes:
                    if not inserted:
                        new_lines.append(replacement)
                        inserted = True
                    continue
                new_lines.append(line)

            text = "\n".join(new_lines) + ("\n" if original.endswith("\n") else "")

        backup_and_write(path, original, text)

global_css = app_root / "app/globals.css"
if global_css.exists():
    original = global_css.read_text()
    text = original

    text = text.replace("--background: #ffffff;", "--background: #F6F3EF;")
    text = text.replace("--foreground: #171717;", "--foreground: #112532;")

    touch = r'''

/* Pilotys discreet surface polish */
::selection {
  background: rgba(224, 104, 14, 0.18);
  color: #112532;
}

html {
  background: #F6F3EF;
}

body {
  min-height: 100vh;
}

input,
textarea,
select {
  accent-color: #E0680E;
}

input:focus-visible,
textarea:focus-visible,
select:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: 2px solid rgba(224, 104, 14, 0.42);
  outline-offset: 3px;
}
'''
    if "Pilotys discreet surface polish" not in text:
        text += touch

    backup_and_write(global_css, original, text)

brand_replacements = [
    ("bg-gray-50", "bg-[#F6F3EF]"),
    ("bg-slate-50", "bg-[#F6F3EF]"),
    ("bg-neutral-50", "bg-[#F6F3EF]"),
    ("bg-zinc-50", "bg-[#F6F3EF]"),
    ("bg-slate-950", "bg-[#112532]"),
    ("text-slate-950", "text-[#112532]"),
    ("text-slate-900", "text-[#112532]"),
    ("text-slate-800", "text-[#112532]/86"),
    ("text-slate-700", "text-[#112532]/76"),
    ("text-slate-600", "text-[#112532]/62"),
    ("text-slate-500", "text-[#112532]/48"),
    ("text-slate-400", "text-[#112532]/36"),
    ("border-slate-200", "border-[#112532]/10"),
    ("border-gray-200", "border-[#112532]/10"),
    ("ring-slate-200", "ring-[#112532]/10"),
    ("ring-gray-200", "ring-[#112532]/10"),
    ("bg-blue-600", "bg-[#E0680E]"),
    ("hover:bg-blue-700", "hover:bg-[#C85C0C]"),
    ("text-blue-600", "text-[#E0680E]"),
    ("text-blue-700", "text-[#C85C0C]"),
    ("bg-emerald-50", "bg-[#ECFFF6]"),
    ("text-emerald-700", "text-[#0B6B53]"),
    ("bg-amber-50", "bg-[#FFF5DD]"),
    ("text-amber-700", "text-[#8A4D00]"),
]

def should_patch_page(path: Path) -> bool:
    s = str(path)
    if path.suffix != ".tsx":
        return False
    if "/app/owner/[ownerToken]/cockpit/" in s or "/app/owner/app/demo/" in s:
        return False
    return any(part in s for part in ["/app/owner/", "/app/admin/", "/app/cleaner/", "/app/mission/"])

for base in [app_root / "app/owner", app_root / "app/admin", app_root / "app/cleaner", app_root / "app/mission"]:
    if not base.exists():
        continue

    for path in base.rglob("*.tsx"):
        if not should_patch_page(path):
            continue

        original = path.read_text()
        text = original

        for old, new in brand_replacements:
            text = text.replace(old, new)

        text = text.replace(
            'className="min-h-screen bg-[#F6F3EF]"',
            'className="min-h-screen bg-[#F6F3EF] pb-24 text-[#112532]"',
        )
        text = text.replace(
            'className="min-h-screen bg-[#F6F3EF] text-[#112532]"',
            'className="min-h-screen bg-[#F6F3EF] pb-24 text-[#112532]"',
        )

        text = text.replace(
            'className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#112532]/10"',
            'className="rounded-[2rem] bg-white/92 p-6 shadow-sm ring-1 ring-[#112532]/8"',
        )
        text = text.replace(
            'className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#112532]/10"',
            'className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8"',
        )

        if (
            "Pilotys ·" not in text
            and "<main" in text
            and '<div className="mx-auto max-w-' in text
            and "/app/mission/" not in str(path)
        ):
            text = text.replace(
                '<div className="mx-auto max-w-',
                '<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8"><span className="h-2 w-2 rounded-full bg-[#E0680E]" />Pilotys · opération</div>\n        <div className="mx-auto max-w-',
                1,
            )

        backup_and_write(path, original, text)

if changed:
    print("Pilotys UI unification pass changed:")
    for item in changed:
        print(" -", item)
else:
    print("No files changed.")
PY

echo "Installed Pilotys UI unification pass v2"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
