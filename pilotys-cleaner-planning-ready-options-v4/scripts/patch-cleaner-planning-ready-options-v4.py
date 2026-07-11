from pathlib import Path
import sys

app_root = Path(sys.argv[1])
backup_dir = Path(sys.argv[2])

def backup_and_write(path: Path, before: str, after: str) -> None:
    if after == before:
        return
    rel = path.relative_to(app_root)
    backup = backup_dir / rel
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(before)
    path.write_text(after)
    print(f"Patched {rel}")

planning_path = app_root / "app/cleaner/[token]/planning/page.tsx"
if not planning_path.exists():
    raise SystemExit(f"Missing {planning_path}")

original = planning_path.read_text()
text = original

if "function groupReadyDayOptionsByRequestId" not in text:
    text = text.replace(
        "function KpiCard({",
        '''function groupReadyDayOptionsByRequestId(options: Row[]) {
  return options.reduce<Record<string, Row[]>>((acc, option) => {
    const requestId = String(option.cleaning_request_id ?? "");
    if (!requestId) return acc;

    if (!acc[requestId]) acc[requestId] = [];
    acc[requestId].push(option);
    return acc;
  }, {});
}

function KpiCard({''',
        1,
    )

text = text.replace(
    "  reservationsById,\n  currentCleanerId,\n  locale,\n}: {",
    "  reservationsById,\n  readyOptionsByRequestId,\n  currentCleanerId,\n  locale,\n}: {",
    1,
)

text = text.replace(
    "  reservationsById: Record<string, Row>;\n  currentCleanerId: string;",
    "  reservationsById: Record<string, Row>;\n  readyOptionsByRequestId: Record<string, Row[]>;\n  currentCleanerId: string;",
    1,
)

new_window_map = '''                      {propertyRequests.map((request) => {
                        if (!["created", "sent"].includes(String(request.status))) return null;
                        if (String(request.assigned_cleaner_id || "") !== currentCleanerId) return null;

                        const reservation = reservationsById[String(linkedReservationId(request) || "")];
                        const options = (readyOptionsByRequestId[String(request.id)] ?? []).filter((option) => option.is_available);

                        if (options.length > 0) {
                          return options.map((option) => {
                            const optionKey = dateKeyFrom(option.ready_by_at);
                            if (!optionKey) return null;

                            const center = centerForDateKey(optionKey, units);
                            if (center === null) return null;

                            const isSelected = Boolean(option.selected_at);
                            const href = `/mission/${request.public_token}/ready-day?option_id=${option.id}`;

                            return (
                              <Link
                                key={`${request.id}-option-${option.id}`}
                                href={href}
                                className={[
                                  "absolute top-0 flex h-[22px] min-w-[44px] -translate-x-1/2 items-center justify-center rounded-full px-2 text-[9px] font-black uppercase tracking-[0.08em] shadow-sm ring-1",
                                  isSelected
                                    ? "bg-[#112532] text-white ring-[#112532]"
                                    : "bg-[#FFF5DD] text-[#8A4D00] ring-[#F4B044]/35",
                                ].join(" ")}
                                style={{ left: center }}
                                title={`${option.label || copy.chooseDay} - ${copy.proposedWindow}`}
                              >
                                {option.label ? option.label.slice(0, 3) : copy.chooseDay}
                              </Link>
                            );
                          });
                        }

                        const startKey = dateKeyFrom(windowStartAt(request, reservation));
                        const endKey = dateKeyFrom(anchorAt(request));
                        if (!startKey || !endKey) return null;

                        const pos = rangePosition(startKey, endKey, units);
                        if (!pos) return null;

                        return (
                          <Link
                            key={`${request.id}-zone`}
                            href={`/mission/${request.public_token}/ready-day`}
                            className={`absolute top-0 h-[22px] rounded-full px-2 py-1 text-center text-[9px] font-black uppercase tracking-[0.08em] text-[#8A4D00] ring-1 ${palette.zone}`}
                            style={{ left: pos.left, width: pos.width }}
                            title={`${copy.proposedWindow} - ${statusLabel(request, false, locale)}`}
                          >
                            <span className="truncate">{copy.chooseDay}</span>
                          </Link>
                        );
                      })}'''

lane_markers = [
    '<div className="absolute left-0 right-0 top-[88px] h-[24px]">',
    '<div className="absolute left-0 right-0 top-[86px] h-[24px]">',
    '<div className="absolute left-0 right-0 top-[82px] h-[24px]">',
]
for marker in lane_markers:
    lane_start = text.find(marker)
    if lane_start != -1:
        map_start = text.find("{propertyRequests.map((request) => {", lane_start)
        lane_end = text.find("                    </div>", map_start)
        if map_start != -1 and lane_end != -1:
            text = text[:map_start] + new_window_map + "\n" + text[lane_end:]
            break

if "readyOptionsResult" not in text:
    old = '''  const cleanersResult = cleanerIds.length
    ? await supabase.from("cleaners").select("*").in("id", cleanerIds)
    : { data: [] };

  const cleaners = (cleanersResult.data ?? []) as Row[];
'''
    new = '''  const readyOptionRequestIds = visibleCalendarRequests
    .filter((request) => ["created", "sent"].includes(String(request.status)))
    .map((request) => request.id)
    .filter(Boolean);

  const readyOptionsResult = readyOptionRequestIds.length
    ? await supabase
        .from("cleaning_request_ready_day_options")
        .select("*")
        .in("cleaning_request_id", readyOptionRequestIds)
        .order("ready_by_at", { ascending: true })
    : { data: [] };

  const readyOptionsByRequestId = groupReadyDayOptionsByRequestId((readyOptionsResult.data ?? []) as Row[]);

  const cleanersResult = cleanerIds.length
    ? await supabase.from("cleaners").select("*").in("id", cleanerIds)
    : { data: [] };

  const cleaners = (cleanersResult.data ?? []) as Row[];
'''
    if old not in text:
        raise SystemExit("Could not find cleaner query block to insert ready-day options.")
    text = text.replace(old, new, 1)

if "readyOptionsByRequestId={readyOptionsByRequestId}" not in text:
    text = text.replace(
        "          reservationsById={reservationsById}\n          currentCleanerId={String(cleaner.id)}",
        "          reservationsById={reservationsById}\n          readyOptionsByRequestId={readyOptionsByRequestId}\n          currentCleanerId={String(cleaner.id)}",
        1,
    )

backup_and_write(planning_path, original, text)

ready_path = app_root / "app/mission/[token]/ready-day/page.tsx"
if ready_path.exists():
    before = ready_path.read_text()
    rt = before

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

    backup_and_write(ready_path, before, rt)
