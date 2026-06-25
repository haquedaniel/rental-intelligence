import Link from "next/link";
import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fullDateTimeLabel } from "@/lib/missionReadyDays";
import { acceptMissionReadyDay, refuseMissionFromReadyDay } from "./actions";

export const dynamic = "force-dynamic";

function money(value: unknown): string {
  return `${Number(value ?? 0).toFixed(2)} €`;
}

function shortDate(value?: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

export default async function MissionReadyDayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: request } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!request) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-6">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-950">Mission introuvable</h1>
          <p className="mt-2 text-slate-600">Le lien est invalide ou expiré.</p>
        </div>
      </main>
    );
  }

  const [{ data: property }, { data: cleaner }, { data: options }] = await Promise.all([
    request.property_id
      ? supabase.from("properties").select("*").eq("id", request.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
    request.assigned_cleaner_id
      ? supabase.from("cleaners").select("*").eq("id", request.assigned_cleaner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("cleaning_request_ready_day_options")
      .select("*")
      .eq("cleaning_request_id", request.id)
      .order("ready_by_at", { ascending: true }),
  ]);

  const availableOptions = (options ?? []).filter((option) => option.is_available);
  const selectedOption = (options ?? []).find((option) => option.selected_at);

  const cleanerName = [cleaner?.first_name, cleaner?.last_name]
    .filter(Boolean)
    .join(" ") || "Intervenante";

  const propertyName = property?.name ?? "Logement";

  const waitingForReadyDay =
    request.schedule_status === "waiting_for_ready_day" && !request.ready_by_at;

  const isAccepted =
    (request.status === "accepted" && !waitingForReadyDay) ||
    request.schedule_status === "scheduled";

  const isRefused = request.status === "refused";
  const planningChanged = request.schedule_status === "planning_changed";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Proposition de mission
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            {propertyName}
          </h1>

          <p className="mt-2 text-slate-300">
            Pour {cleanerName}
          </p>

          <div className="mt-5 grid gap-3 rounded-2xl bg-white/10 p-4 text-sm">
            <p>
              <strong>Départ voyageurs :</strong>{" "}
              {request.work_window_start_at
                ? fullDateTimeLabel(request.work_window_start_at)
                : fullDateTimeLabel(request.scheduled_start_at)}
            </p>

            <p>
              <strong>Date limite :</strong>{" "}
              {fullDateTimeLabel(request.work_window_end_at || request.completion_deadline_at)}
            </p>

            <p>
              <strong>Rémunération :</strong> {money(request.total_cost_eur)}
            </p>
          </div>
        </section>

        {planningChanged && (
          <section className="rounded-3xl bg-amber-50 p-5 text-amber-950 shadow-sm ring-1 ring-amber-200">
            <h2 className="text-xl font-bold">Planning modifié</h2>
            <p className="mt-2 text-sm">
              Une nouvelle réservation ou une modification affecte cette mission. Nous vérifions l’organisation et revenons vers vous rapidement.
            </p>
          </section>
        )}

        {isAccepted && (
          <section className="rounded-3xl bg-emerald-50 p-5 text-emerald-950 shadow-sm ring-1 ring-emerald-200">
            <h2 className="text-xl font-bold">Mission acceptée</h2>

            <p className="mt-2 text-sm">
              Le logement doit être prêt avant 16h le{" "}
              <strong>{request.ready_by_at ? shortDate(request.ready_by_at) : shortDate(selectedOption?.ready_by_at)}</strong>.
            </p>

            <Link
              href={`/mission/${token}/report`}
              className="mt-4 inline-flex w-full justify-center rounded-2xl bg-emerald-700 px-4 py-4 font-bold text-white"
            >
              Commencer le rapport de ménage
            </Link>
          </section>
        )}

        {isRefused && (
          <section className="rounded-3xl bg-red-50 p-5 text-red-950 shadow-sm ring-1 ring-red-200">
            <h2 className="text-xl font-bold">Mission refusée</h2>
            <p className="mt-2 text-sm">Merci, votre réponse a bien été enregistrée.</p>
          </section>
        )}

        {!isAccepted && !isRefused && !planningChanged && (
          <>
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold text-slate-950">
                Quand le logement sera-t-il prêt ?
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Choisissez le jour où vous vous engagez à rendre le logement prêt avant 16h.
              </p>

              <div className="mt-4 space-y-3">
                {availableOptions.length === 0 && (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    Aucun jour disponible n’a encore été proposé. Merci de contacter le propriétaire.
                  </p>
                )}

                {availableOptions.map((option) => (
                  <form key={option.id} action={acceptMissionReadyDay}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="option_id" value={option.id} />

                    <button className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-slate-100">
                      <span className="block text-lg font-black text-slate-950">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        Engagement : prêt avant 16h
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-950">Refuser la mission</h2>

              <form action={refuseMissionFromReadyDay} className="mt-3 space-y-3">
                <input type="hidden" name="token" value={token} />

                <textarea
                  name="refusal_reason"
                  required
                  rows={3}
                  placeholder="Raison du refus obligatoire"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />

                <button className="w-full rounded-2xl bg-red-700 px-4 py-3 font-bold text-white">
                  Refuser cette mission
                </button>
              </form>
            </section>
          </>
        )}
      </div>

      <CleanerBottomNav
        cleanerToken={cleaner?.public_token}
        missionToken={token}
        active="missions"
      />
    </main>
  );
}
