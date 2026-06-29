import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { acceptIntervention, refuseIntervention } from "./actions";

export const dynamic = "force-dynamic";

function fmt(value?: string | null) {
  if (!value) return "À convenir";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function nameFor(row: any) {
  return row?.name || row?.title || row?.display_name || row?.internal_name || "Logement";
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
              <p className="text-xs font-black uppercase text-white/40">À faire avant</p>
              <p className="mt-1 font-black">{fmt(request.ready_by_at || request.scheduled_end_at)}</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase text-white/40">Estimation</p>
              <p className="mt-1 font-black">
                {request.estimated_hours ?? "—"} h · {request.total_cost_eur ?? 0} €
              </p>
            </div>
          </div>
        </section>

        {request.occupied_warning_acknowledged_at && (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950 ring-1 ring-amber-100">
            Attention : cette intervention peut avoir lieu pendant une période occupée. Merci de coordonner l’accès avant d’intervenir.
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
            <form action={acceptIntervention}>
              <input type="hidden" name="token" value={token} />
              <button className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-lg font-black text-white">
                Accepter l’intervention
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
          <Link
            href={`/mission/${token}/intervention/report`}
            className="block rounded-2xl bg-slate-950 px-5 py-4 text-center text-lg font-black text-white"
          >
            Envoyer le rapport d’intervention
          </Link>
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
