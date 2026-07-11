import Link from "next/link";
import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import CleanerMissionNav from "@/components/navigation/CleanerMissionNav";
import { fullDateTimeLabel } from "@/lib/missionReadyDays";
import { acceptMissionReadyDay, refuseMissionFromReadyDay } from "./actions";
import { getCleanerLocale, t } from "@/lib/cleanerI18n";

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
      <main className="min-h-screen bg-[#F6F3EF] px-4 pb-28 pt-6">

      <Link
        href={`/mission/${token}/reservation`}
        className="mb-4 inline-flex rounded-full bg-[#112532] px-4 py-3 text-sm font-black text-white shadow-sm"
      >
        Briefing séjour →
      </Link>

        <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#112532]/10">
          <h1 className="text-2xl font-bold text-[#112532]">{t("fr", "common.missionNotFound")}</h1>
          <p className="mt-2 text-[#112532]/62">{t("fr", "common.missionNotFoundBody")}</p>
        </div>
            <CleanerMissionNav missionToken={token} active="missions" />
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

  const locale = getCleanerLocale(cleaner?.preferred_language);

  const cleanerName = [cleaner?.first_name, cleaner?.last_name]
    .filter(Boolean)
    .join(" ") || t(locale, "common.cleanerFallback");

  const propertyName = property?.name ?? t(locale, "common.propertyFallback");

  const waitingForReadyDay =
    request.schedule_status === "waiting_for_ready_day" && !request.ready_by_at;

  const isAccepted =
    (request.status === "accepted" && !waitingForReadyDay) ||
    request.schedule_status === "scheduled";

  const isRefused = request.status === "refused";
  const planningChanged = request.schedule_status === "planning_changed";

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <section className="rounded-3xl bg-[#112532] p-6 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#112532]/36">
            {t(locale, "mission.proposal")}
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            {propertyName}
          </h1>

          <p className="mt-2 text-slate-300">
            {t(locale, "ready.forCleaner")} {cleanerName}
          </p>

          <div className="mt-5 grid gap-3 rounded-2xl bg-white/10 p-4 text-sm">
            <p>
              <strong>{t(locale, "ready.guestDeparture")} :</strong>{" "}
              {request.work_window_start_at
                ? fullDateTimeLabel(request.work_window_start_at)
                : fullDateTimeLabel(request.scheduled_start_at)}
            </p>

            <p>
              <strong>{t(locale, "ready.deadline")} :</strong>{" "}
              {fullDateTimeLabel(request.work_window_end_at || request.completion_deadline_at)}
            </p>

            <p>
              <strong>{t(locale, "mission.remuneration")} :</strong> {money(request.total_cost_eur)}
            </p>
          </div>
        </section>

        {planningChanged && (
          <section className="rounded-3xl bg-[#FFF5DD] p-5 text-amber-950 shadow-sm ring-1 ring-amber-200">
            <h2 className="text-xl font-bold">{t(locale, "ready.planningChangedTitle")}</h2>
            <p className="mt-2 text-sm">
              {t(locale, "ready.planningChangedBody")}
            </p>
          </section>
        )}

        {isAccepted && (
          <section className="rounded-3xl bg-[#ECFFF6] p-5 text-emerald-950 shadow-sm ring-1 ring-emerald-200">
            <h2 className="text-xl font-bold">{t(locale, "ready.acceptedTitle")}</h2>

            <p className="mt-2 text-sm">
              {t(locale, "ready.readyBeforeOn")} {" "}
              <strong>{request.ready_by_at ? shortDate(request.ready_by_at) : shortDate(selectedOption?.ready_by_at)}</strong>.
            </p>

            <Link
              href={`/mission/${token}/report`}
              className="mt-4 inline-flex w-full justify-center rounded-2xl bg-emerald-700 px-4 py-4 font-bold text-white"
            >
              {t(locale, "mission.startReport")}
            </Link>
          </section>
        )}

        {isRefused && (
          <section className="rounded-3xl bg-red-50 p-5 text-red-950 shadow-sm ring-1 ring-red-200">
            <h2 className="text-xl font-bold">{t(locale, "ready.refusedTitle")}</h2>
            <p className="mt-2 text-sm">{t(locale, "ready.refusedBody")}</p>
          </section>
        )}

        {!isAccepted && !isRefused && !planningChanged && (
          <>
            <section className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8">
              <h2 className="text-xl font-bold text-[#112532]">
                {t(locale, "ready.questionTitle")}
              </h2>

              <p className="mt-2 text-sm text-[#112532]/62">
                {t(locale, "ready.questionBody")}
              </p>

              <div className="mt-4 space-y-3">
                {availableOptions.length === 0 && (
                  <p className="rounded-2xl bg-[#F6F3EF] p-4 text-sm text-[#112532]/62">
                    {t(locale, "ready.noAvailableDay")}
                  </p>
                )}

                {availableOptions.map((option) => (
                  <form key={option.id} action={acceptMissionReadyDay}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="option_id" value={option.id} />

                    <button className="w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] p-4 text-left transition hover:bg-slate-100">
                      <span className="block text-lg font-black text-[#112532]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-sm text-[#112532]/48">
                        {t(locale, "ready.commitment")}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8">
              <h2 className="text-lg font-bold text-[#112532]">{t(locale, "ready.refuseTitle")}</h2>

              <form action={refuseMissionFromReadyDay} className="mt-3 space-y-3">
                <input type="hidden" name="token" value={token} />

                <textarea
                  name="refusal_reason"
                  required
                  rows={3}
                  placeholder={t(locale, "ready.refusalPlaceholder")}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />

                <button className="w-full rounded-2xl bg-red-700 px-4 py-3 font-bold text-white">
                  {t(locale, "ready.refuseButton")}
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
        locale={locale}
      />
    </main>
  );
}
