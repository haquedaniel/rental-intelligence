import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import OwnerBottomNav, { OwnerTopNav } from "@/components/owner/OwnerBottomNav";
import BriefingPreferencesForm from "@/components/owner/activity/BriefingPreferencesForm";
import BriefingPreviewRequest from "@/components/owner/activity/BriefingPreviewRequest";

export const dynamic = "force-dynamic";

const checks = [
  ["include_reservations", "Réservations nouvelles, modifiées ou annulées"],
  ["include_cleaning_completed", "Missions terminées et photos"],
  ["include_cleaner_accepted", "Mission acceptée"],
  ["include_cleaner_refused", "Mission refusée"],
  ["include_cleaning_rescheduled", "Mission replanifiée"],
  ["include_pricing", "Évolution des prix"],
  ["include_min_stay", "Séjours minimums modifiés"],
] as const;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ ownerToken: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { ownerToken } = await params;
  const { tab: requestedTab } = await searchParams;
  const tab = requestedTab === "briefings" ? "briefings" : "journal";

  const db = getSupabaseAdmin();
  const { data: owner } = await db
    .from("owners")
    .select("id,name,display_name")
    .eq("public_token", decodeURIComponent(ownerToken))
    .eq("active", true)
    .maybeSingle();
  if (!owner) notFound();

  const [propertiesResult, situationsResult, briefingsResult, preferenceResult, requestsResult] =
    await Promise.all([
      db.from("properties").select("id,name,status").eq("owner_id", owner.id).order("name"),
      db
        .from("ops_situations")
        .select("*")
        .eq("owner_id", owner.id)
        .order("requires_owner_action", { ascending: false })
        .order("last_observed_at", { ascending: false })
        .limit(100),
      db
        .from("ops_briefings")
        .select("*")
        .eq("owner_id", owner.id)
        .order("generated_at", { ascending: false })
        .limit(30),
      db.from("ops_briefing_preferences").select("*").eq("owner_id", owner.id).maybeSingle(),
      db
        .from("ops_briefing_requests")
        .select("id,status,error,created_at,completed_at,briefing_id")
        .eq("owner_id", owner.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const properties = propertiesResult.data ?? [];
  const situations = situationsResult.data ?? [];
  const briefings = briefingsResult.data ?? [];
  const pref = preferenceResult.data ?? {};
  const requests = requestsResult.data ?? [];
  const base = `/owner/${encodeURIComponent(ownerToken)}/activity`;

  return (
    <main className="min-h-screen bg-[#f2eee6] text-[#112532]">
      <div className="mx-auto max-w-5xl px-4 py-5 pb-24">
        <OwnerTopNav active="activity" />

        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#e0680e]">
              Journal Pilotys
            </p>
            <h1 className="max-w-2xl text-3xl font-black">
              Je vous tiens au courant de ce qui compte vraiment.
            </h1>
          </div>
          <Link
            className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
            href={`/owner/${encodeURIComponent(ownerToken)}/cockpit`}
          >
            Retour au cockpit
          </Link>
        </div>

        <div className="mt-6 inline-flex rounded-2xl bg-white/65 p-1 shadow-sm">
          <Link
            href={`${base}?tab=journal`}
            className={`rounded-xl px-5 py-2 text-sm font-black ${
              tab === "journal" ? "bg-[#112532] text-white" : "text-[#112532]/60"
            }`}
          >
            Journal
          </Link>
          <Link
            href={`${base}?tab=briefings`}
            className={`rounded-xl px-5 py-2 text-sm font-black ${
              tab === "briefings" ? "bg-[#112532] text-white" : "text-[#112532]/60"
            }`}
          >
            Briefings
          </Link>
        </div>

        {tab === "journal" ? (
          <section className="mt-6 space-y-4">
            {situations.length ? (
              situations.map((situation: any) => (
                <article
                  key={situation.id}
                  className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/5"
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                        situation.requires_owner_action
                          ? "bg-red-500"
                          : situation.situation_type?.startsWith("pricing_")
                            ? "bg-amber-500"
                            : situation.situation_type?.startsWith("cleaning_")
                              ? "bg-emerald-500"
                              : "bg-sky-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-black leading-tight">{situation.headline}</h2>
                      <p className="mt-3 text-[16px] leading-7">{situation.situation_text}</p>
                      <p className="mt-3 text-[16px] leading-7">{firstPerson(situation.action_text)}</p>
                      <p className="mt-3 text-[15px] leading-6 text-[#112532]/65">
                        {firstPerson(situation.next_step_text)}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#112532]/45">
                        <span>
                          {new Date(situation.last_observed_at).toLocaleString("fr-FR")}
                        </span>
                        {situation.requires_owner_action && (
                          <span className="rounded-full bg-red-50 px-3 py-1 font-black text-red-700">
                            Votre attention est requise
                          </span>
                        )}
                      </div>

                      <details className="mt-4 rounded-2xl bg-[#f7f4ee] px-4 py-3">
                        <summary className="cursor-pointer text-sm font-black">
                          Voir pourquoi
                        </summary>
                        <p className="mt-3 text-sm leading-6 text-[#112532]/70">
                          {situation.explanation_text || "Pilotys a regroupé les faits disponibles pour vous présenter l’essentiel."}
                        </p>
                        {Array.isArray(situation.metadata?.dates) &&
                          situation.metadata.dates.length > 0 && (
                            <p className="mt-2 text-xs text-[#112532]/45">
                              {situation.metadata.dates.length} date(s) concernée(s).
                            </p>
                          )}
                      </details>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-3xl bg-white p-8">
                Rien de notable à signaler pour le moment.
              </div>
            )}
          </section>
        ) : (
          <section className="mt-6 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
            <div className="space-y-5">
              <BriefingPreferencesForm
                ownerToken={ownerToken}
                properties={properties}
                pref={pref}
                checks={checks}
              />
              <BriefingPreviewRequest ownerToken={ownerToken} />
              {requests.length > 0 && (
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <h2 className="font-black">Prévisualisations demandées</h2>
                  <div className="mt-3 space-y-2">
                    {requests.map((request: any) => (
                      <div key={request.id} className="rounded-2xl bg-[#f7f4ee] px-4 py-3 text-sm">
                        <strong>
                          {request.status === "completed"
                            ? "✓ Terminée"
                            : request.status === "failed"
                              ? "Échec"
                              : "En cours"}
                        </strong>{" "}
                        · {new Date(request.created_at).toLocaleString("fr-FR")}
                        {request.error ? ` · ${request.error}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">Les messages envoyés</h2>
              <p className="mt-1 text-sm text-[#112532]/55">
                Chaque briefing reprend les situations importantes dans un langage simple.
              </p>
              <div className="mt-4 space-y-3">
                {briefings.length ? (
                  briefings.map((briefing: any, index: number) => (
                    <details
                      key={briefing.id}
                      open={index === 0}
                      className="rounded-2xl border border-[#112532]/10 p-4"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black">
                              {briefing.frequency === "preview" ? "Prévisualisation" : "Briefing Pilotys"}
                            </div>
                            <div className="text-sm text-[#112532]/55">
                              {new Date(briefing.generated_at).toLocaleString("fr-FR")}
                            </div>
                          </div>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
                            {briefing.status === "generated"
                              ? "Prévisualisation"
                              : briefing.status === "sent"
                                ? "Envoyé"
                                : "En attente d’envoi"}
                          </span>
                        </div>
                      </summary>
                      <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-[#f7f4ee] p-4 font-sans text-sm leading-6">
                        {briefing.body}
                      </pre>
                    </details>
                  ))
                ) : (
                  <div className="rounded-2xl bg-[#f7f4ee] p-6 text-sm">
                    Aucun briefing généré pour le moment.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
      <OwnerBottomNav active="activity" />
    </main>
  );
}

function firstPerson(value?: string) {
  if (!value) return "";
  return value
    .replace(/^Pilotys a /, "J’ai ")
    .replace(/^Pilotys continuera/, "Je continuerai")
    .replace(/^Pilotys surveillera/, "Je surveillerai")
    .replace(/^Pilotys vérifiera/, "Je vérifierai");
}
