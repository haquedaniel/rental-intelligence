import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { acceptIntervention, refuseIntervention } from "./actions";

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

function shortFmt(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value)).replace(":", "h");
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

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function ceilToNextHour(date: Date): Date {
  const copy = new Date(date);
  if (copy.getUTCMinutes() || copy.getUTCSeconds() || copy.getUTCMilliseconds()) {
    copy.setUTCHours(copy.getUTCHours() + 1);
  }
  copy.setUTCMinutes(0, 0, 0);
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

  if (addHours(windowStart, durationHours) <= deadline) {
    starts.push(windowStart);
  }

  let cursor = ceilToNextHour(windowStart);

  while (addHours(cursor, durationHours) <= deadline && starts.length < 240) {
    if (!starts.some((date) => date.getTime() === cursor.getTime())) {
      starts.push(new Date(cursor));
    }
    cursor = addHours(cursor, 1);
  }

  return starts
    .map((start) => {
      const end = addHours(start, durationHours);
      const occupied = reservations.some((reservation) => overlaps(start, end, reservation));

      return {
        start,
        end,
        occupied,
      };
    })
    .filter((slot) => allowOccupied || !slot.occupied);
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
  const accepted = request.status === "accepted";
  const refused = request.status === "refused";
  const done = request.status === "report_submitted" || request.status === "problem_reported";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
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
              <p className="text-xs font-black uppercase text-white/40">Fenêtre possible</p>
              <p className="mt-1 text-sm font-black">
                {fmt(windowStart)} → {fmt(windowEnd)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase text-white/40">Estimation</p>
              <p className="mt-1 font-black">
                {request.estimated_hours ?? "—"} h · {request.total_cost_eur ?? 0} €
              </p>
            </div>
          </div>
        </section>

        {request.allow_occupied_intervention ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950 ring-1 ring-amber-100">
            Le propriétaire autorise un créneau même si le logement est occupé. Les créneaux concernés sont signalés.
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-950 ring-1 ring-emerald-100">
            Les créneaux pendant une occupation voyageur sont exclus automatiquement.
          </div>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">Consignes</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
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
                  Aucun créneau disponible dans cette fenêtre. Demandez au propriétaire de modifier les dates ou d’autoriser une intervention pendant occupation.
                </div>
              ) : (
                <div className="mt-4 grid gap-2">
                  {slots.slice(0, 80).map((slot, index) => (
                    <label
                      key={slot.start.toISOString()}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 text-sm font-bold ${
                        slot.occupied
                          ? "border-amber-200 bg-amber-50 text-amber-950"
                          : "border-slate-200 bg-slate-50 text-slate-900"
                      }`}
                    >
                      <span>
                        <input
                          type="radio"
                          name="selected_start_at"
                          value={slot.start.toISOString()}
                          required
                          defaultChecked={index === 0}
                          className="mr-2"
                        />
                        {shortFmt(slot.start.toISOString())} → {shortFmt(slot.end.toISOString())}
                      </span>

                      {slot.occupied && (
                        <span className="rounded-full bg-amber-200 px-2 py-1 text-[10px] font-black text-amber-950">
                          Logement occupé
                        </span>
                      )}
                    </label>
                  ))}
                </div>
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

        {accepted && (
          <section className="space-y-3">
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-950 ring-1 ring-emerald-100">
              Créneau confirmé : {fmt(request.scheduled_start_at)} → {fmt(request.scheduled_end_at)}
            </div>

            <Link
              href={`/mission/${token}/intervention/report`}
              className="block rounded-2xl bg-slate-950 px-5 py-4 text-center text-lg font-black text-white"
            >
              Envoyer le rapport d’intervention
            </Link>
          </section>
        )}

        {refused && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-900 ring-1 ring-red-100">
            Intervention refusée. Le propriétaire a été prévenu. Aucun remplaçant automatique ne sera contacté.
          </div>
        )}

        {done && (
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 ring-1 ring-emerald-100">
            Rapport transmis. Merci.
          </div>
        )}
      </div>
    </main>
  );
}
