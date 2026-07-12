#!/usr/bin/env bash
set -euo pipefail

START_DIR="$(pwd)"
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

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/cleaner-planning-ready-range-v7-$STAMP"
mkdir -p "$BACKUP_DIR"

python - "$APP_ROOT" "$BACKUP_DIR" <<'PY'
from pathlib import Path
import re
import sys

app_root = Path(sys.argv[1])
backup_dir = Path(sys.argv[2])

def backup_and_write(path: Path, before: str, after: str) -> None:
    if before == after:
        return

    rel = path.relative_to(app_root)
    backup = backup_dir / rel
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(before)
    path.write_text(after)
    print(f"Patched {rel}")

planning = app_root / "app/cleaner/[token]/planning/page.tsx"
if not planning.exists():
    raise SystemExit(f"Missing {planning}")

before = planning.read_text()
text = before

# 1) Add helper for a single range bar from existing ready-day options.
if "function readyOptionRangePosition" not in text:
    helper = '''function readyOptionRangePosition(options: Row[], units: string[]) {
  const keys = options
    .map((option) => dateKeyFrom(option.ready_by_at))
    .filter((key): key is string => Boolean(key))
    .sort();

  if (keys.length === 0) return null;

  return rangePosition(keys[0], keys[keys.length - 1], units);
}

'''
    text = text.replace("function KpiCard({", helper + "function KpiCard({", 1)

# 2) Remove the previous individual day-chip overlay if present.
text = re.sub(
    r'\n\s*<div className="absolute left-0 right-0 top-\[86px\] z-30 h-\[30px\]">\s*\{propertyRequests\.flatMap\(\(request\) => \{[\s\S]*?-ready-option-\$\{option\.id\}[\s\S]*?\}\)\}\s*</div>\n',
    "\n",
    text,
    count=1,
)

# 3) Add a single possible-range bar overlay.
range_overlay = '''                    <div className="absolute left-0 right-0 top-[86px] z-30 h-[30px]">
                      {propertyRequests.map((request) => {
                        if (!["created", "sent"].includes(String(request.status))) return null;
                        if (String(request.assigned_cleaner_id || "") !== currentCleanerId) return null;

                        const options = readyOptionsByRequestId[String(request.id)] ?? [];
                        if (options.length === 0) return null;

                        const pos = readyOptionRangePosition(options, units);
                        if (!pos) return null;

                        const first = options[0];
                        const last = options[options.length - 1];
                        const label =
                          options.length === 1
                            ? `${copy.chooseDay} · ${compactDateLabel(first.ready_by_at, locale)}`
                            : `${copy.chooseDay} · ${compactDateLabel(first.ready_by_at, locale)} → ${compactDateLabel(last.ready_by_at, locale)}`;

                        return (
                          <Link
                            key={`${request.id}-ready-range`}
                            href={`/mission/${request.public_token}/ready-day`}
                            className="absolute top-0 flex h-[28px] items-center justify-center rounded-full bg-[#FFF5DD] px-3 text-[10px] font-black text-[#8A4D00] shadow-sm ring-2 ring-[#F4B044]/45"
                            style={{ left: pos.left, width: pos.width }}
                            title={`${copy.proposedWindow} · ${label}`}
                          >
                            <span className="truncate">{label}</span>
                          </Link>
                        );
                      })}
                    </div>

'''

if "-ready-range" not in text:
    marker = '''                    <div className="absolute left-0 right-0 top-[106px] h-[40px]">
                      {propertyRequests.map((request) => {'''
    if marker not in text:
        marker = '''                    <div className="absolute left-0 right-0 top-[122px] h-[52px]">
                      {propertyRequests.map((request) => {'''
    if marker not in text:
        raise SystemExit("Could not find mission bubble layer to insert ready range overlay.")
    text = text.replace(marker, range_overlay + marker, 1)

# 4) Hide the generic mission bubble when a proper ready-option range exists.
needle = '''                      {propertyRequests.map((request) => {
                        const anchor = dateKeyFrom(anchorAt(request));'''
replacement = '''                      {propertyRequests.map((request) => {
                        if (
                          ["created", "sent"].includes(String(request.status)) &&
                          (readyOptionsByRequestId[String(request.id)] ?? []).length > 0
                        ) {
                          return null;
                        }

                        const anchor = dateKeyFrom(anchorAt(request));'''

text = text.replace(needle, replacement, 1)

# 5) Harden query to only available options if not already.
text = text.replace(
    '''        .from("cleaning_request_ready_day_options")
        .select("*")
        .in("cleaning_request_id", readyOptionRequestIds)
        .order("ready_by_at", { ascending: true })''',
    '''        .from("cleaning_request_ready_day_options")
        .select("*")
        .in("cleaning_request_id", readyOptionRequestIds)
        .eq("is_available", true)
        .order("ready_by_at", { ascending: true })''',
    1,
)

backup_and_write(planning, before, text)

PY

echo "Installed cleaner planning ready range v7"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
