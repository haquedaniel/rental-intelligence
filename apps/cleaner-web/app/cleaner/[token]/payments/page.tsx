
import Link from "next/link";
import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCleanerLocale, intlLocale, t, type CleanerLocale } from "@/lib/cleanerI18n";
import { sendMonthlyPaymentRequest } from "./actions";

export const dynamic = "force-dynamic";

const PARIS_TZ = "Europe/Paris";

type Row = Record<string, any>;

function money(value: unknown): string {
  return `${Number(value ?? 0).toFixed(2)} €`;
}

function currentPeriod(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
}

function previousPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0, 12, 0, 0));

  return {
    startKey: `${year}-${String(month).padStart(2, "0")}-01`,
    endKey: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
  };
}

function monthLabel(period: string, locale: CleanerLocale = "fr"): string {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
}

function dateLabel(value?: string | null, locale: CleanerLocale = "fr"): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function dateKey(value: string): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function paymentDateKey(row: Row): string {
  return dateKey(
    row.ready_by_at ||
      row.completion_deadline_at ||
      row.work_window_end_at ||
      row.scheduled_end_at ||
      row.scheduled_start_at ||
      row.updated_at ||
      row.created_at,
  );
}

function paymentDateLabel(row: Row, locale: CleanerLocale = "fr"): string {
  return dateLabel(
    row.ready_by_at ||
      row.completion_deadline_at ||
      row.work_window_end_at ||
      row.scheduled_end_at ||
      row.scheduled_start_at ||
      row.updated_at ||
      row.created_at,
    locale,
  );
}

function statusLabel(status: string | undefined, locale: CleanerLocale = "fr"): string {
  switch (status) {
    case "sent_to_owner":
      return t(locale, "status.sentToOwner");
    case "paid":
      return t(locale, "status.paid");
    case "overdue":
      return t(locale, "status.overdue");
    case "cancelled":
    case "withdrawn":
      return t(locale, "status.cancelled");
    case "refused":
      return t(locale, "status.refused");
    default:
      return t(locale, "status.draft");
  }
}

export default async function CleanerPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ period?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  const period = query?.period || currentPeriod();
  const { startKey, endKey } = monthBounds(period);

  const supabase = getSupabaseAdmin();

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!cleaner) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-6">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-950">{t("fr", "common.invalidLink")}</h1>
          <p className="mt-2 text-slate-600">{t("fr", "common.profileNotFound")}</p>
        </div>
      </main>
    );
  }

  const locale = getCleanerLocale(cleaner.preferred_language);

  const { data: allMissions } = await supabase
    .from("cleaning_requests")
    .select("*, properties:property_id(id,name,owner_id)")
    .eq("assigned_cleaner_id", cleaner.id)
    .in("status", ["report_submitted", "completed", "problem_reported"])
    .order("created_at", { ascending: true });

  const missions = (allMissions ?? []).filter((mission) => {
    const workKey = paymentDateKey(mission);
    return workKey >= startKey && workKey <= endKey;
  });

  const { data: extras } = await supabase
    .from("cleaning_request_extras")
    .select("*, properties:property_id(id,name,owner_id), cleaning_requests:cleaning_request_id(scheduled_start_at,title,service_type)")
    .eq("cleaner_id", cleaner.id)
    .in("status", ["pending_owner_review", "approved"])
    .order("created_at", { ascending: true });

  const ownerIds = Array.from(
    new Set([
      ...((missions ?? []).map((mission) => mission.properties?.owner_id).filter(Boolean)),
      ...((extras ?? []).map((extra) => extra.properties?.owner_id).filter(Boolean)),
    ]),
  );

  const { data: owners } = ownerIds.length
    ? await supabase.from("owners").select("*").in("id", ownerIds)
    : { data: [] as Row[] };

  const { data: existingRequests } = await supabase
    .from("monthly_payment_requests")
    .select("*")
    .eq("cleaner_id", cleaner.id)
    .eq("period_start", startKey)
    .eq("period_end", endKey);

  const ownersById = new Map((owners ?? []).map((owner) => [owner.id, owner]));
  const existingByOwnerId = new Map((existingRequests ?? []).map((request) => [request.owner_id, request]));

  const groups = ownerIds.map((ownerId) => {
    const missionRows = (missions ?? []).filter(
      (mission) => mission.properties?.owner_id === ownerId,
    );

    const extraRows = (extras ?? []).filter((extra) => {
      const workDate = extra.cleaning_requests?.scheduled_start_at ?? extra.created_at;
      const workKey = dateKey(workDate);
      return extra.properties?.owner_id === ownerId && workKey >= startKey && workKey <= endKey;
    });

    const baseTotal = missionRows.reduce(
      (sum, mission) => sum + Number(mission.total_cost_eur ?? 0),
      0,
    );

    const extrasTotal = extraRows.reduce(
      (sum, extra) => sum + Number(extra.amount_eur ?? 0),
      0,
    );

    return {
      ownerId,
      owner: ownersById.get(ownerId),
      missions: missionRows,
      extras: extraRows,
      baseTotal,
      extrasTotal,
      total: baseTotal + extrasTotal,
      paymentRequest: existingByOwnerId.get(ownerId),
    };
  });

  const grandTotal = groups.reduce((sum, group) => sum + group.total, 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href={`/cleaner/${token}`} className="text-sm font-semibold text-slate-600">
            {t(locale, "payments.backPlanning")}
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-slate-950">
            {t(locale, "payments.title")}
          </h1>

          <p className="mt-2 text-slate-600">
            {t(locale, "payments.subtitle")}
          </p>
        </div>

        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {monthLabel(period, locale)}
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-slate-300">{t(locale, "payments.owners")}</p>
              <p className="text-3xl font-bold">{groups.length}</p>
            </div>

            <div>
              <p className="text-sm text-slate-300">{t(locale, "payments.missions")}</p>
              <p className="text-3xl font-bold">
                {groups.reduce((sum, group) => sum + group.missions.length, 0)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-300">{t(locale, "payments.totalEstimated")}</p>
              <p className="text-3xl font-bold">{money(grandTotal)}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/cleaner/${token}/payments?period=${previousPeriod(period)}`}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white"
            >
              {t(locale, "payments.previousMonth")}
            </Link>

            <Link
              href={`/cleaner/${token}/payments?period=${nextPeriod(period)}`}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white"
            >
              {t(locale, "payments.nextMonth")}
            </Link>
          </div>
        </section>

        {groups.length === 0 && (
          <section className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-slate-200">
            {t(locale, "payments.noneCompleted")}
          </section>
        )}

        {groups.map((group) => {
          const ownerName =
            group.owner?.display_name ||
            group.owner?.legal_name ||
            t(locale, "payments.ownerFallback");

          const alreadySent = group.paymentRequest && group.paymentRequest.status !== "draft";

          return (
            <section key={group.ownerId} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">
                    {ownerName}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {group.missions.length} {t(locale, "payments.missionCount")} · {group.extras.length} {t(locale, "payments.extraCount")}
                  </p>

                  {group.paymentRequest && (
                    <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {statusLabel(group.paymentRequest.status, locale)}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-500">{t(locale, "payments.total")}</p>
                  <p className="text-3xl font-black text-slate-950">
                    {money(group.total)}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {group.missions.map((mission) => (
                  <div key={mission.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">
                          {mission.title || t(locale, "common.missionFallback")}
                        </p>
                        <p className="text-sm text-slate-500">
                          {paymentDateLabel(mission, locale)} · {mission.properties?.name}
                        </p>
                      </div>
                      <p className="font-black text-slate-950">{money(mission.total_cost_eur)}</p>
                    </div>
                  </div>
                ))}

                {group.extras.map((extra) => (
                  <div key={extra.id} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-amber-950">
                          {t(locale, "payments.exceptionalExtra")}
                        </p>
                        <p className="text-sm text-amber-900">
                          {extra.reason}
                        </p>
                      </div>
                      <p className="font-black text-amber-950">{money(extra.amount_eur)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {!alreadySent && (
                <form action={sendMonthlyPaymentRequest} className="mt-5 space-y-4">
                  <input type="hidden" name="cleaner_token" value={token} />
                  <input type="hidden" name="owner_id" value={group.ownerId} />
                  <input type="hidden" name="period" value={period} />

                  <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <p className="text-sm font-black text-slate-950">
                      {t(locale, "payments.previewTitle")}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {t(locale, "payments.previewBody").replace("{month}", monthLabel(period, locale))}
                    </p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <p className="font-semibold text-slate-500">{t(locale, "payments.missions")}</p>
                        <p className="font-black text-slate-950">{money(group.baseTotal)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-500">{t(locale, "payments.extras")}</p>
                        <p className="font-black text-slate-950">{money(group.extrasTotal)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-500">{t(locale, "payments.total")}</p>
                        <p className="font-black text-slate-950">{money(group.total)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <p className="text-sm font-black text-amber-950">
                      {t(locale, "payments.optionalExtraTitle")}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-amber-900/80">
                      {t(locale, "payments.optionalExtraBody")}
                    </p>

                    {[1, 2, 3].map((index) => (
                      <div key={index} className="mt-3 grid gap-2 md:grid-cols-[1fr_160px]">
                        <input
                          name={`extra_description_${index}`}
                          placeholder={index === 1 ? t(locale, "payments.extraPlaceholder1") : t(locale, "payments.extraPlaceholderOther")}
                          className="rounded-xl border border-amber-200 bg-white p-3 text-sm"
                        />
                        <input
                          name={`extra_amount_${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={t(locale, "payments.amountPlaceholder")}
                          className="rounded-xl border border-amber-200 bg-white p-3 text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <textarea
                    name="cleaner_message"
                    rows={3}
                    placeholder={t(locale, "payments.messagePlaceholder")}
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />

                  <button className="w-full rounded-2xl bg-slate-950 px-4 py-4 font-bold text-white">
                    {t(locale, "payments.sendRequestTo")} {ownerName}
                  </button>
                </form>
              )}
            </section>
          );
        })}
      </div>

      <CleanerBottomNav cleanerToken={token} active="payments" locale={locale} />
    </main>
  );
}
