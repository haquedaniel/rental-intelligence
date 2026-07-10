#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ ! -d "$ROOT/apps/cleaner-web" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web to exist."
  exit 1
fi

python - <<'PY'
from pathlib import Path
import re

candidate_roots = [
    Path("apps/cleaner-web/components/owner-planning"),
    Path("apps/cleaner-web/app/owner"),
    Path("apps/cleaner-web/components"),
]

paths = []
for root in candidate_roots:
    if root.exists():
        paths.extend([
            p for p in root.rglob("*.tsx")
            if "OwnerTimeline" in p.name or "planning" in str(p).lower() or "cockpit" in str(p).lower()
        ])

changed = []

helper = '''
function calendarDayPriceAmount(day: Row | null | undefined): number | null {
  if (!day) return null;

  const fields = [
    "price_eur",
    "daily_price_eur",
    "rate_eur",
    "recommended_price_eur",
    "public_price_eur",
    "base_price_eur",
    "available_price_eur",
    "min_price_eur",
  ];

  for (const field of fields) {
    const value = day[field];
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

function calendarDayPriceLabel(day: Row | null | undefined): string | null {
  const amount = calendarDayPriceAmount(day);
  if (!amount) return null;

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function isCalendarDayBooked(day: Row | null | undefined): boolean {
  if (!day) return false;

  return Boolean(
    day.reservation_id ||
    day.booking_id ||
    day.source_booking_id ||
    day.is_booked ||
    day.booked ||
    day.occupied ||
    day.status === "booked" ||
    day.status === "occupied",
  );
}

'''

def add_helper(text: str) -> str:
    if "function calendarDayPriceLabel" in text:
        return text

    m = re.search(r"type Row = [^;]+;\n", text)
    if m:
        return text[:m.end()] + helper + text[m.end():]

    m = re.search(r"function [A-Za-z0-9_]*Date", text)
    if m:
        return text[:m.start()] + helper + text[m.start():]

    return helper + text

def add_free_day_price_to_day_cell(text: str) -> str:
    if "calendarDayPriceLabel(day)" in text and "isCalendarDayBooked(day)" in text and "Prix jour libre" in text:
        return text

    # Common pattern: days.map((day) => <div ...>...</div>)
    # Insert a subtle price pill inside day cells before the closing div where day is in scope.
    candidates = [
        r'(\{days\.map\(\(day[,\s\w]*\) => \(\s*<div[^>]*className="[^"]*"[^>]*>[\s\S]*?)(\s*</div>\s*\)\))',
        r'(\{planningDays\.map\(\(day[,\s\w]*\) => \(\s*<div[^>]*className="[^"]*"[^>]*>[\s\S]*?)(\s*</div>\s*\)\))',
        r'(\{calendarDays\.map\(\(day[,\s\w]*\) => \(\s*<div[^>]*className="[^"]*"[^>]*>[\s\S]*?)(\s*</div>\s*\)\))',
    ]

    snippet = '''
                  {!isCalendarDayBooked(day) && calendarDayPriceLabel(day) ? (
                    <span
                      title="Prix jour libre"
                      className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-black text-[#112532]/38 ring-1 ring-[#112532]/5"
                    >
                      {calendarDayPriceLabel(day)}
                    </span>
                  ) : null}
'''

    for pattern in candidates:
        new_text, count = re.subn(pattern, lambda m: m.group(1) + snippet + m.group(2), text, count=1, flags=re.S)
        if count:
            return new_text

    return text

def ensure_day_cells_relative(text: str) -> str:
    # Price label is absolute; day grid cells need relative if they are the mapped day cells.
    text = re.sub(
        r'(<div([^>]*)className="([^"]*\bmin-w-\[[^"]*|\bgrid\b[^"]*border[^"]*|\bday\b[^"]*)")',
        lambda m: m.group(1) if " relative" in m.group(3) or m.group(3).startswith("relative ") else m.group(1)[:-1] + " relative\"",
        text,
        flags=re.I,
    )
    return text

for path in paths:
    original = path.read_text()
    text = original

    # Need some evidence that file renders planning days/calendar cells.
    if not any(token in text for token in ["days.map", "planningDays.map", "calendarDays.map", "analytics_daily_calendar", "dailyCalendar"]):
        continue

    text = add_helper(text)
    text = ensure_day_cells_relative(text)
    text = add_free_day_price_to_day_cell(text)

    if text != original:
        backup = Path(".pilotys-backups/owner-calendar-free-day-prices-v1-inline") / path
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
    print("No matching calendar day-cell file changed. The free-day prices may be rendered from a different component/name.")
PY

echo "Installed owner calendar free-day prices v1"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
