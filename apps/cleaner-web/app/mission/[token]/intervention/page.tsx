import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import CleanerMissionNav from "@/components/navigation/CleanerMissionNav";
import { acceptIntervention, changeInterventionSlot, refuseIntervention } from "./actions";
import { InterventionSlotPicker } from "./InterventionSlotPicker";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function fmt(value?: string | null) {
  if (!value) return "À convenir";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function slotFmt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  })
    .format(new Date(value))
    .replace(":", "h");
}

function parisDateKeyForSlot(date: Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function slotDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(date);
}

function slotTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  })
    .format(date)
    .replace(":", "h");
}

function nameFor(row: any) {
  return row?.name || row?.title || row?.display_name || row?.internal_name || "Logement";
}

function isReservationCancelled(reservation: Row): boolean {
  if (reservation.cancelled_at || reservation.canceled_at) return true;

  const statusText = [
    reservation.status,
    reservation.booking_status,
    reservation.reservation_status,
    reservation.source_status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return statusText.includes("cancel") || statusText.includes("annul");
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return addMinutes(date, hours * 60);
}

function ceilToNextHalfHour(date: Date): Date {
  const copy = new Date(date);
  const minutes = copy.getUTCMinutes();

  if (minutes === 0 || minutes === 30) {
    copy.setUTCSeconds(0, 0);
    return copy;
  }

  if (minutes < 30) {
    copy.setUTCMinutes(30, 0, 0);
  } else {
    copy.setUTCHours(copy.getUTCHours() + 1, 0, 0, 0);
  }

  return copy;
}

function overlaps(start: Date, end: Date, reservation: Row): boolean {
  if (!reservation.checkin_at || !reservation.checkout_at) return false;

  const checkin = new Date(reservation.checkin_at);
  const checkout = new Date(reservation.checkout_at);

  return start < checkout && end > checkin;
}

function buildSlots({
  request,
  reservations,
}: {
  request: Row;
  reservations: Row[];
}) {
  const windowStart = new Date(
    request.work_window_start_at ||
      request.scheduled_start_at ||
      request.created_at,
  );

  const deadline = new Date(
    request.work_window_end_at ||
      request.completion_deadline_at ||
      request.scheduled_end_at,
  );

  const durationHours = Math.max(Number(request.estimated_hours ?? 1), 0.25);
  const allowOccupied = request.allow_occupied_intervention === true;

  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(deadline.getTime())) {
    return [];
  }

  const starts: Date[] = [];
  let cursor = ceilToNextHalfHour(windowStart);

  while (addHours(cursor, durationHours) <= deadline && starts.length < 160) {
    starts.push(new Date(cursor));
    cursor = addMinutes(cursor, 60);
  }

  return starts
    .map((start) => {
      const end = addHours(start, durationHours);
      const occupied = reservations.some((reservation) => overlaps(start, end, reservation));

      return { start, end, occupied };
    })
    .filter((slot) => allowOccupied || !slot.occupied);
}

function money(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0 €";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(number);
}

export default async function InterventionMissionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: request, error } = await supabase
    .from("cleaning_requests")
    .select("*,properties(*),cleaners(*)")
    .eq("public_token", token)
    .eq("mission_type", "intervention")
    .maybeSingle();

  if (error || !request) notFound();

  const windowStart = request.work_window_start_at || request.scheduled_start_at || request.created_at;
  const windowEnd = request.work_window_end_at || request.completion_deadline_at || request.scheduled_end_at;

  const { data: rawReservations } = await supabase
    .from("reservations")
    .select("*")
    .eq("property_id", request.property_id)
    .lt("checkin_at", windowEnd)
    .gt("checkout_at", windowStart)
    .order("checkin_at", { ascending: true });

  const reservations = ((rawReservations ?? []) as Row[]).filter(
    (reservation) => !isReservationCancelled(reservation),
  );

  const slots = buildSlots({ request, reservations });

  const slotOptions = slots.map((slot) => ({
    value: slot.start.toISOString(),
    dateKey: parisDateKeyForSlot(slot.start),
    dateLabel: slotDateLabel(slot.start),
    timeLabel: `${slotTimeLabel(slot.start)} → ${slotTimeLabel(slot.end)}`,
    occupied: slot.occupied,
  }));

  let referencePhotoUrl: string | null = null;
  if (request.reference_photo_path) {
    const { data } = await supabase.storage
      .from(request.reference_photo_bucket || "intervention-reference-photos")
      .createSignedUrl(request.reference_photo_path, 60 * 60);

    referencePhotoUrl = data?.signedUrl ?? null;
  }

  const accepted = request.status === "accepted";
  const refused = request.status === "refused";
  const done = request.status === "report_submitted" || request.status === "problem_reported";
  const cleanerToken = request.cleaners?.public_token ?? null;

  const scheduledStart = request.scheduled_start_at ? new Date(request.scheduled_start_at) : null;
  const reportAvailable =
    accepted &&
    (!scheduledStart || Date.now() >= scheduledStart.getTime() - 2 * 60 * 60 * 1000);

  const hourlyRate = Number(request.hourly_rate_eur_snapshot ?? 0);
  const actualHours = Number(request.actual_hours ?? request.estimated_hours ?? 0);
  const labourTotal = Math.round(actualHours * hourlyRate * 100) / 100;
  const materialTotal = Number(request.material_expenses_total_eur ?? 0);
  const totalCost = Number(request.total_cost_eur ?? labourTotal + materialTotal);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">

      <Link
        href={`/mission/${token}/reservation`}
        className="mb-4 inline-flex rounded-full bg-[#112532] px-4 py-3 text-sm font-black text-white shadow-sm"
      >
        Briefing séjour →
      </Link>

      <div className="mx-auto max-w-2xl space-y-5 pb-24">
        <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">
            Mission ponctuelle
          </p>
          <h1 className="mt-3 text-3xl font-black">{request.title}</h1>
          <p className="mt-3 text-sm font-bold text-white/70">
            {nameFor(request.properties)}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase text-white/40">
                {done ? "Créneau réalisé" : accepted ? "Créneau confirmé" : "Fenêtre possible"}
              </p>
              <p className="mt-1 text-sm font-black">
                {accepted || done
                  ? `${fmt(request.scheduled_start_at)} → ${fmt(request.scheduled_end_at)}`
                  : `${fmt(windowStart)} → ${fmt(windowEnd)}`}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase text-white/40">
                {done ? "Coût final" : "Estimation"}
              </p>
              <p className="mt-1 font-black">
                {done
                  ? money(totalCost)
                  : `${request.estimated_hours ?? "—"} h · ${money(request.total_cost_eur)}`}
              </p>
            </div>
          </div>
        </section>

        {done && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-black text-slate-950">Détail final</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
              <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                <span>Main d’œuvre</span>
                <span>{actualHours} h × {money(hourlyRate)} = {money(labourTotal)}</span>
              </div>
              <div className="flex justify-between rounded-2xl bg-slate-50 p-3">
                <span>Frais matériel</span>
                <span>{money(materialTotal)}</span>
              </div>
              <div className="flex justify-between rounded-2xl bg-emerald-50 p-3 text-emerald-950">
                <span>Total</span>
                <span>{money(totalCost)}</span>
              </div>
            </div>
          </section>
        )}

        {!done && request.allow_occupied_intervention ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950 ring-1 ring-amber-100">
            Le propriétaire autorise un créneau même si le logement est occupé. Les créneaux concernés sont signalés.
          </div>
        ) : !done ? (
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-950 ring-1 ring-emerald-100">
            Les créneaux pendant une occupation voyageur sont exclus automatiquement.
          </div>
        ) : null}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">Consignes</h2>

          {referencePhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={referencePhotoUrl}
              alt=""
              className="mt-4 max-h-80 w-full rounded-2xl object-cover ring-1 ring-slate-200"
            />
          )}

          <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
            {request.mission_description || "Aucune consigne détaillée."}
          </p>
        </section>

        {!accepted && !refused && !done && (
          <section className="grid gap-3">
            <form action={acceptIntervention} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <input type="hidden" name="token" value={token} />

              <h2 className="text-lg font-black text-slate-950">Choisir un créneau</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Durée estimée : {request.estimated_hours ?? 1} h.
              </p>

              {slots.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-900 ring-1 ring-red-100">
                  Aucun créneau disponible. Demandez au propriétaire de modifier les dates ou d’autoriser une intervention pendant occupation.
                </div>
              ) : (
                <InterventionSlotPicker slots={slotOptions} />
              )}

              <button
                disabled={slots.length === 0}
                className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-lg font-black text-white disabled:opacity-50"
              >
                Accepter ce créneau
              </button>
            </form>

            <form action={refuseIntervention} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <input type="hidden" name="token" value={token} />
              <label className="block">
                <span className="text-sm font-bold text-slate-800">Raison du refus</span>
                <textarea name="reason" rows={3} required className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" />
              </label>
              <button className="mt-3 w-full rounded-2xl bg-white px-5 py-3 font-black text-red-700 ring-1 ring-red-200">
                Refuser
              </button>
            </form>
          </section>
        )}

        {accepted && !done && (
          <section className="space-y-3">
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-950 ring-1 ring-emerald-100">
              Créneau confirmé : {fmt(request.scheduled_start_at)} → {fmt(request.scheduled_end_at)}
            </div>

            {slots.length > 0 && (
              <details className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <summary className="cursor-pointer text-sm font-black text-slate-800">
                  Modifier le créneau
                </summary>

                <form action={changeInterventionSlot} className="mt-4">
                  <input type="hidden" name="token" value={token} />

                  <p className="text-sm font-semibold text-slate-500">
                    Choisissez une nouvelle date puis une heure. Le propriétaire sera prévenu.
                  </p>

                  <InterventionSlotPicker
                    slots={slotOptions}
                    defaultValue={request.scheduled_start_at}
                  />

                  <button className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white">
                    Enregistrer le nouveau créneau
                  </button>
                </form>
              </details>
            )}

            {reportAvailable ? (
              <Link
                href={`/mission/${token}/intervention/report`}
                className="block rounded-2xl bg-slate-950 px-5 py-4 text-center text-lg font-black text-white"
              >
                Envoyer le rapport d’intervention
              </Link>
            ) : (
              <>
                <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-600">
                  Le rapport est surtout prévu le jour de l’intervention, mais vous pouvez l’envoyer plus tôt si l’intervention est déjà terminée.
                </div>

                <Link
                  href={`/mission/${token}/intervention/report`}
                  className="block rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-slate-700 ring-1 ring-slate-200"
                >
                  Envoyer le rapport maintenant
                </Link>
              </>
            )}
          </section>
        )}

        {refused && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-900 ring-1 ring-red-100">
            Intervention refusée. Le propriétaire a été prévenu. Aucun remplaçant automatique ne sera contacté.
          </div>
        )}

        {done && (
          <section className="space-y-3">
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 ring-1 ring-emerald-100">
              Rapport transmis. Merci.
            </div>

            {cleanerToken && (
              <Link
                href={`/cleaner/${cleanerToken}`}
                className="block rounded-2xl bg-slate-950 px-5 py-4 text-center text-lg font-black text-white"
              >
                Retour aux missions
              </Link>
            )}
          </section>
        )}
      </div>
          <CleanerMissionNav missionToken={token} active="missions" />
    </main>
  );
}
