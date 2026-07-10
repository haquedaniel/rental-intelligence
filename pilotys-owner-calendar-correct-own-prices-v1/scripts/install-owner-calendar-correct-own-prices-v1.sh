#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/owner-calendar-correct-own-prices-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

python - <<'PY'
from pathlib import Path
import re

targets = [
    Path("apps/cleaner-web/app/owner/[ownerToken]/cockpit/OwnerCockpit.tsx"),
    Path("apps/cleaner-web/app/owner/app/demo/OwnerDemoCockpit.tsx"),
]

changed = []

new_helpers = '''
function calendarDayIsBookable(day: Record<string, any> | null | undefined): boolean {
  if (!day) return false;

  if ("bookable" in day) {
    const value = day.bookable;
    if (value === true || value === "true" || value === 1 || value === "1") return true;
    return false;
  }

  if ("units_available" in day || "unitsAvailable" in day) {
    const units = Number(day.units_available ?? day.unitsAvailable ?? 0);
    if (!Number.isFinite(units) || units <= 0) return false;
  }

  const status = String(day.status || "").toLowerCase();
  if (status && !["success_available", "available", "bookable", "open"].includes(status)) {
    return false;
  }

  return true;
}

function calendarDayPriceAmount(day: Record<string, any> | null | undefined): number | null {
  if (!day) return null;
  if (!calendarDayIsBookable(day)) return null;

  const nightlyFields = [
    "own_nightly_amount",
    "ownNightlyAmount",
    "nightly_amount",
    "nightly_price_eur",
    "available_price_eur",
    "public_price_eur",
    "recommended_price_eur",
    "daily_price_eur",
    "rate_eur",
    "price_eur",
  ];

  for (const field of nightlyFields) {
    const value = day[field];
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 25) return parsed;
  }

  const totalFields = [
    "own_total_amount",
    "ownTotalAmount",
    "total_amount",
    "offer_price",
  ];

  const nights = Number(day.nights || day.length_of_stay || day.stay_nights || 1);

  for (const field of totalFields) {
    const value = day[field];
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) continue;

    const nightly = Number.isFinite(nights) && nights > 0 ? parsed / nights : parsed;
    if (nightly >= 25) return nightly;
  }

  return null;
}

function calendarDayPriceLabel(day: Record<string, any> | null | undefined): string | null {
  const amount = calendarDayPriceAmount(day);
  if (!amount) return null;

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function isCalendarDayBooked(day: Record<string, any> | null | undefined): boolean {
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

patterns = [
    r'function calendarDayIsBookable\(day: Record<string, any> \| null \| undefined\): boolean \{[\s\S]*?\n\}\n\nfunction calendarDayPriceAmount\(day: Record<string, any> \| null \| undefined\): number \| null \{[\s\S]*?\n\}\n\nfunction calendarDayPriceLabel\(day: Record<string, any> \| null \| undefined\): string \| null \{[\s\S]*?\n\}\n\nfunction isCalendarDayBooked\(day: Record<string, any> \| null \| undefined\): boolean \{[\s\S]*?\n\}\n',
    r'function calendarDayPriceAmount\(day: Record<string, any> \| null \| undefined\): number \| null \{[\s\S]*?\n\}\n\nfunction calendarDayPriceLabel\(day: Record<string, any> \| null \| undefined\): string \| null \{[\s\S]*?\n\}\n\nfunction isCalendarDayBooked\(day: Record<string, any> \| null \| undefined\): boolean \{[\s\S]*?\n\}\n',
]

for path in targets:
    if not path.exists():
        print(f"Missing {path}; skipped.")
        continue

    text = path.read_text()
    original = text

    if "calendarDayPriceAmount" not in text:
        print(f"No calendar day price helper in {path}; skipped.")
        continue

    replaced = False
    for pattern in patterns:
        text2, count = re.subn(pattern, new_helpers, text, count=1, flags=re.S)
        if count:
            text = text2
            replaced = True
            break

    if not replaced:
        text = text.replace("function calendarDayPriceAmount(", "function legacyCalendarDayPriceAmount(", 1)
        text = text.replace("function calendarDayPriceLabel(", "function legacyCalendarDayPriceLabel(", 1)
        text = text.replace("function isCalendarDayBooked(", "function legacyIsCalendarDayBooked(", 1)
        text = text.replace("function legacyCalendarDayPriceAmount", new_helpers + "\nfunction legacyCalendarDayPriceAmount", 1)

    text = text.replace("{Math.round(price.price)}€", "{calendarDayPriceLabel(price)}")
    text = text.replace("{!covered && price ? (", "{!covered && price && calendarDayPriceLabel(price) ? (")

    if text != original:
        backup = Path(".pilotys-backups/owner-calendar-correct-own-prices-v1-inline") / path
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_text(original)
        path.write_text(text)
        changed.append(str(path))

if changed:
    print("Patched owner calendar price helpers in:")
    for item in changed:
        print(" -", item)
else:
    print("No owner calendar price helper files changed.")
PY

echo "Installed owner calendar correct own prices v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
