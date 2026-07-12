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

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/cleaner-planning-ready-options-v6-$STAMP"
mkdir -p "$BACKUP_DIR"

python - "$APP_ROOT" "$BACKUP_DIR" <<'PY'
from pathlib import Path
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

old_group = '''function groupReadyDayOptionsByRequestId(options: Row[]) {
  return options.reduce<Record<string, Row[]>>((acc, option) => {
    const requestId = String(option.cleaning_request_id ?? "");
    if (!requestId) return acc;

    if (!acc[requestId]) acc[requestId] = [];
    acc[requestId].push(option);
    return acc;
  }, {});
}

function KpiCard({'''

new_group = '''function groupReadyDayOptionsByRequestId(options: Row[]) {
  return options.reduce<Record<string, Row[]>>((acc, option) => {
    const requestId = String(option.cleaning_request_id ?? "");
    if (!requestId) return acc;

    if (!acc[requestId]) acc[requestId] = [];
    acc[requestId].push(option);
    return acc;
  }, {});
}

function readyOptionShortLabel(option: Row) {
  if (option.ready_by_date) return String(option.ready_by_date).slice(8, 10);

  const value = option.ready_by_at ? String(option.ready_by_at) : "";
  if (value.length >= 10) return value.slice(8, 10);

  return option.label ? String(option.label).slice(0, 3) : "OK";
}

function KpiCard({'''

if "function readyOptionShortLabel" not in text:
    if old_group not in text:
        raise SystemExit("Could not find groupReadyDayOptionsByRequestId block.")
    text = text.replace(old_group, new_group, 1)

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

overlay = '''                    <div className="absolute left-0 right-0 top-[86px] z-30 h-[30px]">
                      {propertyRequests.flatMap((request) => {
                        if (!["created", "sent"].includes(String(request.status))) return [];
                        if (String(request.assigned_cleaner_id || "") !== currentCleanerId) return [];

                        const options = readyOptionsByRequestId[String(request.id)] ?? [];

                        return options.flatMap((option) => {
                          const optionKey = dateKeyFrom(option.ready_by_at);
                          if (!optionKey) return [];

                          const center = centerForDateKey(optionKey, units);
                          if (center === null) return [];

                          return [
                            <Link
                              key={`${request.id}-ready-option-${option.id}`}
                              href={`/mission/${request.public_token}/ready-day?option_id=${option.id}`}
                              className="absolute top-0 flex h-[28px] min-w-[42px] -translate-x-1/2 items-center justify-center rounded-full bg-[#FFF5DD] px-2 text-[10px] font-black text-[#8A4D00] shadow-sm ring-2 ring-[#F4B044]/45"
                              style={{ left: center }}
                              title={`${option.label || copy.chooseDay} - ${copy.proposedWindow}`}
                            >
                              {readyOptionShortLabel(option)}
                            </Link>,
                          ];
                        });
                      })}
                    </div>

'''

if "-ready-option-" not in text:
    marker = '''                    <div className="absolute left-0 right-0 top-[106px] h-[40px]">
                      {propertyRequests.map((request) => {'''
    if marker not in text:
        raise SystemExit("Could not find mission bubble layer to insert ready-option overlay.")
    text = text.replace(marker, overlay + marker, 1)

backup_and_write(planning, before, text)

ready = app_root / "app/mission/[token]/ready-day/page.tsx"
if ready.exists():
    rb = ready.read_text()
    rt = rb

    rt = rt.replace(
        '''export default async function MissionReadyDayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;''',
        '''export default async function MissionReadyDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ option_id?: string }>;
}) {
  const { token } = await params;
  const query = searchParams ? await searchParams : {};
  const highlightedOptionId = String(query?.option_id ?? "");''',
        1,
    )

    if "const isHighlighted = String(option.id) === highlightedOptionId;" not in rt:
        rt = rt.replace(
            '''                {availableOptions.map((option) => (
                  <form key={option.id} action={acceptMissionReadyDay}>''',
            '''                {availableOptions.map((option) => {
                  const isHighlighted = String(option.id) === highlightedOptionId;

                  return (
                  <form key={option.id} action={acceptMissionReadyDay}>''',
            1,
        )

        rt = rt.replace(
            '''                    <button className="w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] p-4 text-left transition hover:bg-slate-100">''',
            '''                    <button
                      className={[
                        "w-full rounded-2xl border p-4 text-left transition",
                        isHighlighted
                          ? "border-[#E0680E] bg-[#FFF5DD] shadow-sm ring-2 ring-[#E0680E]/20"
                          : "border-[#112532]/10 bg-[#F6F3EF] hover:bg-white",
                      ].join(" ")}
                    >''',
            1,
        )

        rt = rt.replace(
            '''                  </form>
                ))}''',
            '''                  </form>
                  );
                })}''',
            1,
        )

    backup_and_write(ready, rb, rt)

PY

echo "Installed cleaner planning ready options v6"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
