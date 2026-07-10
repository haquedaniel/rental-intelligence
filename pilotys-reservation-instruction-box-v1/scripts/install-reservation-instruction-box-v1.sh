#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.pilotys-backups/reservation-instruction-box-v1-$STAMP"

if [ ! -d "$ROOT/apps/cleaner-web/app" ]; then
  echo "Run this from the repository root. Expected apps/cleaner-web/app to exist."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

python - <<'PY'
from pathlib import Path
import re

path = Path("apps/cleaner-web/app/owner/reservations/[reservationId]/page.tsx")
if not path.exists():
    raise SystemExit(f"Missing {path}")

original = path.read_text()
text = original

if 'import { revalidatePath } from "next/cache";' not in text:
    text = text.replace(
        'import Link from "next/link";\n',
        'import Link from "next/link";\nimport { revalidatePath } from "next/cache";\n',
        1,
    )

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
    text = text.replace("export default async function", action + "export default async function", 1)

box = '''
        <section className="rounded-[2rem] bg-[#FFF5DD] p-5 text-[#8A4D00] shadow-sm ring-1 ring-[#F4B044]/25">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-55">
            Instruction préparation
          </p>
          <h2 className="mt-2 text-2xl font-black">À montrer à l’intervenante</h2>
          <p className="mt-2 text-sm font-bold leading-6 opacity-75">
            Cette note appartient à ce séjour. La mission qui prépare ce séjour l’affichera en priorité sur la page mission de l’intervenante.
          </p>

          <form action={saveReservationPreparationNote} className="mt-4">
            <input type="hidden" name="reservation_id" value={reservation.id} />
            <textarea
              name="cleaner_preparation_note"
              defaultValue={reservation.cleaner_preparation_note || ""}
              rows={4}
              className="w-full rounded-2xl border border-[#F4B044]/30 bg-white px-4 py-3 text-sm font-bold text-[#112532] outline-none placeholder:text-[#112532]/35"
              placeholder="Ex. Installer le lit bébé dans la chambre, prévoir draps canapé-lit, attention animal, horaire particulier..."
            />
            <button className="mt-3 rounded-full bg-[#112532] px-5 py-3 text-sm font-black text-white shadow-sm">
              Enregistrer l’instruction
            </button>
          </form>
        </section>

'''

if "Instruction préparation" not in text:
    inserted = False

    prep_match = re.search(
        r'(\s*<section[^>]+>\s*[\s\S]*?Préparation(?: de l’arrivée| sous contrôle| de l&apos;arrivée)[\s\S]*?</section>\s*)',
        text,
        flags=re.I,
    )
    if prep_match:
        text = text[:prep_match.end()] + box + text[prep_match.end():]
        inserted = True

    if not inserted:
        finance_match = re.search(
            r'(\s*<section[^>]+>\s*[\s\S]{0,800}?CA BRUT)',
            text,
            flags=re.I,
        )
        if finance_match:
            text = text[:finance_match.start()] + box + text[finance_match.start():]
            inserted = True

    if not inserted:
        wrapper_match = re.search(r'(<div className="mx-auto[^"]*space-y-[^"]*"[^>]*>\s*)', text)
        if wrapper_match:
            text = text[:wrapper_match.end()] + box + text[wrapper_match.end():]
            inserted = True

    if not inserted:
        raise SystemExit("Could not find a safe insertion point for the reservation instruction box.")

if text != original:
    backup = Path(".pilotys-backups/reservation-instruction-box-v1-inline") / path
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        backup.write_text(original)
    path.write_text(text)
    print(f"Patched {path}")
else:
    print("Reservation page unchanged; instruction box may already be present.")
PY

echo "Installed reservation instruction box v1"
echo "Backup: $BACKUP_DIR"
echo ""
echo "Build with:"
echo "  cd apps/cleaner-web && npm run build"
