import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Row = Record<string, any>;

function formatDate(value?: string | null) {
  if (!value) return "date à confirmer";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function missionReferenceDate(request: Row): string | null {
  return (
    request.ready_by_at ||
    request.work_window_start_at ||
    request.scheduled_start_at ||
    request.scheduled_end_at ||
    request.created_at ||
    null
  );
}

async function getReservationById(supabase: ReturnType<typeof getSupabaseAdmin>, id?: string | null) {
  if (!id) return null;

  const { data } = await supabase
    .from("reservations")
    .select("id,guest_name,checkin_at,checkout_at,number_of_guests,num_adult,num_child,pets_count,cleaner_preparation_note")
    .eq("id", id)
    .maybeSingle();

  return data as Row | null;
}

async function inferPreparedReservation(supabase: ReturnType<typeof getSupabaseAdmin>, request: Row) {
  if (!request.property_id) return null;

  const referenceDate = missionReferenceDate(request);
  if (!referenceDate) return null;

  const { data } = await supabase
    .from("reservations")
    .select("id,guest_name,checkin_at,checkout_at,number_of_guests,num_adult,num_child,pets_count,cleaner_preparation_note")
    .eq("property_id", request.property_id)
    .not("status", "in", "(cancelled,canceled)")
    .gte("checkin_at", referenceDate)
    .order("checkin_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as Row | null;
}

export async function CleanerPreparationNoteBanner({ missionToken }: { missionToken: string }) {
  const supabase = getSupabaseAdmin();

  const { data: request } = await supabase
    .from("cleaning_requests")
    .select("id,property_id,reservation_id,prepares_reservation_id,ready_by_at,work_window_start_at,scheduled_start_at,scheduled_end_at,created_at")
    .eq("public_token", missionToken)
    .maybeSingle();

  if (!request) return null;

  const explicitPreparedReservation = await getReservationById(supabase, request.prepares_reservation_id);
  const sourceReservation = !explicitPreparedReservation
    ? await getReservationById(supabase, request.reservation_id)
    : null;
  const inferredPreparedReservation =
    !explicitPreparedReservation && !sourceReservation?.cleaner_preparation_note
      ? await inferPreparedReservation(supabase, request)
      : null;

  const preparedReservation =
    explicitPreparedReservation ||
    (sourceReservation?.cleaner_preparation_note ? sourceReservation : null) ||
    inferredPreparedReservation ||
    null;

  const note = preparedReservation?.cleaner_preparation_note;
  if (!note) return null;

  return (
    <section className="rounded-3xl bg-[#112532] p-5 text-white shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
        Important pour le prochain séjour
      </p>
      <h2 className="mt-2 text-xl font-black">À vérifier avant de valider le rapport</h2>
      <p className="mt-3 whitespace-pre-wrap text-base font-black leading-7 text-white/85">
        {note}
      </p>
      <p className="mt-4 rounded-2xl bg-white/10 p-3 text-xs font-bold text-white/65">
        {preparedReservation?.guest_name || "Prochain séjour"} · arrivée {formatDate(preparedReservation?.checkin_at)}
      </p>
    </section>
  );
}
