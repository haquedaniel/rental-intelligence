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

BACKUP_DIR="$REPO_ROOT/.pilotys-backups/live-cleaner-polish-v1-$STAMP"
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

copy_file "components/owner/ReservationInstructionSubmitButton.tsx"

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

def add_import(text: str, import_line: str) -> str:
    if import_line in text:
        return text

    lines = text.splitlines()
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, import_line)
    return "\n".join(lines) + ("\n" if text.endswith("\n") else "")

reservation_page = app_root / "app/owner/reservations/[reservationId]/page.tsx"
if reservation_page.exists():
    original = reservation_page.read_text()
    text = original

    text = add_import(text, 'import ReservationInstructionSubmitButton from "@/components/owner/ReservationInstructionSubmitButton";')

    if "const preparationInstructionLocked" not in text:
        needle = "  const latestReport = latestReportResult.data as Row | null;\n"
        insert = '''  const preparationInstructionLocked = [preparationMission, checkoutMission, ...cleaningRequests].some((request) =>
    ["completed", "report_submitted", "problem_reported", "cancelled"].includes(String(request?.status ?? "")),
  );

'''
        if needle in text:
            text = text.replace(needle, needle + "\n" + insert, 1)

    text = text.replace("Instruction préparation", "Important notes")
    text = text.replace("À montrer à l’intervenante", "Add any important notes")
    text = text.replace(
        "Cette note appartient à ce séjour. La mission qui prépare ce séjour l’affichera en priorité sur la page mission de l’intervenante.",
        "Add anything the cleaner must know for this specific stay. These notes appear on the cleaner checklist/report page.",
    )
    text = text.replace(
        'placeholder="Ex. Installer le lit bébé dans la chambre, prévoir draps canapé-lit, attention animal, horaire particulier..."',
        'placeholder="Example: cot in the main bedroom, sofa-bed linen, pet attention, special timing..."',
    )

    text = text.replace(
        '              rows={4}\n              className=',
        '              rows={4}\n              disabled={preparationInstructionLocked}\n              className=',
        1,
    )
    text = text.replace(
        'className="w-full rounded-2xl border border-[#F4B044]/30 bg-white px-4 py-3 text-sm font-bold text-[#112532] outline-none placeholder:text-[#112532]/35"',
        'className="w-full rounded-2xl border border-[#F4B044]/30 bg-white px-4 py-3 text-sm font-bold text-[#112532] outline-none placeholder:text-[#112532]/35 disabled:bg-[#112532]/5 disabled:text-[#112532]/45"',
        1,
    )

    old_buttons = [
        '''            <button className="mt-3 rounded-full bg-[#112532] px-5 py-3 text-sm font-black text-white shadow-sm">
              Enregistrer l’instruction
            </button>''',
        '''            <button className="mt-3 rounded-full bg-[#E0680E] px-5 py-3 text-sm font-black text-white shadow-sm shadow-[#E0680E]/20">
              Enregistrer l’instruction
            </button>''',
    ]
    for old_button in old_buttons:
        text = text.replace(old_button, '            <ReservationInstructionSubmitButton locked={preparationInstructionLocked} />', 1)

    if "preparationInstructionLocked" in text and "These notes are locked because" not in text:
        text = text.replace(
            "</form>\n        </section>",
            '''</form>
          {preparationInstructionLocked ? (
            <p className="mt-3 text-xs font-bold opacity-60">
              These notes are locked because the related mission is already complete.
            </p>
          ) : null}
        </section>''',
            1,
        )

    backup_and_write(reservation_page, original, text)

banner = app_root / "components/cleaner/CleanerPreparationNoteBanner.tsx"
if banner.exists():
    original = banner.read_text()
    text = original

    text = text.replace(
        'className="rounded-3xl bg-[#112532] p-5 text-white shadow-sm"',
        'className="rounded-3xl bg-[#EFF6F8] p-5 text-[#112532] shadow-sm ring-1 ring-[#80A5B7]/25"',
    )
    text = text.replace(
        'className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45"',
        'className="text-[10px] font-black uppercase tracking-[0.18em] text-[#E0680E]"',
    )
    text = text.replace("Important pour le prochain séjour", "Important notes")
    text = text.replace("À vérifier avant de valider le rapport", "Before completing the checklist")
    text = text.replace(
        'className="mt-3 whitespace-pre-wrap text-base font-black leading-7 text-white/85"',
        'className="mt-3 whitespace-pre-wrap text-base font-black leading-7 text-[#112532]/82"',
    )
    text = text.replace(
        'className="mt-4 rounded-2xl bg-white/10 p-3 text-xs font-bold text-white/65"',
        'className="mt-4 rounded-2xl bg-white/80 p-3 text-xs font-bold text-[#112532]/55 ring-1 ring-[#112532]/6"',
    )

    backup_and_write(banner, original, text)

mission_page = app_root / "app/mission/[token]/page.tsx"
if mission_page.exists():
    original = mission_page.read_text()
    text = original
    text = text.replace("Important pour le prochain séjour", "Important notes")
    text = text.replace("À vérifier avant de valider le rapport", "Before completing the checklist")
    backup_and_write(mission_page, original, text)

owner_mission = app_root / "app/owner/missions/[requestId]/page.tsx"
if owner_mission.exists():
    original = owner_mission.read_text()
    text = original

    text = text.replace(
        '<section className="grid gap-5 lg:grid-cols-[1fr_1fr]">',
        '<section className="grid min-w-0 gap-5 lg:grid-cols-[1fr_1fr]">',
        1,
    )
    text = text.replace(
        '<article className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">\n            <div className="flex flex-wrap items-start justify-between gap-3">\n              <div>\n                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">SMS / notifications</p>',
        '<article className="min-w-0 overflow-hidden rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">\n            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">\n              <div className="min-w-0">\n                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">SMS / notifications</p>',
        1,
    )
    text = text.replace(
        '<div key={message.id} className="rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">',
        '<div key={message.id} className="min-w-0 overflow-hidden rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">',
    )
    text = text.replace(
        '<div className="flex flex-wrap items-start justify-between gap-3">\n                      <div>\n                        <p className="text-sm font-black text-[#112532]">',
        '<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">\n                      <div className="min-w-0">\n                        <p className="break-words text-sm font-black text-[#112532]">',
    )
    text = text.replace(
        '<p className="mt-1 text-xs font-bold text-[#112532]/45">',
        '<p className="mt-1 break-words text-xs font-bold text-[#112532]/45">',
    )
    text = text.replace(
        '<p className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm font-medium leading-6 text-[#112532]/68 ring-1 ring-[#112532]/6">',
        '<p className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-white p-3 text-sm font-medium leading-6 text-[#112532]/68 ring-1 ring-[#112532]/6">',
    )
    text = text.replace(
        '<div className="mt-3 grid gap-2 text-xs font-bold text-[#112532]/45 sm:grid-cols-2">',
        '<div className="mt-3 grid min-w-0 gap-2 text-xs font-bold text-[#112532]/45 sm:grid-cols-2">',
    )
    text = text.replace(
        '<span>ID : {message.provider_message_id || "—"}</span>',
        '<span className="break-all">ID : {message.provider_message_id || "—"}</span>',
    )
    text = text.replace(
        '<span>Erreur : {message.error || "—"}</span>',
        '<span className="break-words">Erreur : {message.error || "—"}</span>',
    )

    backup_and_write(owner_mission, original, text)

briefing = app_root / "app/mission/[token]/reservation/page.tsx"
if briefing.exists():
    original = briefing.read_text()
    text = original

    text = add_import(text, 'import CleanerMissionNav from "@/components/navigation/CleanerMissionNav";')
    text = add_import(text, 'import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";')

    if "cleanerResult" not in text:
        old = '''  const [propertyResult, reservationResult, messagesResult] = await Promise.all([
    request.property_id ? supabase.from("properties").select("*").eq("id", request.property_id).maybeSingle() : Promise.resolve({ data: null }),
    (request.prepares_reservation_id || request.reservation_id) ? supabase.from("reservations").select("*").eq("id", request.prepares_reservation_id || request.reservation_id).maybeSingle() : Promise.resolve({ data: null }),
    (request.prepares_reservation_id || request.reservation_id)
      ? supabase
          .from("reservation_messages")
          .select("*")
          .eq("reservation_id", request.prepares_reservation_id || request.reservation_id)
          .order("sent_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);'''
        new = '''  const [propertyResult, reservationResult, messagesResult, cleanerResult] = await Promise.all([
    request.property_id ? supabase.from("properties").select("*").eq("id", request.property_id).maybeSingle() : Promise.resolve({ data: null }),
    (request.prepares_reservation_id || request.reservation_id) ? supabase.from("reservations").select("*").eq("id", request.prepares_reservation_id || request.reservation_id).maybeSingle() : Promise.resolve({ data: null }),
    (request.prepares_reservation_id || request.reservation_id)
      ? supabase
          .from("reservation_messages")
          .select("*")
          .eq("reservation_id", request.prepares_reservation_id || request.reservation_id)
          .order("sent_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
    request.assigned_cleaner_id ? supabase.from("cleaners").select("public_token").eq("id", request.assigned_cleaner_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);'''
        text = text.replace(old, new, 1)

    if "const cleaner = cleanerResult.data as Row | null;" not in text and "cleanerResult" in text:
        text = text.replace(
            "  const messages = (messagesResult.data ?? []) as Row[];\n",
            "  const messages = (messagesResult.data ?? []) as Row[];\n  const cleaner = cleanerResult.data as Row | null;\n",
            1,
        )

    text = text.replace(
        '<main className="min-h-screen bg-[#F6F3EF] text-[#112532]">',
        '<main className="min-h-screen bg-[#F6F3EF] pb-28 text-[#112532]">',
        1,
    )

    if "<CleanerMissionNav" not in text:
        text = text.replace(
            '<div className="relative mx-auto max-w-4xl px-4 pb-8 pt-5">\n          <div className="flex items-center justify-between gap-3">',
            '<div className="relative mx-auto max-w-4xl px-4 pb-8 pt-5">\n          <div className="mb-4 rounded-2xl bg-white/8 p-2 backdrop-blur-md ring-1 ring-white/12">\n            <CleanerMissionNav missionToken={token} active="missions" />\n          </div>\n          <div className="flex items-center justify-between gap-3">',
            1,
        )

    text = text.replace("Important pour le séjour préparé", "Important notes")
    text = text.replace("À faire / vérifier en priorité", "Before the next stay")
    text = text.replace(
        'className="rounded-[2rem] bg-[#112532] p-5 text-white shadow-sm ring-1 ring-[#112532]/20"',
        'className="rounded-[2rem] bg-[#EFF6F8] p-5 text-[#112532] shadow-sm ring-1 ring-[#80A5B7]/25"',
    )
    text = text.replace(
        'className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45"',
        'className="text-[10px] font-black uppercase tracking-[0.18em] text-[#E0680E]"',
    )
    text = text.replace(
        'className="mt-4 whitespace-pre-wrap text-base font-bold leading-7 text-white/82"',
        'className="mt-4 whitespace-pre-wrap text-base font-bold leading-7 text-[#112532]/75"',
    )

    if "<CleanerBottomNav" not in text:
        text = text.replace(
            "    </main>\n  );",
            '''      <CleanerBottomNav
        cleanerToken={cleaner?.public_token}
        missionToken={token}
        active="missions"
        locale="fr"
      />
    </main>
  );''',
            1,
        )

    backup_and_write(briefing, original, text)

if changed:
    print("Live cleaner polish patched:")
    for item in changed:
        print(" -", item)
else:
    print("No files changed.")
PY

echo "Installed Pilotys live cleaner polish v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd $APP_ROOT && npm run build"
