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

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/cleaner-planning-timeline-v2-$STAMP"
mkdir -p "$BACKUP_DIR"

python - "$APP_ROOT" "$BACKUP_DIR" <<'PY'
from pathlib import Path
import re
import sys

app_root = Path(sys.argv[1])
backup_dir = Path(sys.argv[2])

path = app_root / "app/cleaner/[token]/planning/page.tsx"
if not path.exists():
    raise SystemExit(f"Missing {path}")

original = path.read_text()
text = original

text = text.replace(
    "const HORIZON_DAYS = 184;",
    "const HISTORY_DAYS = 7;\nconst HORIZON_DAYS = 191;",
)

text = text.replace(
    "  const units = Array.from({ length: HORIZON_DAYS }, (_, index) => addDays(today, index));",
    "  const calendarStartKey = addDays(today, -HISTORY_DAYS);\n  const todayIndex = HISTORY_DAYS;\n  const units = Array.from({ length: HORIZON_DAYS }, (_, index) => addDays(calendarStartKey, index));",
    1,
)

text = re.sub(
    "\\s*<p className=\"mt-0\\.5 text-\\[10px\\] font-bold uppercase tracking-\\[0\\.12em\\] text-\\[#112532\\]/36\">\\s*\\{palette\\.key\\}\\s*</p>",
    "",
    text,
    flags=re.S,
)

text = re.sub(
    "\\s*<div className=\"absolute left-3 top-2 z-30 rounded-full bg-white/90 px-2\\.5 py-1 text-\\[10px\\] font-black text-\\[#112532\\]/62 shadow-sm ring-1 ring-\\[#112532\\]/8\">\\s*\\{propertyName\\(property, locale\\)\\}\\s*</div>",
    "",
    text,
    flags=re.S,
)

text = text.replace(
    '<div className="absolute left-0 right-0 top-10 h-[36px]">',
    '<div className="absolute left-0 right-0 top-8 h-[54px]">',
    1,
)

text = text.replace(
    "const className = `absolute top-0 h-[30px] overflow-hidden rounded-full px-3 py-1 text-[10px] font-black shadow-sm ${palette.stay}`;",
    "const className = `absolute top-0 flex h-[48px] flex-col justify-center overflow-hidden rounded-[1.4rem] px-3 py-1 text-[10px] font-black shadow-sm ${palette.stay}`;",
    1,
)

text = text.replace(
    '<p className="truncate">{guestName(reservation, locale)}</p>',
    '<p className="truncate text-[11px] leading-tight">{guestName(reservation, locale)}</p>\n                              <p className="truncate text-[9px] leading-tight opacity-70">{compactDateLabel(reservation.checkin_at, locale)} → {compactDateLabel(reservation.checkout_at, locale)}</p>',
    1,
)
text = text.replace(
    '<p className="truncate">{guestName(reservation, locale)}</p>',
    '<p className="truncate text-[11px] leading-tight">{guestName(reservation, locale)}</p>\n                            <p className="truncate text-[9px] leading-tight opacity-70">{compactDateLabel(reservation.checkin_at, locale)} → {compactDateLabel(reservation.checkout_at, locale)}</p>',
    1,
)

text = text.replace(
    '<div className="absolute left-0 right-0 top-[82px] h-[24px]">',
    '<div className="absolute left-0 right-0 top-[86px] h-[24px]">',
    1,
)
text = text.replace(
    '<div className="absolute left-0 right-0 top-[106px] h-[40px]">',
    '<div className="absolute left-0 right-0 top-[114px] h-[40px]">',
    1,
)
text = text.replace(
    '<div className="absolute left-0 right-0 top-28 h-px border-t border-dashed border-[#112532]/10" />',
    '<div className="absolute left-0 right-0 top-[108px] h-px border-t border-dashed border-[#112532]/10" />',
    1,
)

connector_block = """
                    <div className="pointer-events-none absolute left-0 right-0 top-[78px] h-[42px]">
                      {propertyRequests.map((request) => {
                        const anchor = dateKeyFrom(anchorAt(request));
                        if (!anchor) return null;
                        const center = centerForDateKey(anchor, units);
                        if (center === null) return null;

                        const reservation = reservationsById[String(linkedReservationId(request) || "")];
                        if (!reservation) return null;

                        return (
                          <div
                            key={`${request.id}-connector`}
                            className={`absolute top-0 h-[42px] border-l-2 border-dashed ${palette.line}`}
                            style={{ left: center }}
                          />
                        );
                      })}
                    </div>

"""
if "key={`${request.id}-connector`}" not in text:
    text = text.replace(
        '                    <div className="absolute left-0 right-0 top-[114px] h-[40px]">',
        connector_block + '                    <div className="absolute left-0 right-0 top-[114px] h-[40px]">',
        1,
    )

old = """  const showPhoto = Boolean(cleaner?.signedPhotoUrl) && ["accepted", "completed", "report_submitted"].includes(String(request.status));
  const title = `${cleanerName(cleaner, mine ? c(locale).mine : c(locale).otherCleaner)} · ${statusLabel(request, overdue, locale)} · ${fullDateLabel(anchorAt(request), locale)}`;

  const classes = [
    "absolute top-0 flex h-10 w-10 items-center justify-center rounded-full text-sm font-black shadow-sm ring-2 transition",
    missionOutlineClass(request, overdue, mine),
    missionBubbleFillClass(request, mine),
    mine ? "hover:scale-105" : "opacity-72",
  ].join(" ");

  const content = showPhoto ? (
    <CleanerAvatar cleaner={cleaner} fallback={mine ? "M" : "?"} />
  ) : (
    <span>{calendarMissionIcon(request, overdue)}</span>
  );"""

new = """  const showIdentity = ["accepted", "completed", "report_submitted"].includes(String(request.status));
  const title = `${cleanerName(cleaner, mine ? c(locale).mine : c(locale).otherCleaner)} · ${statusLabel(request, overdue, locale)} · ${fullDateLabel(anchorAt(request), locale)}`;

  const classes = [
    "absolute top-0 flex h-10 w-10 items-center justify-center rounded-full text-sm font-black shadow-sm ring-2 transition",
    missionOutlineClass(request, overdue, mine),
    missionBubbleFillClass(request, mine),
    mine ? "hover:scale-105" : "opacity-72",
  ].join(" ");

  const content = showIdentity ? (
    <CleanerAvatar cleaner={cleaner} fallback={mine ? "M" : "?"} />
  ) : (
    <span>{calendarMissionIcon(request, overdue)}</span>
  );"""

text = text.replace(old, new, 1)

text = text.replace(
    '<div className="mt-3 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-[1.7rem] bg-[#F6F3EF] pb-3">',
    '<div className="mt-3 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-[1.7rem] bg-[#F6F3EF] pb-3" data-cleaner-timeline-scroll data-today-index={todayIndex} data-day-width={DAY_WIDTH}>',
    1,
)

scroll_script = """      <script
        dangerouslySetInnerHTML={{
          __html: `
            requestAnimationFrame(() => {
              const el = document.querySelector('[data-cleaner-timeline-scroll]');
              if (!el) return;
              const todayIndex = Number(el.getAttribute('data-today-index') || 0);
              const dayWidth = Number(el.getAttribute('data-day-width') || 52);
              const target = Math.max(0, todayIndex * dayWidth - 120);
              el.scrollLeft = target;
            });
          `,
        }}
      />
"""
if "data-cleaner-timeline-scroll" in text and "todayIndex * dayWidth" not in text:
    text = text.replace(
        '      <CleanerBottomNav cleanerToken={token} active="planning" locale={locale} />',
        scroll_script + '\n      <CleanerBottomNav cleanerToken={token} active="planning" locale={locale} />',
        1,
    )

text = text.replace(
    "  const calendarStart = new Date(`${today}T00:00:00.000Z`);",
    "  const calendarStartKey = addDays(today, -HISTORY_DAYS);\n  const calendarStart = new Date(`${calendarStartKey}T00:00:00.000Z`);",
    1,
)

if text != original:
    rel = path.relative_to(app_root)
    backup = backup_dir / rel
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(original)
    path.write_text(text)
    print(f"Patched {rel}")
else:
    print("No cleaner planning timeline v2 changes needed.")
PY

echo "Installed cleaner planning timeline v2"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
