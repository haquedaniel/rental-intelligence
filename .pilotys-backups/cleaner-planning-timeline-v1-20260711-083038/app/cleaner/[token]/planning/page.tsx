import Link from "next/link";
import { notFound } from "next/navigation";

import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCleanerLocale, intlLocale, t, type CleanerLocale } from "@/lib/cleanerI18n";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

const PARIS_TZ = "Europe/Paris";

const COPY = {
  fr: {
    back: "← Missions",
    title: "Mon planning",
    subtitle: "Vos missions à venir, par logement, avec les séjours en contexte.",
    next14: "14 prochains jours",
    missions: "Missions",
    properties: "Logements",
    hours: "Heures",
    estimated: "Estimé",
    overdueTitle: "À traiter en priorité",
    overdueBody: "Ces missions sont en retard ou attendent votre réponse.",
    calendarTitle: "Calendrier par logement",
    calendarBody: "Faites défiler horizontalement pour voir les prochains mois.",
    nextMission: "Prochaine mission",
    noNextMission: "Aucune mission confirmée à venir.",
    openMission: "Ouvrir la mission",
    upcoming: "À venir par jour",
    noUpcoming: "Aucune mission à venir.",
    stays: "Séjours",
    cleanings: "Missions",
    today: "Aujourd’hui",
    tomorrow: "Demain",
    propertyFallback: "Logement",
    guestFallback: "Séjour",
    checklistFallback: "Ménage",
    before: "Prêt avant",
    duration: "Durée",
    amount: "Montant",
    toConfirm: "À confirmer",
    offered: "Proposée",
    confirmed: "Confirmée",
    completed: "Terminée",
    problem: "Problème",
    late: "En retard",
    refused: "Refusée",
  },
  en: {
    back: "← Missions",
    title: "My schedule",
    subtitle: "Your upcoming work by property, with guest stays as context.",
    next14: "Next 14 days",
    missions: "Missions",
    properties: "Properties",
    hours: "Hours",
    estimated: "Estimated",
    overdueTitle: "Deal with these first",
    overdueBody: "These missions are late or still waiting for your reply.",
    calendarTitle: "Calendar by property",
    calendarBody: "Scroll horizontally to see the next few months.",
    nextMission: "Next mission",
    noNextMission: "No confirmed upcoming mission.",
    openMission: "Open mission",
    upcoming: "Upcoming by day",
    noUpcoming: "No upcoming mission.",
    stays: "Stays",
    cleanings: "Missions",
    today: "Today",
    tomorrow: "Tomorrow",
    propertyFallback: "Property",
    guestFallback: "Stay",
    checklistFallback: "Cleaning",
    before: "Ready before",
    duration: "Duration",
    amount: "Amount",
    toConfirm: "To confirm",
    offered: "Offered",
    confirmed: "Confirmed",
    completed: "Completed",
    problem: "Problem",
    late: "Late",
    refused: "Refused",
  },
  ru: {
    back: "← Задания",
    title: "Моё расписание",
    subtitle: "Будущие задания по объектам, с контекстом проживания гостей.",
    next14: "Следующие 14 дней",
    missions: "Задания",
    properties: "Объекты",
    hours: "Часы",
    estimated: "Сумма",
    overdueTitle: "Сначала обработать",
    overdueBody: "Эти задания просрочены или ждут вашего ответа.",
    calendarTitle: "Календарь по объектам",
    calendarBody: "Прокрутите вправо, чтобы увидеть следующие месяцы.",
    nextMission: "Следующее задание",
    noNextMission: "Нет подтверждённых будущих заданий.",
    openMission: "Открыть задание",
    upcoming: "Ближайшие задания",
    noUpcoming: "Нет будущих заданий.",
    stays: "Проживания",
    cleanings: "Задания",
    today: "Сегодня",
    tomorrow: "Завтра",
    propertyFallback: "Объект",
    guestFallback: "Проживание",
    checklistFallback: "Уборка",
    before: "Готово до",
    duration: "Длительность",
    amount: "Сумма",
    toConfirm: "Подтвердить",
    offered: "Предложено",
    confirmed: "Подтверждено",
    completed: "Завершено",
    problem: "Проблема",
    late: "Просрочено",
    refused: "Отказано",
  },
} as const;

function c(locale: CleanerLocale) {
  if (locale === "en" || locale === "ru") return COPY[locale];
  return COPY.fr;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parisDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shortDay(dateKey: string, locale: CleanerLocale): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: PARIS_TZ,
    weekday: "short",
    day: "2-digit",
  })
    .format(date)
    .replace(".", "");
}

function fullDateLabel(value?: string | null, locale: CleanerLocale = "fr"): string {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: PARIS_TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(":", "h");
}

function compactDateLabel(value?: string | null, locale: CleanerLocale = "fr"): string {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: PARIS_TZ,
    day: "2-digit",
    month: "short",
  }).format(date);
}

function money(value: unknown): string {
  return `${Number(value ?? 0).toFixed(0)} €`;
}

function propertyName(property: Row | null | undefined, locale: CleanerLocale): string {
  return property?.name || c(locale).propertyFallback;
}

function guestName(reservation: Row | null | undefined, locale: CleanerLocale): string {
  return reservation?.guest_name || reservation?.source_booking_id || c(locale).guestFallback;
}

function anchorAt(request: Row): string | null {
  return (
    request.ready_by_at ||
    request.completion_deadline_at ||
    request.work_window_end_at ||
    request.scheduled_end_at ||
    request.scheduled_start_at ||
    null
  );
}

function isDone(request: Row): boolean {
  return ["completed", "report_submitted", "problem_reported"].includes(String(request.status));
}

function isOverdue(request: Row, hasReport = false): boolean {
  if (hasReport) return false;
  if (request.status !== "accepted") return false;

  const anchor = parseDate(anchorAt(request));
  if (!anchor) return false;

  return anchor.getTime() < Date.now();
}

function missionAmount(request: Row): number {
  return Number(request.total_cost_eur ?? request.cleaning_cost_eur ?? request.amount_eur ?? 0);
}

function isIntervention(request: Row): boolean {
  return request.mission_type === "intervention";
}

function missionHref(request: Row): string {
  if (!request.public_token) return "#";

  if (isIntervention(request)) {
    return `/mission/${request.public_token}/intervention`;
  }

  if (["created", "sent"].includes(String(request.status))) {
    return `/mission/${request.public_token}/ready-day`;
  }

  return `/mission/${request.public_token}/report`;
}


function briefingHref(request: Row | null | undefined): string | null {
  if (!request?.public_token) return null;
  return `/mission/${request.public_token}/reservation`;
}

function briefingLabel(locale: CleanerLocale): string {
  if (locale === "en") return "Stay briefing";
  if (locale === "ru") return "Информация о проживании";
  return "Briefing séjour";
}

function missionTitle(request: Row, locale: CleanerLocale): string {
  if (isIntervention(request)) {
    return request.title || "Intervention ponctuelle";
  }

  return request.title || c(locale).checklistFallback;
}

function statusLabel(request: Row, overdue: boolean, locale: CleanerLocale): string {
  const copy = c(locale);

  if (overdue) return copy.late;

  switch (request.status) {
    case "created":
      return copy.toConfirm;
    case "sent":
      return copy.offered;
    case "accepted":
      return copy.confirmed;
    case "report_submitted":
    case "completed":
      return copy.completed;
    case "problem_reported":
      return copy.problem;
    case "refused":
      return copy.refused;
    default:
      return String(request.status || copy.missions);
  }
}

function statusChipClass(request: Row, overdue: boolean): string {
  if (overdue) return "bg-red-100 text-red-800 ring-red-200";

  switch (request.status) {
    case "created":
    case "sent":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "accepted":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "report_submitted":
    case "completed":
      return "bg-slate-100 text-[#112532]/76 ring-[#112532]/10";
    case "problem_reported":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    default:
      return "bg-slate-100 text-[#112532]/76 ring-[#112532]/10";
  }
}

function calendarMissionClass(request: Row, overdue: boolean): string {
  if (overdue) return "bg-red-100 text-red-900 ring-red-200";

  if (isIntervention(request)) {
    return "bg-violet-100 text-violet-950 ring-violet-200";
  }

  switch (request.status) {
    case "created":
    case "sent":
      return "bg-amber-100 text-amber-950 ring-amber-200";
    case "accepted":
      return "bg-emerald-100 text-emerald-950 ring-emerald-200";
    case "report_submitted":
    case "completed":
      return "bg-slate-100 text-[#112532]/76 ring-[#112532]/10";
    case "problem_reported":
      return "bg-orange-100 text-orange-950 ring-orange-200";
    default:
      return "bg-slate-100 text-[#112532]/76 ring-[#112532]/10";
  }
}

const PROPERTY_PALETTE = [
  {
    label: "border-slate-300 bg-[#F6F3EF]",
    stay: "bg-slate-200 text-[#112532]/86",
  },
  {
    label: "border-emerald-300 bg-[#ECFFF6]",
    stay: "bg-emerald-100 text-emerald-900",
  },
  {
    label: "border-sky-300 bg-sky-50",
    stay: "bg-sky-100 text-sky-900",
  },
  {
    label: "border-amber-300 bg-[#FFF5DD]",
    stay: "bg-amber-100 text-amber-900",
  },
  {
    label: "border-violet-300 bg-violet-50",
    stay: "bg-violet-100 text-violet-900",
  },
] as const;

function propertyPalette(index: number) {
  return PROPERTY_PALETTE[index % PROPERTY_PALETTE.length];
}

function spanForCalendar(startKey: string, endExclusiveKey: string, units: string[]) {
  const touched = units
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit }) => startKey <= unit && endExclusiveKey > unit);

  if (touched.length === 0) return null;

  const first = touched[0].index;
  const last = touched[touched.length - 1].index;

  return { start: first + 1, span: last - first + 1 };
}

function dayHeading(dateKey: string, today: string, locale: CleanerLocale): string {
  const copy = c(locale);
  if (dateKey === today) return copy.today;
  if (dateKey === addDays(today, 1)) return copy.tomorrow;

  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: PARIS_TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function KpiCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl p-3 shadow-sm ring-1 ${className}`}>
      <p className="text-[10px] font-black uppercase leading-tight opacity-70">{label}</p>
      <p className="mt-2 text-lg font-black sm:text-2xl">{value}</p>
    </div>
  );
}

function MissionCompactCard({
  request,
  property,
  reservation,
  locale,
}: {
  request: Row;
  property?: Row | null;
  reservation?: Row | null;
  locale: CleanerLocale;
}) {
  const overdue = isOverdue(request, false);
  const copy = c(locale);
  const intervention = isIntervention(request);
  const title = intervention ? missionTitle(request, locale) : propertyName(property, locale);
  const subtitle = intervention
    ? propertyName(property, locale)
    : `${missionTitle(request, locale)} · ${guestName(reservation, locale)}`;

  const cardClassName = [
    "block min-w-0 rounded-[1.35rem] p-4 shadow-sm ring-1",
    intervention
      ? "bg-violet-50/80 ring-violet-100"
      : "bg-white ring-[#112532]/10",
  ].join(" ");

  const briefing = briefingHref(request);

  return (
    <div className={cardClassName}>
      <Link href={missionHref(request)} className="block">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1 ${statusChipClass(request, overdue)}`}>
              {statusLabel(request, overdue, locale)}
            </span>

            <h3 className="mt-3 truncate text-base font-black text-[#112532]">
              {title}
            </h3>

            <p className="mt-1 truncate text-sm font-semibold text-[#112532]/48">
              {subtitle}
            </p>
          </div>

          <div className="rounded-2xl bg-[#F6F3EF] px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase text-[#112532]/36">{copy.before}</p>
            <p className="mt-1 text-xs font-black text-[#112532]">
              {compactDateLabel(anchorAt(request), locale)}
            </p>
          </div>
        </div>
      </Link>

      {briefing ? (
        <Link href={briefing} className="mt-3 inline-flex rounded-full bg-[#112532] px-3 py-2 text-xs font-black text-white">
          {briefingLabel(locale)} →
        </Link>
      ) : null}
    </div>
  );
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

function calendarMissionIcon(request: Row, overdue: boolean): string {
  if (overdue) return "!";
  if (request.status === "accepted") return "✓";
  if (request.status === "report_submitted" || request.status === "completed") return "✓";
  if (request.status === "problem_reported") return "?";
  if (request.status === "refused") return "×";
  return "!";
}

function PropertyCalendar({
  properties,
  reservations,
  requests,
  reservationsById,
  locale,
}: {
  properties: Row[];
  reservations: Row[];
  requests: Row[];
  reservationsById: Record<string, Row>;
  locale: CleanerLocale;
}) {
  const copy = c(locale);
  const today = parisDateKey(new Date());
  const units = Array.from({ length: 90 }, (_, index) => addDays(today, index));
  const dayWidth = 48;
  const timelineWidth = units.length * dayWidth;

  const monthBlocks: Array<{ key: string; label: string; left: number; width: number }> = [];
  for (const dateKey of units) {
    const monthKey = dateKey.slice(0, 7);
    const existing = monthBlocks.find((block) => block.key === monthKey);

    if (existing) {
      existing.width += dayWidth;
    } else {
      const monthDate = new Date(`${monthKey}-01T12:00:00.000Z`);
      monthBlocks.push({
        key: monthKey,
        label: new Intl.DateTimeFormat(intlLocale(locale), {
          month: "short",
          year: "numeric",
        }).format(monthDate),
        left: units.indexOf(dateKey) * dayWidth,
        width: dayWidth,
      });
    }
  }

  function indexFor(dateKey: string) {
    return units.indexOf(dateKey);
  }

  function lanePosition(startKey: string, endExclusiveKey: string) {
    const firstVisible = units.findIndex((unit) => endExclusiveKey > unit && startKey <= unit);
    if (firstVisible < 0) return null;

    let lastVisible = firstVisible;
    for (let index = firstVisible; index < units.length; index += 1) {
      if (endExclusiveKey > units[index] && startKey <= units[index]) {
        lastVisible = index;
      }
    }

    return {
      left: firstVisible * dayWidth + 4,
      width: Math.max((lastVisible - firstVisible + 1) * dayWidth - 8, 32),
    };
  }

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-[#112532]/10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#112532]">{copy.calendarTitle}</h2>
          <p className="mt-1 text-sm font-semibold text-[#112532]/48">{copy.calendarBody}</p>
        </div>

        <div className="flex gap-2 text-[10px] font-black">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[#112532]/62">{copy.stays}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">{copy.cleanings}</span>
        </div>
      </div>

      <div className="mt-4 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl bg-[#F6F3EF] pb-3">
        <div className="min-w-max max-w-none">
          <div className="grid grid-cols-[112px_1fr] border-b border-[#112532]/10 bg-white">
            <div className="sticky left-0 z-30 bg-white px-3 py-3 text-[10px] font-black uppercase text-[#112532]/36">
              {copy.properties}
            </div>

            <div className="relative h-[82px]" style={{ width: timelineWidth }}>
              <div className="absolute left-0 top-0 h-[24px]">
                {monthBlocks.map((block) => (
                  <div
                    key={block.key}
                    className="absolute top-0 h-[24px] border-l border-[#112532]/10 px-2 text-left text-[10px] font-black uppercase text-[#112532]/36"
                    style={{ left: block.left, width: block.width }}
                  >
                    {block.label}
                  </div>
                ))}
              </div>

              <div className="absolute bottom-0 left-0 flex h-[58px]">
                {units.map((dateKey) => {
                  const isToday = dateKey === today;

                  return (
                    <div
                      key={dateKey}
                      className={`flex-none border-l px-1 py-2 text-center ${
                        isToday ? "bg-slate-100" : "border-slate-100"
                      }`}
                      style={{ width: dayWidth }}
                    >
                      <p className="text-[8px] font-black uppercase text-[#112532]/36">
                        {shortDay(dateKey, locale).slice(0, 3)}
                      </p>
                      <p className="mt-1 text-[12px] font-black text-[#112532]">
                        {dateKey.slice(8, 10)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {properties.map((property, propertyIndex) => {
              const palette = propertyPalette(propertyIndex);
              const propertyId = String(property.id);

              const propertyReservations = reservations.filter(
                (reservation) => String(reservation.property_id) === propertyId,
              );

              const propertyRequests = requests.filter(
                (request) => String(request.property_id) === propertyId,
              );

              return (
                <div key={propertyId} className="grid grid-cols-[112px_1fr] bg-white">
                  <div className="sticky left-0 z-20 border-r border-slate-100 bg-white p-3">
                    <div className={`rounded-2xl border-l-4 px-3 py-3 ${palette.label}`}>
                      <p className="line-clamp-3 text-xs font-black text-[#112532]">
                        {propertyName(property, locale)}
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-[#112532]/48">
                        {propertyRequests.length} mission(s)
                      </p>
                    </div>
                  </div>

                  <div className="relative h-[112px] bg-white" style={{ width: timelineWidth }}>
                    <div className="absolute inset-0 flex">
                      {units.map((dateKey) => {
                        const isToday = dateKey === today;

                        return (
                          <div
                            key={`${propertyId}-${dateKey}-bg`}
                            className={`flex-none border-l ${
                              isToday ? "bg-slate-100/70" : "border-slate-100 bg-[#F6F3EF]/60"
                            }`}
                            style={{ width: dayWidth }}
                          />
                        );
                      })}
                    </div>

                    <div className="absolute left-0 right-0 top-4 h-[30px]">
                      {propertyReservations.map((reservation) => {
                        if (!reservation.checkin_at || !reservation.checkout_at) return null;

                        const checkin = parisDateKey(new Date(reservation.checkin_at));
                        const checkout = parisDateKey(new Date(reservation.checkout_at));
                        const pos = lanePosition(checkin, checkout);
                        if (!pos) return null;

                        const linkedRequest = propertyRequests.find(
                          (request) => String(request.reservation_id) === String(reservation.id) && request.public_token,
                        );
                        const briefing = briefingHref(linkedRequest);

                        if (briefing) {
                          return (
                            <Link
                              key={reservation.id}
                              href={briefing}
                              className={`absolute top-0 h-[28px] overflow-hidden rounded-full px-3 py-1 text-[10px] font-black shadow-sm ${palette.stay}`}
                              style={{ left: pos.left, width: pos.width }}
                              title={`${guestName(reservation, locale)} · ${briefingLabel(locale)}`}
                            >
                              <p className="truncate">{guestName(reservation, locale)}</p>
                            </Link>
                          );
                        }

                        return (
                          <div
                            key={reservation.id}
                            className={`absolute top-0 h-[28px] overflow-hidden rounded-full px-3 py-1 text-[10px] font-black shadow-sm ${palette.stay}`}
                            style={{ left: pos.left, width: pos.width }}
                            title={`${guestName(reservation, locale)} · ${propertyName(property, locale)}`}
                          >
                            <p className="truncate">{guestName(reservation, locale)}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="absolute left-0 right-0 bottom-4 h-[36px]">
                      {propertyRequests.map((request) => {
                        const anchor = parseDate(anchorAt(request));
                        if (!anchor) return null;

                        const key = parisDateKey(anchor);
                        const index = indexFor(key);
                        if (index < 0) return null;

                        const overdue = isOverdue(request, false);
                        const icon = calendarMissionIcon(request, overdue);

                        return (
                          <Link
                            key={request.id}
                            href={missionHref(request)}
                            className={`absolute top-0 flex h-[34px] items-center justify-center rounded-full text-base font-black ring-1 shadow-sm ${calendarMissionClass(request, overdue)}`}
                            style={{
                              left: index * dayWidth + 7,
                              width: 34,
                            }}
                            title={`${propertyName(property, locale)} · ${statusLabel(request, overdue, locale)} · ${fullDateLabel(anchorAt(request), locale)}`}
                          >
                            {icon}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function CleanerPlanningPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!cleaner) notFound();

  const locale = getCleanerLocale(cleaner.preferred_language);
  const copy = c(locale);

  const today = parisDateKey(new Date());
  const horizonEnd = addDays(today, 89);
  const twoWeekEnd = addDays(today, 13);

  const { data: requestRows } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("assigned_cleaner_id", cleaner.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(200);

  const allRequests = (requestRows ?? []) as Row[];

  const relevantRequests = allRequests.filter((request) => {
    const anchor = parseDate(anchorAt(request));
    if (!anchor) return false;

    const key = parisDateKey(anchor);

    return (
      (key >= today && key <= horizonEnd) ||
      isOverdue(request, false) ||
      ["created", "sent"].includes(String(request.status))
    );
  });

  const propertyIds = [
    ...new Set(relevantRequests.map((request) => request.property_id).filter(Boolean)),
  ];
  const reservationIds = [
    ...new Set(relevantRequests.map((request) => request.reservation_id).filter(Boolean)),
  ];

  const calendarStart = new Date(`${today}T00:00:00.000Z`);
  const calendarEnd = new Date(`${horizonEnd}T23:59:59.000Z`);

  const [propertiesResult, reservationsResult, calendarReservationsResult] = await Promise.all([
    propertyIds.length
      ? supabase.from("properties").select("*").in("id", propertyIds)
      : Promise.resolve({ data: [] }),
    reservationIds.length
      ? supabase.from("reservations").select("*").in("id", reservationIds)
      : Promise.resolve({ data: [] }),
    propertyIds.length
      ? supabase
          .from("reservations")
          .select("*")
          .in("property_id", propertyIds)
          .gte("checkout_at", calendarStart.toISOString())
          .lte("checkin_at", calendarEnd.toISOString())
          .order("checkin_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const properties = ((propertiesResult.data ?? []) as Row[]).sort((a, b) =>
    propertyName(a, locale).localeCompare(propertyName(b, locale), intlLocale(locale)),
  );

  const propertiesById = Object.fromEntries(
    properties.map((property) => [String(property.id), property]),
  );

  const reservationsById = Object.fromEntries(
    ((reservationsResult.data ?? []) as Row[]).map((reservation) => [String(reservation.id), reservation]),
  );

  const cancelledReservationIds = new Set(
    ((reservationsResult.data ?? []) as Row[])
      .filter(isReservationCancelled)
      .map((reservation) => String(reservation.id)),
  );

  const visibleRequests = relevantRequests.filter((request) => {
    if (!request.reservation_id) return true;
    return !cancelledReservationIds.has(String(request.reservation_id));
  });

  const visibleCalendarReservations = ((calendarReservationsResult.data ?? []) as Row[]).filter(
    (reservation) => !isReservationCancelled(reservation),
  );

  const displayPropertyIds = new Set([
    ...visibleRequests.map((request) => String(request.property_id)).filter(Boolean),
    ...visibleCalendarReservations.map((reservation) => String(reservation.property_id)).filter(Boolean),
  ]);

  const displayProperties = properties.filter((property) =>
    displayPropertyIds.has(String(property.id)),
  );

  const overdue = visibleRequests.filter((request) => isOverdue(request, false));
  const toConfirm = visibleRequests.filter((request) => ["created", "sent"].includes(String(request.status)));

  const twoWeekRequests = visibleRequests.filter((request) => {
    if (isDone(request)) return false;
    const anchor = parseDate(anchorAt(request));
    if (!anchor) return false;
    const key = parisDateKey(anchor);
    return key >= today && key <= twoWeekEnd;
  });

  const twoWeekProperties = new Set(twoWeekRequests.map((request) => String(request.property_id)));
  const twoWeekHours = twoWeekRequests.reduce((sum, request) => sum + Number(request.estimated_hours ?? 0), 0);
  const twoWeekEarnings = twoWeekRequests.reduce((sum, request) => sum + missionAmount(request), 0);

  const nextMission = [...visibleRequests]
    .filter((request) => request.status === "accepted" && !isDone(request) && !isOverdue(request, false))
    .sort((a, b) => {
      const at = parseDate(anchorAt(a))?.getTime() ?? 0;
      const bt = parseDate(anchorAt(b))?.getTime() ?? 0;
      return at - bt;
    })[0];

  const upcoming = [...visibleRequests]
    .filter((request) => {
      if (isDone(request)) return false;
      const anchor = parseDate(anchorAt(request));
      if (!anchor) return false;
      return parisDateKey(anchor) >= today;
    })
    .sort((a, b) => {
      const at = parseDate(anchorAt(a))?.getTime() ?? 0;
      const bt = parseDate(anchorAt(b))?.getTime() ?? 0;
      return at - bt;
    });

  const groupedUpcoming = new Map<string, Row[]>();
  for (const request of upcoming) {
    const anchor = parseDate(anchorAt(request));
    if (!anchor) continue;

    const key = parisDateKey(anchor);
    const rows = groupedUpcoming.get(key) ?? [];
    rows.push(request);
    groupedUpcoming.set(key, rows);
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#F6F3EF] px-4 pb-28 pt-6 text-[#112532]">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6">
        <div>
          <Link href={`/cleaner/${token}`} className="text-sm font-black text-[#112532]/48">
            {copy.back}
          </Link>

          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
            {copy.title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold text-[#112532]/48">
            {copy.subtitle}
          </p>
        </div>

        <section className="grid min-w-0 grid-cols-4 gap-2">
          <KpiCard
            label={copy.missions}
            value={String(twoWeekRequests.length)}
            className="bg-[#ECFFF6] text-emerald-950 ring-emerald-100"
          />
          <KpiCard
            label={copy.properties}
            value={String(twoWeekProperties.size)}
            className="bg-sky-50 text-sky-950 ring-sky-100"
          />
          <KpiCard
            label={copy.hours}
            value={`${String(Math.round(twoWeekHours * 10) / 10).replace(".", ",")} h`}
            className="bg-[#FFF5DD] text-amber-950 ring-amber-100"
          />
          <KpiCard
            label={copy.estimated}
            value={money(twoWeekEarnings)}
            className="bg-violet-50 text-violet-950 ring-violet-100"
          />
        </section>

        {(overdue.length > 0 || toConfirm.length > 0) && (
          <section className="rounded-[2rem] bg-[#FFF5DD] p-5 shadow-sm ring-1 ring-amber-100">
            <h2 className="text-lg font-black text-amber-950">{copy.overdueTitle}</h2>
            <p className="mt-1 text-sm font-semibold text-amber-800/80">{copy.overdueBody}</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[...overdue, ...toConfirm].slice(0, 4).map((request) => (
                <MissionCompactCard
                  key={request.id}
                  request={request}
                  property={propertiesById[String(request.property_id)]}
                  reservation={reservationsById[String(request.reservation_id)]}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        )}

        <PropertyCalendar
          properties={displayProperties}
          reservations={visibleCalendarReservations}
          requests={visibleRequests}
          reservationsById={reservationsById}
          locale={locale}
        />

        <section className="grid min-w-0 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="min-w-0 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/10">
            <h2 className="text-xl font-black text-[#112532]">{copy.nextMission}</h2>

            {!nextMission ? (
              <p className="mt-4 rounded-2xl bg-[#F6F3EF] p-4 text-sm font-bold text-[#112532]/48">
                {copy.noNextMission}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <MissionCompactCard
                  request={nextMission}
                  property={propertiesById[String(nextMission.property_id)]}
                  reservation={reservationsById[String(nextMission.reservation_id)]}
                  locale={locale}
                />

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-[#F6F3EF] p-3">
                    <p className="text-[10px] font-black uppercase text-[#112532]/36">{copy.before}</p>
                    <p className="mt-1 text-xs font-black">{compactDateLabel(anchorAt(nextMission), locale)}</p>
                  </div>
                  <div className="rounded-2xl bg-[#F6F3EF] p-3">
                    <p className="text-[10px] font-black uppercase text-[#112532]/36">{copy.duration}</p>
                    <p className="mt-1 text-xs font-black">{nextMission.estimated_hours ?? "—"} h</p>
                  </div>
                  <div className="rounded-2xl bg-[#F6F3EF] p-3">
                    <p className="text-[10px] font-black uppercase text-[#112532]/36">{copy.amount}</p>
                    <p className="mt-1 text-xs font-black">{money(missionAmount(nextMission))}</p>
                  </div>
                </div>

                <Link
                  href={missionHref(nextMission)}
                  className="block rounded-2xl bg-[#112532] px-4 py-3 text-center text-sm font-black text-white"
                >
                  {copy.openMission}
                </Link>
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/10">
            <h2 className="text-xl font-black text-[#112532]">{copy.upcoming}</h2>

            {groupedUpcoming.size === 0 ? (
              <p className="mt-4 rounded-2xl bg-[#F6F3EF] p-4 text-sm font-bold text-[#112532]/48">
                {copy.noUpcoming}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {[...groupedUpcoming.entries()].map(([dateKey, rows]) => (
                  <div key={dateKey}>
                    <h3 className="text-sm font-black text-[#112532]/48">
                      {dayHeading(dateKey, today, locale)}
                    </h3>

                    <div className="mt-2 space-y-2">
                      {rows.map((request) => (
                        <MissionCompactCard
                          key={request.id}
                          request={request}
                          property={propertiesById[String(request.property_id)]}
                          reservation={reservationsById[String(request.reservation_id)]}
                          locale={locale}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>

      <CleanerBottomNav cleanerToken={token} active="planning" locale={locale} />
    </main>
  );
}
