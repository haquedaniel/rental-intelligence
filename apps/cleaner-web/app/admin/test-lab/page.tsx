import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createTestScenario, resetAllTestScenarios, resetTestScenario } from "./actions";

export const dynamic = "force-dynamic";

function dateLabel(value?: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status?: string): string {
  switch (status) {
    case "planning_changed":
      return "bg-amber-50 text-amber-800 ring-amber-100";
    case "scheduled":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export default async function TestLabPage() {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const [
    { data: properties },
    { data: scenarios },
    { data: requests },
    { data: messages },
  ] = await Promise.all([
    supabase.from("properties").select("id,name").order("name", { ascending: true }),
    supabase.from("test_scenarios").select("*").order("created_at", { ascending: false }),
    supabase
      .from("cleaning_requests")
      .select("*, properties:property_id(name), cleaners:assigned_cleaner_id(first_name,last_name)")
      .not("test_scenario_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("outbound_messages")
      .select("*")
      .eq("is_test", true)
      .order("created_at", { ascending: false }),
  ]);

  const requestRows = requests ?? [];
  const messageRows = messages ?? [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-slate-950">
            Test lab
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Créez des réservations et missions simulées, visualisez les faux SMS, ouvrez les vrais liens mission, puis supprimez uniquement les données de test.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-950">
            Nouveau scénario
          </h2>

          <form action={createTestScenario} className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Bien</span>
              <select
                name="property_id"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
              >
                <option value="">Choisir...</option>
                {(properties ?? []).map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Scénario</span>
              <select
                name="scenario_type"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
              >
                <option value="primary_available">Primaire disponible</option>
                <option value="primary_unavailable_backup">Primaire indisponible → backup</option>
                <option value="planning_change">Nouvelle réservation pendant la fenêtre</option>
              </select>
            </label>

            <div className="flex items-end">
              <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white">
                Créer le scénario
              </button>
            </div>
          </form>

          <form action={resetAllTestScenarios} className="mt-4">
            <button className="text-sm font-bold text-red-700">
              Supprimer tous les scénarios test
            </button>
          </form>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-950">
              Scénarios
            </h2>

            {(scenarios ?? []).length === 0 && (
              <div className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-slate-200">
                Aucun scénario de test pour l’instant.
              </div>
            )}

            {(scenarios ?? []).map((scenario) => {
              const scenarioRequests = requestRows.filter(
                (request) => request.test_scenario_id === scenario.id,
              );

              return (
                <article key={scenario.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">
                        {scenario.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {dateLabel(scenario.created_at)}
                      </p>
                    </div>

                    <form action={resetTestScenario}>
                      <input type="hidden" name="scenario_id" value={scenario.id} />
                      <button className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                        Reset
                      </button>
                    </form>
                  </div>

                  <div className="mt-4 space-y-3">
                    {scenarioRequests.map((request) => {
                      const cleanerName = [
                        request.cleaners?.first_name,
                        request.cleaners?.last_name,
                      ].filter(Boolean).join(" ") || "Intervenante";

                      return (
                        <div key={request.id} className="rounded-2xl bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-950">
                                {request.properties?.name ?? "Logement"}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                Envoyée à {cleanerName}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                Fenêtre : {dateLabel(request.work_window_start_at)} → {dateLabel(request.work_window_end_at)}
                              </p>
                            </div>

                            <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(request.schedule_status)}`}>
                              {request.schedule_status}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link
                              href={`/mission/${request.public_token}/ready-day`}
                              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
                            >
                              Ouvrir côté cleaner
                            </Link>

                            <Link
                              href={`/mission/${request.public_token}/report`}
                              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
                            >
                              Rapport
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="space-y-4">
            <h2 className="text-xl font-bold text-slate-950">
              Fake SMS inbox
            </h2>

            {messageRows.length === 0 && (
              <div className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-slate-200">
                Aucun faux SMS.
              </div>
            )}

            {messageRows.map((message) => (
              <article key={message.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {message.recipient_phone}
                </p>

                <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-sm text-slate-800">
                  {message.body}
                </pre>

                <p className="mt-2 text-xs text-slate-400">
                  {dateLabel(message.created_at)}
                </p>
              </article>
            ))}
          </aside>
        </section>
      </div>
    </main>
  );
}
