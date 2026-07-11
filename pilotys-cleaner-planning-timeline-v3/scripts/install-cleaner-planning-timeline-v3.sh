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

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/cleaner-planning-timeline-v3-$STAMP"
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

# 1) Add helper for reservation checkout connector anchor.
if "function reservationCheckoutCenter" not in text:
    helper = '''
function reservationCheckoutCenter(reservation: Row | null | undefined, units: string[]) {
  if (!reservation?.checkout_at) return null;
  const checkout = dateKeyFrom(reservation.checkout_at);
  if (!checkout) return null;

  const offset = daysBetween(units[0], checkout);
  const center = offset * DAY_WIDTH + DAY_WIDTH / 2;

  if (center < 0 || center > units.length * DAY_WIDTH) return null;
  return center;
}

'''
    needle = "function rangePosition(startKey: string, endKey: string, units: string[]) {"
    text = text.replace(needle, helper + needle, 1)

# 2) Hide vertical scrollbar and improve touch scrolling.
text = text.replace(
    'className="mt-3 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-[1.7rem] bg-[#F6F3EF] pb-3" data-cleaner-timeline-scroll data-today-index={todayIndex} data-day-width={DAY_WIDTH}>',
    'className="mt-3 w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[1.7rem] bg-[#F6F3EF] pb-3 [scrollbar-width:thin]" data-cleaner-timeline-scroll data-today-index={todayIndex} data-day-width={DAY_WIDTH}>',
    1,
)
text = text.replace(
    'className="mt-3 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-[1.7rem] bg-[#F6F3EF] pb-3">',
    'className="mt-3 w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[1.7rem] bg-[#F6F3EF] pb-3 [scrollbar-width:thin]" data-cleaner-timeline-scroll data-today-index={todayIndex} data-day-width={DAY_WIDTH}>',
    1,
)

# 3) Increase row height / mission lane room so avatar bubbles are not clipped.
text = text.replace('className="relative h-[136px]"', 'className="relative h-[168px]"')
text = text.replace('top-[114px] h-[40px]', 'top-[122px] h-[52px]')
text = text.replace('top-[86px] h-[24px]', 'top-[88px] h-[24px]')
text = text.replace('top-[78px] h-[42px]', 'top-[82px] h-[50px]')
text = text.replace('h-[42px] border-l-2', 'h-[50px] border-l-2')

# 4) Remove the whole-row dashed horizontal line.
text = text.replace(
    '                    <div className="absolute left-0 right-0 top-[108px] h-px border-t border-dashed border-[#112532]/10" />\n\n',
    '',
)

# 5) Replace connector block: from pure vertical to a small link from reservation checkout to mission bubble.
old_connector = '''
                    <div className="pointer-events-none absolute left-0 right-0 top-[82px] h-[50px]">
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
                            className={`absolute top-0 h-[50px] border-l-2 border-dashed ${palette.line}`}
                            style={{ left: center }}
                          />
                        );
                      })}
                    </div>

'''

new_connector = '''
                    <div className="pointer-events-none absolute left-0 right-0 top-[80px] h-[58px]">
                      {propertyRequests.map((request) => {
                        const anchor = dateKeyFrom(anchorAt(request));
                        if (!anchor) return null;

                        const missionCenter = centerForDateKey(anchor, units);
                        if (missionCenter === null) return null;

                        const reservation = reservationsById[String(linkedReservationId(request) || "")];
                        if (!reservation) return null;

                        const stayCenter = reservationCheckoutCenter(reservation, units);
                        if (stayCenter === null) return null;

                        const left = Math.min(stayCenter, missionCenter);
                        const width = Math.max(Math.abs(missionCenter - stayCenter), 2);
                        const verticalLeft = missionCenter;

                        return (
                          <div key={`${request.id}-connector`}>
                            <div
                              className={`absolute top-[12px] h-px border-t-2 border-dashed ${palette.line}`}
                              style={{ left, width }}
                            />
                            <div
                              className={`absolute top-[12px] h-[38px] border-l-2 border-dashed ${palette.line}`}
                              style={{ left: verticalLeft }}
                            />
                          </div>
                        );
                      })}
                    </div>

'''

if old_connector in text:
    text = text.replace(old_connector, new_connector, 1)
else:
    text = re.sub(
        r'\s*<div className="pointer-events-none absolute left-0 right-0 top-\[[0-9]+px\] h-\[[0-9]+px\]">\s*\{propertyRequests\.map\(\(request\) => \{[\s\S]*?key=\{`\$\{request\.id\}-connector`\}[\s\S]*?\}\)\}\s*</div>\s*',
        "\n" + new_connector,
        text,
        count=1,
    )

# 6) Centre today properly using container width.
old_scroll = '''              const target = Math.max(0, todayIndex * dayWidth - 120);
              el.scrollLeft = target;'''
new_scroll = '''              const target = Math.max(0, todayIndex * dayWidth - (el.clientWidth / 2) + (dayWidth / 2));
              el.scrollLeft = target;
              setTimeout(() => {
                el.scrollLeft = target;
              }, 120);'''
text = text.replace(old_scroll, new_scroll, 1)

scroll_script = '''      <script
        dangerouslySetInnerHTML={{
          __html: `
            requestAnimationFrame(() => {
              const el = document.querySelector('[data-cleaner-timeline-scroll]');
              if (!el) return;
              const todayIndex = Number(el.getAttribute('data-today-index') || 0);
              const dayWidth = Number(el.getAttribute('data-day-width') || 52);
              const target = Math.max(0, todayIndex * dayWidth - (el.clientWidth / 2) + (dayWidth / 2));
              el.scrollLeft = target;
              setTimeout(() => {
                el.scrollLeft = target;
              }, 120);
            });
          `,
        }}
      />
'''
if "data-cleaner-timeline-scroll" in text and "el.clientWidth / 2" not in text:
    text = text.replace(
        '      <CleanerBottomNav cleanerToken={token} active="planning" locale={locale} />',
        scroll_script + '\n      <CleanerBottomNav cleanerToken={token} active="planning" locale={locale} />',
        1,
    )

# 7) Ensure property rows allow visible overflow internally.
text = text.replace(
    '<div key={propertyId} className="relative bg-white" style={{ width: timelineWidth }}>',
    '<div key={propertyId} className="relative overflow-visible bg-white" style={{ width: timelineWidth }}>',
)

# 8) If the mission row still contains the old duplicate empty pass, remove it.
text = re.sub(
    r'\s*<div className="absolute left-0 right-0 top-\[[0-9]+px\] h-\[[0-9]+px\]">\s*\{propertyRequests\.map\(\(request\) => \{[\s\S]*?return null;\s*\}\)\}\s*</div>\s*(?=\n\s*<div className="absolute left-0 right-0 top-\[[0-9]+px\] h-\[[0-9]+px\]">)',
    "\n",
    text,
    count=1,
)

if text != original:
    rel = path.relative_to(app_root)
    backup = backup_dir / rel
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(original)
    path.write_text(text)
    print(f"Patched {rel}")
else:
    print("No cleaner planning timeline v3 changes needed.")
PY

echo "Installed cleaner planning timeline v3"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
