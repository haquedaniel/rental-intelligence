import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import OwnerBottomNav, {
  OwnerTopNav,
} from "@/components/owner/OwnerBottomNav";
import BriefingPreferencesForm from "@/components/owner/activity/BriefingPreferencesForm";
import BriefingPreviewRequest from "@/components/owner/activity/BriefingPreviewRequest";

export const dynamic = "force-dynamic";

const checks = [
  ["include_reservations", "Réservations nouvelles, modifiées ou annulées"],
  ["include_cleaning_completed", "Missions terminées et photos"],
  ["include_cleaner_accepted", "Mission acceptée"],
  ["include_cleaner_refused", "Mission refusée"],
  ["include_cleaning_rescheduled", "Mission replanifiée"],
  ["include_pricing", "Variations de prix"],
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
  const tab = requestedTab === "briefings" ? "briefings" : "activity";

  const db = getSupabaseAdmin();
  const { data: owner } = await db
    .from("owners")
    .select("id,name,display_name")
    .eq("public_token", decodeURIComponent(ownerToken))
    .eq("active", true)
    .maybeSingle();
  if (!owner) notFound();

  const [propertyResult, decisionResult, briefingResult, preferenceResult, requestResult] =
    await Promise.all([
      db
        .from("properties")
        .select("id,name,status")
        .eq("owner_id", owner.id)
        .order("name"),
      db
        .from("ops_decisions")
        .select("*")
        .eq("owner_id", owner.id)
        .order("occurred_at", { ascending: false })
        .limit(100),
      db
        .from("ops_briefings")
        .select("*")
        .eq("owner_id", owner.id)
        .order("generated_at", { ascending: false })
        .limit(30),
      db
        .from("ops_briefing_preferences")
        .select("*")
        .eq("owner_id", owner.id)
        .maybeSingle(),
      db
        .from("ops_briefing_requests")
        .select("id,status,error,created_at,completed_at,briefing_id")
        .eq("owner_id", owner.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const properties = propertyResult.data ?? [];
  const decisions = decisionResult.data ?? [];
  const briefings = briefingResult.data ?? [];
  const pref = preferenceResult.data ?? {};
  const requests = requestResult.data ?? [];
  const base = `/owner/${encodeURIComponent(ownerToken)}/activity`;

  return (
    <main className="min-h-screen bg-[#f2eee6] text-[#112532]">
      <div className="mx-auto max-w-6xl px-4 py-5 pb-24">
        <OwnerTopNav active="activity" />

        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#e0680e]">
              Activité Pilotys
            </p>
            <h1 className="text-3xl font-black">
              Votre gestion, expliquée simplement
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
            href={`${base}?tab=activity`}
            className={[
              "rounded-xl px-5 py-2 text-sm font-black",
              tab === "activity"
                ? "bg-[#112532] text-white"
                : "text-[#112532]/60",
            ].join(" ")}
          >
            Activité
          </Link>
          <Link
            href={`${base}?tab=briefings`}
            className={[
              "rounded-xl px-5 py-2 text-sm font-black",
              tab === "briefings"
                ? "bg-[#112532] text-white"
                : "text-[#112532]/60",
            ].join(" ")}
          >
            Briefings
          </Link>
        </div>

        {tab === "activity" ? (
          <section className="mt-5 space-y-3">
            {decisions.length ? (
              decisions.map((decision: any) => (
                <details
                  key={decision.id}
                  className="group rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex gap-3">
                      <span
                        className={[
                          "mt-1 h-3 w-3 shrink-0 rounded-full",
                          decision.requires_owner_action
                            ? "bg-red-500"
                            : decision.category === "pricing"
                              ? "bg-amber-500"
                              : decision.category === "cleaning"
                                ? "bg-emerald-500"
                                : "bg-sky-500",
                        ].join(" ")}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black">{decision.title}</div>
                            <div className="text-sm text-[#112532]/60">
                              {decision.summary} ·{" "}
                              {new Date(decision.occurred_at).toLocaleString("fr-FR")}
                            </div>
                          </div>
                          <span className="text-lg text-[#112532]/35 transition group-open:rotate-180">
                            ⌄
                          </span>
                        </div>
                      </div>
                    </div>
                  </summary>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <Info
                      title="Ce qui s’est passé"
                      text={decision.what_happened}
                    />
                    <Info title="Pourquoi" text={decision.why} />
                    <Info
                      title="Ce que Pilotys a fait"
                      text={decision.action_taken}
                    />
                  </div>
                </details>
              ))
            ) : (
              <div className="rounded-3xl bg-white p-8">
                Aucune activité enregistrée pour le moment.
              </div>
            )}
          </section>
        ) : (
          <section className="mt-5 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
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
                  <h2 className="font-black">Demandes de prévisualisation</h2>
                  <div className="mt-3 space-y-2">
                    {requests.map((request: any) => (
                      <div
                        key={request.id}
                        className="rounded-2xl bg-[#f7f4ee] px-4 py-3 text-sm"
                      >
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Historique des briefings</h2>
                  <p className="text-sm text-[#112532]/55">
                    Texte envoyé par SMS ou généré en prévisualisation.
                  </p>
                </div>
                <span className="rounded-full bg-[#f7f4ee] px-3 py-1 text-xs font-black">
                  {briefings.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {briefings.length ? (
                  briefings.map((briefing: any) => (
                    <details
                      key={briefing.id}
                      open={briefing === briefings[0]}
                      className="rounded-2xl border border-[#112532]/10 p-4"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black">
                              {briefing.frequency === "preview"
                                ? "Prévisualisation"
                                : "Briefing envoyé ou programmé"}
                            </div>
                            <div className="text-sm text-[#112532]/55">
                              {new Date(briefing.generated_at).toLocaleString(
                                "fr-FR",
                              )}{" "}
                              · {briefing.decision_count} décision(s)
                            </div>
                          </div>
                          <StatusBadge status={briefing.status} />
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

function Info({ title, text }: { title: string; text?: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f4ee] p-3">
      <div className="text-xs font-black uppercase text-[#112532]/45">
        {title}
      </div>
      <div className="mt-1 text-sm">{text || "—"}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "sent"
      ? "Envoyé"
      : status === "generated"
        ? "Prévisualisation"
        : status === "failed"
          ? "Échec"
          : status === "queued"
            ? "En attente d’envoi"
            : status;
  return (
    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
      {label}
    </span>
  );
}
