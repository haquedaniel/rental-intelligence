import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  compactDateLabel,
  manualReassignmentHref,
  parisDateKey,
  reportHref,
  requestStatusClass,
  requestStatusLabel,
  timeLabel,
  type Row,
} from "@/components/owner-planning/timelineUtils";

export const dynamic = "force-dynamic";

function fullName(row?: Row | null): string {
  if (!row) return "Non affecté";
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || "Intervenante";
}

function cleanerMissionHref(request: Row): string | null {
  if (!request.public_token) return null;
  return `/mission/${request.public_token}/ready-day`;
}

function messageStatusClass(status?: string): string {
  if (status === "failed") return "bg-red-100 text-red-800";
  if (status === "sent") return "bg-emerald-100 text-emerald-800";
  if (status === "pending") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

export default async function RequestIssuePage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  await requireAdmin();

  const { requestId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: request, error: requestError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !request) {
    throw new Error("Mission introuvable.");
  }

  const [{ data: property }, { data: cleaner }, { data: reservation }, { data: messages }, { data: options }, { data: reports }] =
    await Promise.all([
      request.property_id
        ? supabase.from("properties").select("*").eq("id", request.property_id).maybeSingle()
        : Promise.resolve({ data: null }),
      request.assigned_cleaner_id
        ? supabase.from("cleaners").select("*").eq("id", request.assigned_cleaner_id).maybeSingle()
        : Promise.resolve({ data: null }),
      request.reservation_id
        ? supabase.from("reservations").select("*").eq("id", request.reservation_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("outbound_messages")
        .select("*")
        .eq("cleaning_request_id", request.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("cleaning_request_ready_day_options")
        .select("*")
        .eq("cleaning_request_id", request.id)
        .order("ready_by_at", { ascending: true }),
      supabase
        .from("cleaning_reports")
        .select("*")
        .eq("cleaning_request_id", request.id)
        .order("created_at", { ascending: false }),
    ]);

  const statusLabel = requestStatusLabel(request);
  const manualHref = manualReassignmentHref(request);
  const report = reportHref(request);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href="/admin/planning-v2" className="text-sm font-bold text-slate-600">
          ← Calendrier central
        </Link>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Dossier opérationnel
              </p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">
                {property?.name ?? "Logement"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {request.scheduled_start_at
                  ? `${compactDateLabel(parisDateKey(request.scheduled_start_at))} · ${timeLabel(request.scheduled_start_at)}`
                  : "date à confirmer"}
              </p>
            </div>

            <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${requestStatusClass(request)}`}>
              {statusLabel}
            </span>
          </div>

          {request.refusal_reason && (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-red-950 ring-1 ring-red-100">
              <p className="text-sm font-black">Raison du refus</p>
              <p className="mt-1 text-sm">{request.refusal_reason}</p>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Intervenante</p>
              <p className="mt-1 font-black text-slate-950">{fullName(cleaner)}</p>
              <p className="text-sm text-slate-500">{cleaner?.phone || "Téléphone non renseigné"}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Planning</p>
              <p className="mt-1 font-black text-slate-950">{request.schedule_status || "—"}</p>
              <p className="text-sm text-slate-500">status mission : {request.status}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Coût</p>
              <p className="mt-1 font-black text-slate-950">{request.total_cost_eur ?? request.cleaning_cost_eur ?? "—"} €</p>
              <p className="text-sm text-slate-500">estimation mission</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={manualHref} className="rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white">
              Réattribuer / créer mission
            </Link>

            {cleanerMissionHref(request) && (
              <Link href={cleanerMissionHref(request)!} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                Ouvrir côté cleaner
              </Link>
            )}

            {report && (
              <Link href={report} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200">
                Rapport
              </Link>
            )}
          </div>
        </section>

        {reservation && (
          <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-black text-slate-950">Réservation liée</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-400">Client</p>
                <p className="mt-1 font-bold">{reservation.guest_name || reservation.source_booking_id || "—"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-400">Arrivée</p>
                <p className="mt-1 font-bold">{reservation.checkin_at ? compactDateLabel(parisDateKey(reservation.checkin_at)) : "—"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-400">Départ</p>
                <p className="mt-1 font-bold">{reservation.checkout_at ? compactDateLabel(parisDateKey(reservation.checkout_at)) : "—"}</p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">SMS et historique</h2>
          <div className="mt-3 space-y-2">
            {(messages ?? []).length === 0 && (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Aucun SMS lié à cette mission.
              </p>
            )}

            {(messages ?? []).map((message: Row) => (
              <div key={message.id} className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase text-slate-400">{message.message_type || "sms"}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${messageStatusClass(message.status)}`}>
                    {message.status}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{message.body}</p>
                <p className="mt-2 text-xs text-slate-400">{message.recipient_phone}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">Options et rapports</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Jours proposés</p>
              <p className="mt-1 font-black text-slate-950">{(options ?? []).length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Rapports</p>
              <p className="mt-1 font-black text-slate-950">{(reports ?? []).length}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
