import Link from "next/link";
import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCleanerLocale, intlLocale, t, type CleanerLocale } from "@/lib/cleanerI18n";
import { sendMonthlyPaymentRequest } from "./actions";

export const dynamic = "force-dynamic";

const PARIS_TZ = "Europe/Paris";
const ACTIVE_REQUEST_STATUSES = new Set(["draft", "sent_to_owner", "paid", "overdue"]);

type Row = Record<string, any>;

type RequestableGroup = {
  ownerId: string;
  period: string;
  missions: Row[];
};

const COPY = {
  fr: {
    back: "← Mon planning",
    title: "Mes gains",
    bravo: (name: string) => `Bravo ${name}, business is good !`,
    subtitle: "Suivez vos missions terminées, préparez vos demandes et gardez l’historique de vos paiements.",
    earnedToDate: "Gagné au total",
    thisMonth: "Ce mois-ci",
    requestNow: "À demander maintenant",
    pendingPayment: "En attente de paiement",
    sent: "Demande envoyée ✅",
    sentBody: "Le propriétaire a reçu votre demande de paiement.",
    requestableTitle: "À demander maintenant",
    requestableEmpty: "Rien à demander pour le moment. Les missions du mois en cours seront disponibles le mois prochain.",
    requestCard: (amount: string, owner: string, month: string) =>
      `Vous avez gagné ${amount} avec ${owner} en ${month}.`,
    prepare: "Préparer la demande",
    lineItems: "Missions incluses",
    exceptionalCost: "Frais exceptionnel",
    exceptionalPlaceholder: "Ex : déplacement exceptionnel, achat urgent…",
    amount: "Montant",
    messageOwner: "Message au propriétaire",
    messagePlaceholder: "Message optionnel au propriétaire…",
    sendRequest: "Envoyer la demande de paiement",
    history: "Historique",
    historyIntro: "Toutes les missions terminées, groupées par propriétaire et par demande.",
    noHistory: "Aucune mission terminée pour le moment.",
    notRequested: "Pas encore demandée",
    currentMonthNotReady: "Mois en cours — demandable plus tard",
    alreadyIncluded: "Déjà dans une demande",
    paid: "Payée",
    sentToOwner: "Envoyée",
    overdue: "En retard",
    refused: "Refusée",
    cancelled: "Annulée",
    ownerFallback: "Propriétaire",
    missionFallback: "Mission",
    checklistFallback: "Ménage",
  },
  en: {
    back: "← My schedule",
    title: "My earnings",
    bravo: (name: string) => `Great work ${name}, business is good!`,
    subtitle: "Track completed missions, prepare payment requests and keep your payment history.",
    earnedToDate: "Earned to date",
    thisMonth: "This month",
    requestNow: "Ready to request",
    pendingPayment: "Waiting for payment",
    sent: "Request sent ✅",
    sentBody: "The owner has received your payment request.",
    requestableTitle: "Ready to request",
    requestableEmpty: "Nothing to request right now. Current-month missions will be available next month.",
    requestCard: (amount: string, owner: string, month: string) =>
      `You earned ${amount} with ${owner} in ${month}.`,
    prepare: "Prepare request",
    lineItems: "Included missions",
    exceptionalCost: "Exceptional cost",
    exceptionalPlaceholder: "E.g. special trip, urgent purchase…",
    amount: "Amount",
    messageOwner: "Message to owner",
    messagePlaceholder: "Optional message to the owner…",
    sendRequest: "Send payment request",
    history: "History",
    historyIntro: "All completed missions, grouped by owner and payment request.",
    noHistory: "No completed mission yet.",
    notRequested: "Not requested yet",
    currentMonthNotReady: "Current month — request later",
    alreadyIncluded: "Already in a request",
    paid: "Paid",
    sentToOwner: "Sent",
    overdue: "Overdue",
    refused: "Refused",
    cancelled: "Cancelled",
    ownerFallback: "Owner",
    missionFallback: "Mission",
    checklistFallback: "Cleaning",
  },
  ru: {
    back: "← Моё расписание",
    title: "Мои доходы",
    bravo: (name: string) => `Отлично, ${name}, работа идёт хорошо!`,
    subtitle: "Смотрите выполненные задания, отправляйте запросы на оплату и историю платежей.",
    earnedToDate: "Заработано всего",
    thisMonth: "В этом месяце",
    requestNow: "Можно запросить",
    pendingPayment: "Ожидает оплаты",
    sent: "Запрос отправлен ✅",
    sentBody: "Владелец получил ваш запрос на оплату.",
    requestableTitle: "Можно запросить сейчас",
    requestableEmpty: "Пока нечего запрашивать. Задания текущего месяца будут доступны в следующем месяце.",
    requestCard: (amount: string, owner: string, month: string) =>
      `Вы заработали ${amount} у ${owner} за ${month}.`,
    prepare: "Подготовить запрос",
    lineItems: "Включённые задания",
    exceptionalCost: "Дополнительные расходы",
    exceptionalPlaceholder: "Напр. отдельная поездка, срочная покупка…",
    amount: "Сумма",
    messageOwner: "Сообщение владельцу",
    messagePlaceholder: "Необязательное сообщение владельцу…",
    sendRequest: "Отправить запрос на оплату",
    history: "История",
    historyIntro: "Все выполненные задания по владельцам и запросам на оплату.",
    noHistory: "Пока нет выполненных заданий.",
    notRequested: "Ещё не запрошено",
    currentMonthNotReady: "Текущий месяц — запрос позже",
    alreadyIncluded: "Уже в запросе",
    paid: "Оплачено",
    sentToOwner: "Отправлено",
    overdue: "Просрочено",
    refused: "Отклонено",
    cancelled: "Отменено",
    ownerFallback: "Владелец",
    missionFallback: "Задание",
    checklistFallback: "Уборка",
  },
} as const;

function copy(locale: CleanerLocale) {
  if (locale === "en" || locale === "ru") return COPY[locale];
  return COPY.fr;
}

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

  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function monthBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0, 12, 0, 0));

  return {
    startKey: `${year}-${String(month).padStart(2, "0")}-01`,
    endKey: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
  };
}

function monthLabel(period: string, locale: CleanerLocale): string {
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

  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function periodFromDateKey(key: string): string {
  return key.slice(0, 7);
}

function paymentDateValue(row: Row): string {
  return (
    row.ready_by_at ||
    row.completion_deadline_at ||
    row.work_window_end_at ||
    row.scheduled_end_at ||
    row.scheduled_start_at ||
    row.updated_at ||
    row.created_at
  );
}

function paymentDateKey(row: Row): string {
  return dateKey(paymentDateValue(row));
}

function ownerName(owner: Row | undefined, locale: CleanerLocale): string {
  const c = copy(locale);
  return owner?.display_name || owner?.legal_name || c.ownerFallback;
}

function cleanerFirstName(cleaner: Row): string {
  return cleaner.first_name || cleaner.trading_name || "Sandrine";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "★";
}

function requestStatusLabel(status: string | undefined, locale: CleanerLocale): string {
  const c = copy(locale);
  switch (status) {
    case "paid":
      return c.paid;
    case "sent_to_owner":
      return c.sentToOwner;
    case "overdue":
      return c.overdue;
    case "refused":
      return c.refused;
    case "cancelled":
    case "withdrawn":
      return c.cancelled;
    default:
      return c.alreadyIncluded;
  }
}

function missionChecklistName(mission: Row, locale: CleanerLocale): string {
  const c = copy(locale);
  const report = Array.isArray(mission.cleaning_reports)
    ? mission.cleaning_reports[0]
    : mission.cleaning_reports;

  return (
    report?.checklist_snapshot?.template_name ||
    mission.title ||
    c.checklistFallback
  );
}

async function signedOwnerPhoto(supabase: ReturnType<typeof getSupabaseAdmin>, owner: Row) {
  if (!owner?.profile_photo_bucket || !owner?.profile_photo_path) return null;

  const { data } = await supabase.storage
    .from(owner.profile_photo_bucket)
    .createSignedUrl(owner.profile_photo_path, 60 * 60);

  return data?.signedUrl ?? null;
}

function OwnerAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl?: string | null;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200"
      />
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-base font-black text-white">
      {initials(name)}
    </div>
  );
}

export default async function CleanerPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ sent?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = getSupabaseAdmin();

  const current = currentPeriod();
  const { startKey: currentMonthStart, endKey: currentMonthEnd } = monthBounds(current);

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
  const c = copy(locale);

  const { data: allMissions } = await supabase
    .from("cleaning_requests")
    .select(`
      *,
      properties:property_id(id,name,owner_id),
      cleaning_reports(id, submitted_at, checklist_template_id, checklist_version, checklist_snapshot)
    `)
    .eq("assigned_cleaner_id", cleaner.id)
    .in("status", ["report_submitted", "completed", "problem_reported"])
    .order("created_at", { ascending: true });

  const missions = (allMissions ?? []) as Row[];
  const missionIds = missions.map((mission) => mission.id).filter(Boolean);

  const { data: paymentLines } = missionIds.length
    ? await supabase
        .from("monthly_payment_request_lines")
        .select("id,cleaning_request_id,monthly_payment_request_id,line_type,description,work_date,amount_eur,status")
        .in("cleaning_request_id", missionIds)
    : { data: [] as Row[] };

  const paymentRequestIds = [
    ...new Set((paymentLines ?? []).map((line) => line.monthly_payment_request_id).filter(Boolean)),
  ];

  const { data: paymentRequests } = paymentRequestIds.length
    ? await supabase
        .from("monthly_payment_requests")
        .select("*")
        .in("id", paymentRequestIds)
    : { data: [] as Row[] };

  const paymentRequestById = new Map((paymentRequests ?? []).map((request) => [request.id, request]));
  const activeIncludedMissionIds = new Set(
    (paymentLines ?? [])
      .filter((line) => {
        const request = paymentRequestById.get(line.monthly_payment_request_id);
        return ACTIVE_REQUEST_STATUSES.has(String(request?.status ?? "draft"));
      })
      .map((line) => String(line.cleaning_request_id)),
  );
  const lineByMissionId = new Map((paymentLines ?? []).map((line) => [String(line.cleaning_request_id), line]));

  const ownerIds = [
    ...new Set(missions.map((mission) => mission.properties?.owner_id).filter(Boolean)),
  ];

  const { data: owners } = ownerIds.length
    ? await supabase.from("owners").select("*").in("id", ownerIds)
    : { data: [] as Row[] };

  const ownersById = new Map((owners ?? []).map((owner) => [owner.id, owner]));

  const ownerPhotoEntries = await Promise.all(
    (owners ?? []).map(async (owner) => [owner.id, await signedOwnerPhoto(supabase, owner)] as const),
  );
  const ownerPhotoById = new Map(ownerPhotoEntries);

  const totalEarned = missions.reduce((sum, mission) => sum + Number(mission.total_cost_eur ?? 0), 0);
  const currentMonthEarned = missions
    .filter((mission) => {
      const key = paymentDateKey(mission);
      return key >= currentMonthStart && key <= currentMonthEnd;
    })
    .reduce((sum, mission) => sum + Number(mission.total_cost_eur ?? 0), 0);

  const waitingPayment = (paymentRequests ?? [])
    .filter((request) => ["sent_to_owner", "overdue"].includes(String(request.status)))
    .reduce((sum, request) => sum + Number(request.total_eur ?? 0), 0);

  const requestableMissions = missions.filter((mission) => {
    const key = paymentDateKey(mission);
    return key < currentMonthStart && !activeIncludedMissionIds.has(String(mission.id));
  });

  const requestableGroups = new Map<string, RequestableGroup>();

  for (const mission of requestableMissions) {
    const ownerId = mission.properties?.owner_id;
    if (!ownerId) continue;

    const period = periodFromDateKey(paymentDateKey(mission));
    const key = `${ownerId}:${period}`;
    const currentGroup: RequestableGroup = requestableGroups.get(key) ?? { ownerId, period, missions: [] as Row[] };
    currentGroup.missions.push(mission);
    requestableGroups.set(key, currentGroup);
  }

  const requestable = [...requestableGroups.values()].sort((a, b) =>
    `${a.period}:${ownerName(ownersById.get(a.ownerId), locale)}`.localeCompare(
      `${b.period}:${ownerName(ownersById.get(b.ownerId), locale)}`,
    ),
  );

  const requestableTotal = requestableMissions.reduce(
    (sum, mission) => sum + Number(mission.total_cost_eur ?? 0),
    0,
  );

  const missionsByOwner = new Map<string, Row[]>();
  for (const mission of missions) {
    const ownerId = mission.properties?.owner_id ?? "unknown";
    const rows: Row[] = missionsByOwner.get(ownerId) ?? [];
    rows.push(mission);
    missionsByOwner.set(ownerId, rows);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-6 text-slate-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href={`/cleaner/${token}/planning`} className="text-sm font-black text-slate-500">
            {c.back}
          </Link>

          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
            {c.title}
          </h1>

          <p className="mt-3 text-lg font-semibold text-slate-600">
            {c.bravo(cleanerFirstName(cleaner))}
          </p>

          <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
            {c.subtitle}
          </p>
        </div>

        {query?.sent === "1" && (
          <section className="rounded-3xl bg-emerald-50 p-5 text-emerald-900 shadow-sm ring-1 ring-emerald-100">
            <h2 className="text-lg font-black">{c.sent}</h2>
            <p className="mt-1 text-sm font-semibold">{c.sentBody}</p>
          </section>
        )}

        <section className="grid grid-cols-4 gap-2">
          <div className="rounded-2xl bg-emerald-50 p-3 shadow-sm ring-1 ring-emerald-100">
            <p className="text-[10px] font-black uppercase leading-tight text-emerald-700">{c.earnedToDate}</p>
            <p className="mt-2 text-lg font-black text-emerald-950 sm:text-2xl">{money(totalEarned)}</p>
          </div>

          <div className="rounded-2xl bg-sky-50 p-3 shadow-sm ring-1 ring-sky-100">
            <p className="text-[10px] font-black uppercase leading-tight text-sky-700">{c.thisMonth}</p>
            <p className="mt-2 text-lg font-black text-sky-950 sm:text-2xl">{money(currentMonthEarned)}</p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-3 shadow-sm ring-1 ring-amber-100">
            <p className="text-[10px] font-black uppercase leading-tight text-amber-700">{c.requestNow}</p>
            <p className="mt-2 text-lg font-black text-amber-950 sm:text-2xl">{money(requestableTotal)}</p>
          </div>

          <div className="rounded-2xl bg-violet-50 p-3 shadow-sm ring-1 ring-violet-100">
            <p className="text-[10px] font-black uppercase leading-tight text-violet-700">{c.pendingPayment}</p>
            <p className="mt-2 text-lg font-black text-violet-950 sm:text-2xl">{money(waitingPayment)}</p>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-black">{c.requestableTitle}</h2>
          </div>

          {requestable.length === 0 ? (
            <div className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
              {c.requestableEmpty}
            </div>
          ) : (
            <div className="space-y-4">
              {requestable.map((group) => {
                const owner = ownersById.get(group.ownerId);
                const name = ownerName(owner, locale);
                const total = group.missions.reduce(
                  (sum, mission) => sum + Number(mission.total_cost_eur ?? 0),
                  0,
                );

                return (
                  <details
                    key={`${group.ownerId}:${group.period}`}
                    name="payment-request"
                    className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 open:ring-slate-300"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-start gap-4">
                        <OwnerAvatar name={name} photoUrl={ownerPhotoById.get(group.ownerId)} />

                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-black">{name}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {c.requestCard(money(total), name, monthLabel(group.period, locale))}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-black uppercase text-slate-400">Total</p>
                          <p className="text-2xl font-black">{money(total)}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white">
                        {c.prepare}
                      </div>
                    </summary>

                    <form action={sendMonthlyPaymentRequest} className="mt-5 space-y-4">
                      <input type="hidden" name="cleaner_token" value={token} />
                      <input type="hidden" name="owner_id" value={group.ownerId} />
                      <input type="hidden" name="period" value={group.period} />

                      <section className="rounded-3xl bg-slate-50 p-4">
                        <h4 className="text-sm font-black uppercase text-slate-400">
                          {c.lineItems}
                        </h4>

                        <div className="mt-3 space-y-2">
                          {group.missions.map((mission) => (
                            <div
                              key={mission.id}
                              className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"
                            >
                              <div className="flex justify-between gap-3">
                                <div>
                                  <p className="font-black">
                                    {dateLabel(paymentDateValue(mission), locale)} · {missionChecklistName(mission, locale)}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-slate-500">
                                    {mission.properties?.name ?? c.missionFallback}
                                  </p>
                                </div>

                                <p className="font-black">{money(mission.total_cost_eur)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-100">
                        <h4 className="text-sm font-black text-amber-950">{c.exceptionalCost}</h4>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px]">
                          <input
                            name="extra_description"
                            placeholder={c.exceptionalPlaceholder}
                            className="rounded-2xl border border-amber-200 bg-white px-3 py-3 text-sm font-semibold"
                          />
                          <input
                            name="extra_amount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={c.amount}
                            className="rounded-2xl border border-amber-200 bg-white px-3 py-3 text-sm font-semibold"
                          />
                        </div>
                      </section>

                      <label className="block">
                        <span className="text-sm font-black text-slate-700">
                          {c.messageOwner}
                        </span>
                        <textarea
                          name="cleaner_message"
                          rows={3}
                          placeholder={c.messagePlaceholder}
                          className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm"
                        />
                      </label>

                      <button className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-base font-black text-white">
                        {c.sendRequest}
                      </button>
                    </form>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-black">{c.history}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{c.historyIntro}</p>
          </div>

          {missionsByOwner.size === 0 ? (
            <div className="rounded-3xl bg-white p-5 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
              {c.noHistory}
            </div>
          ) : (
            <div className="space-y-3">
              {[...missionsByOwner.entries()].map(([ownerId, rows]) => {
                const owner = ownersById.get(ownerId);
                const name = ownerName(owner, locale);
                const sortedRows = [...rows].sort((a, b) =>
                  paymentDateKey(b).localeCompare(paymentDateKey(a)),
                );

                return (
                  <details
                    key={ownerId}
                    className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-4">
                      <OwnerAvatar name={name} photoUrl={ownerPhotoById.get(ownerId)} />
                      <div className="flex-1">
                        <h3 className="text-xl font-black">{name}</h3>
                        <p className="text-sm font-semibold text-slate-500">
                          {sortedRows.length} mission(s)
                        </p>
                      </div>
                      <span className="text-xl">↓</span>
                    </summary>

                    <div className="mt-4 space-y-2">
                      {sortedRows.map((mission) => {
                        const line = lineByMissionId.get(String(mission.id));
                        const request = line ? paymentRequestById.get(line.monthly_payment_request_id) : null;
                        const workKey = paymentDateKey(mission);
                        const statusText = request
                          ? requestStatusLabel(request.status, locale)
                          : workKey >= currentMonthStart
                            ? c.currentMonthNotReady
                            : c.notRequested;

                        return (
                          <div key={mission.id} className="rounded-2xl bg-slate-50 p-3">
                            <div className="flex justify-between gap-3">
                              <div>
                                <p className="font-black">
                                  {dateLabel(paymentDateValue(mission), locale)} · {missionChecklistName(mission, locale)}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-500">
                                  {mission.properties?.name ?? c.missionFallback}
                                </p>
                                <p className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                                  {statusText}
                                </p>
                              </div>

                              <p className="font-black">{money(mission.total_cost_eur)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <CleanerBottomNav cleanerToken={token} active="payments" locale={locale} />
    </main>
  );
}
