#!/usr/bin/env python3
from pathlib import Path
import re


def patch_file(path: Path, patcher):
    if not path.exists():
        print(f"Missing {path}; skipped.")
        return
    original = path.read_text()
    text = patcher(original)
    if text != original:
        backup = Path(".pilotys-backups/reservation-preparation-notes-v1-inline") / path
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_text(original)
        path.write_text(text)
        print(f"Patched {path}")
    else:
        print(f"Unchanged {path}")


def patch_owner_reservation(text: str) -> str:
    if 'import { revalidatePath } from "next/cache";' not in text:
        text = text.replace('import Link from "next/link";\n', 'import Link from "next/link";\nimport { revalidatePath } from "next/cache";\n', 1)

    if "saveReservationPreparationNote" not in text:
        action = '''
async function saveReservationPreparationNote(formData: FormData) {
  "use server";

  await requireAdmin();

  const reservationId = String(formData.get("reservation_id") ?? "");
  const note = String(formData.get("cleaner_preparation_note") ?? "").trim();

  if (!reservationId) {
    throw new Error("Réservation manquante.");
  }

  const supabase = getSupabaseAdmin();

  await supabase
    .from("reservations")
    .update({
      cleaner_preparation_note: note || null,
      cleaner_preparation_note_updated_at: new Date().toISOString(),
      cleaner_preparation_note_updated_by: "owner_page",
    })
    .eq("id", reservationId);

  revalidatePath(`/owner/reservations/${reservationId}`);
  revalidatePath("/owner/cockpit");
}

'''
        text = text.replace("export default async function OwnerReservationPage", action + "export default async function OwnerReservationPage", 1)

    text = text.replace(
        '.from("cleaning_requests")\n      .select("*")\n      .eq("reservation_id", reservation.id)\n      .order("created_at", { ascending: true }),',
        '.from("cleaning_requests")\n      .select("*")\n      .or(`reservation_id.eq.${reservation.id},prepares_reservation_id.eq.${reservation.id}`)\n      .order("created_at", { ascending: true }),'
    )

    if "Instruction préparation" not in text:
        marker = '        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">'
        block = '''        <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Instruction préparation</p>
            <h2 className="mt-1 text-lg font-black">À montrer à l’intervenante</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Cette note appartient à ce séjour. La mission qui prépare ce séjour l’affichera en priorité.
            </p>
          </div>

          <form action={saveReservationPreparationNote} className="mt-4">
            <input type="hidden" name="reservation_id" value={reservation.id} />
            <textarea
              name="cleaner_preparation_note"
              defaultValue={reservation.cleaner_preparation_note || ""}
              rows={4}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-slate-400"
              placeholder="Ex. Installer le lit bébé dans la chambre, prévoir draps canapé-lit, attention animal..."
            />
            <button className="mt-3 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">
              Enregistrer l’instruction
            </button>
          </form>
        </section>

'''
        text = text.replace(marker, block + marker, 1)

    return text


def patch_cleaner_mission(text: str) -> str:
    text = re.sub(
        r'\s*\{\(mission\.cleaner_priority_note \|\| mission\.owner_note\) \? \([\s\S]*?mission\.cleaner_priority_note \|\| mission\.owner_note[\s\S]*?\) : null\}\s*',
        "\n",
        text,
        flags=re.S,
    )

    if "prepares_reservation_id" not in text:
        text = text.replace(
            "      property_id,\n      status,",
            "      property_id,\n      reservation_id,\n      prepares_reservation_id,\n      status,",
            1,
        )

    if "preparedReservation" not in text:
        marker = '''  const coverPhoto = mission.property_id
    ? await getCoverPhotoUrl(supabaseAdmin, mission.property_id)
    : null;

'''
        inserted = marker + '''  const { data: preparedReservation } = mission.prepares_reservation_id
    ? await supabaseAdmin
        .from("reservations")
        .select("id,guest_name,checkin_at,number_of_guests,num_adult,num_child,pets_count,cleaner_preparation_note")
        .eq("id", mission.prepares_reservation_id)
        .maybeSingle()
    : { data: null };

  const preparationNote = preparedReservation?.cleaner_preparation_note || null;

'''
        text = text.replace(marker, inserted, 1)

    if "Important pour le prochain séjour" not in text:
        note_block = '''            {preparationNote ? (
              <section className="mb-5 rounded-2xl bg-[#112532] p-4 text-white shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                  Important pour le prochain séjour
                </p>
                <p className="mt-2 whitespace-pre-wrap text-base font-black leading-7 text-white/85">
                  {preparationNote}
                </p>
                {preparedReservation ? (
                  <p className="mt-3 text-xs font-bold text-white/55">
                    {preparedReservation.guest_name || "Prochain séjour"} · arrivée {formatDate(preparedReservation.checkin_at)}
                  </p>
                ) : null}
              </section>
            ) : null}

'''
        text = text.replace('          <div className="p-6">\n', '          <div className="p-6">\n' + note_block, 1)

    if "Briefing séjour" not in text:
        link = '''            <Link
              href={`/mission/${token}/reservation`}
              className="mb-5 block rounded-2xl bg-[#EFF6F8] px-4 py-3 text-center text-sm font-black text-[#1E5365] ring-1 ring-[#80A5B7]/25"
            >
              Briefing séjour →
            </Link>

'''
        text = text.replace('          <div className="p-6">\n', '          <div className="p-6">\n' + link, 1)

    return text


def patch_cleaner_briefing(text: str) -> str:
    text = text.replace(
        'request.reservation_id ? supabase.from("reservations").select("*").eq("id", request.reservation_id).maybeSingle() : Promise.resolve({ data: null }),',
        '(request.prepares_reservation_id || request.reservation_id) ? supabase.from("reservations").select("*").eq("id", request.prepares_reservation_id || request.reservation_id).maybeSingle() : Promise.resolve({ data: null }),'
    )
    text = text.replace(
        'request.reservation_id\n      ? supabase\n          .from("reservation_messages")\n          .select("*")\n          .eq("reservation_id", request.reservation_id)',
        '(request.prepares_reservation_id || request.reservation_id)\n      ? supabase\n          .from("reservation_messages")\n          .select("*")\n          .eq("reservation_id", request.prepares_reservation_id || request.reservation_id)'
    )

    text = re.sub(
        r'const priorityNote = sanitizeNote\([\s\S]*?\);\n',
        '  const priorityNote = sanitizeNote(textValue(reservation, ["cleaner_preparation_note"], ""));\n',
        text,
        count=1,
    )
    text = text.replace("Note propriétaire — important", "Important pour le séjour préparé")
    return text


def patch_owner_mission(text: str) -> str:
    text = re.sub(
        r'\nasync function saveOwnerMissionNote\(formData: FormData\) \{[\s\S]*?\n\}\n\nfunction missionLink',
        "\nfunction missionLink",
        text,
        count=1,
    )
    text = re.sub(
        r'\s*<form action=\{saveOwnerMissionNote\} className="mt-5 rounded-3xl bg-\[#112532\][\s\S]*?</form>\s*',
        "\n",
        text,
        count=1,
    )

    if "preparedReservationResult" not in text:
        text = text.replace(
            '''    siblingRequestsResult,
  ] = await Promise.all([''',
            '''    siblingRequestsResult,
    preparedReservationResult,
  ] = await Promise.all([''',
            1,
        )
        text = text.replace(
            '''    request.reservation_id
      ? supabase.from("cleaning_requests").select("*").eq("reservation_id", request.reservation_id).order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);''',
            '''    request.reservation_id
      ? supabase.from("cleaning_requests").select("*").eq("reservation_id", request.reservation_id).order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    request.prepares_reservation_id
      ? supabase.from("reservations").select("*").eq("id", request.prepares_reservation_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);''',
            1,
        )
        text = text.replace(
            '''  const siblingRequests = ((siblingRequestsResult.data ?? []) as Row[]).filter((row) => row.id !== request.id);''',
            '''  const siblingRequests = ((siblingRequestsResult.data ?? []) as Row[]).filter((row) => row.id !== request.id);
  const preparedReservation = preparedReservationResult.data as Row | null;
  const preparationNote = preparedReservation?.cleaner_preparation_note || null;''',
            1,
        )

    if "Séjour préparé" not in text:
        card = '''            {preparedReservation ? (
              <div className="mt-5 rounded-3xl bg-[#EFF6F8] p-5 text-[#1E5365] ring-1 ring-[#80A5B7]/25">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-55">Séjour préparé</p>
                <h3 className="mt-2 text-xl font-black">{preparedReservation.guest_name || "Prochain séjour"}</h3>
                <p className="mt-1 text-sm font-bold opacity-70">Arrivée : {dateTime(preparedReservation.checkin_at)}</p>
                {preparationNote ? (
                  <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm font-black leading-6 text-[#112532] ring-1 ring-[#112532]/8">
                    {preparationNote}
                  </p>
                ) : (
                  <Link
                    href={`/owner/reservations/${preparedReservation.id}`}
                    className="mt-4 inline-flex rounded-full bg-[#112532] px-4 py-3 text-xs font-black text-white"
                  >
                    Ajouter une instruction
                  </Link>
                )}
              </div>
            ) : null}

'''
        text = text.replace('            <div className="mt-5 grid gap-3">\n', card + '            <div className="mt-5 grid gap-3">\n', 1)

    return text


patch_file(Path("apps/cleaner-web/app/owner/reservations/[reservationId]/page.tsx"), patch_owner_reservation)
patch_file(Path("apps/cleaner-web/app/mission/[token]/page.tsx"), patch_cleaner_mission)
patch_file(Path("apps/cleaner-web/app/mission/[token]/reservation/page.tsx"), patch_cleaner_briefing)
patch_file(Path("apps/cleaner-web/app/owner/missions/[requestId]/page.tsx"), patch_owner_mission)
