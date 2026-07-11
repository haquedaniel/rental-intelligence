import Link from "next/link";
import { notFound } from "next/navigation";

import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCleanerLocale, intlLocale, type CleanerLocale } from "@/lib/cleanerI18n";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

const PARIS_TZ = "Europe/Paris";
const DAY_WIDTH = 52;
const HISTORY_DAYS = 7;
const HORIZON_DAYS = 191;

const PROPERTY_PALETTE = [
  {
    key: "orange",
    dot: "bg-[#E0680E]",
    soft: "bg-[#FFF0E6]",
    stay: "bg-[#E0680E] text-white",
    zone: "bg-[#E0680E]/10 ring-[#E0680E]/25",
    line: "border-[#E0680E]/25",
  },
  {
    key: "blue",
    dot: "bg-[#80A5B7]",
    soft: "bg-[#EFF6F8]",
    stay: "bg-[#80A5B7] text-[#112532]",
    zone: "bg-[#80A5B7]/14 ring-[#80A5B7]/25",
    line: "border-[#80A5B7]/25",
  },
  {
    key: "mustard",
    dot: "bg-[#F4B044]",
    soft: "bg-[#FFF5DD]",
    stay: "bg-[#F4B044] text-[#112532]",
    zone: "bg-[#F4B044]/18 ring-[#F4B044]/30",
    line: "border-[#F4B044]/30",
  },
  {
    key: "navy",
    dot: "bg-[#112532]",
    soft: "bg-[#EEF1F2]",
    stay: "bg-[#112532] text-white",
    zone: "bg-[#112532]/8 ring-[#112532]/16",
    line: "border-[#112532]/14",
  },
  {
    key: "green",
    dot: "bg-[#0B6B53]",
    soft: "bg-[#ECFFF6]",
    stay: "bg-[#0B6B53] text-white",
    zone: "bg-[#0B6B53]/10 ring-[#0B6B53]/20",
    line: "border-[#0B6B53]/20",
  },
] as const;

const COPY = {
  fr: {
    back: "← Missions",
    title: "Mon planning",
    subtitle: "Votre calendrier de travail sur 6 mois : séjours, fenêtres possibles, missions proposées et missions confirmées.",
    next14: "14 prochains jours",
    missions: "Missions",
    properties: "Logements",
    hours: "Heures",
    estimated: "Estimé",
    overdueTitle: "À traiter en priorité",
    overdueBody: "Ces missions sont en retard ou attendent votre réponse.",
    calendarTitle: "Planning 6 mois",
    calendarBody: "Touchez une mission pour l’ouvrir. Touchez une zone proposée pour choisir votre jour d’intervention.",
    nextMission: "Prochaine mission",
    noNextMission: "Aucune mission confirmée à venir.",
    openMission: "Ouvrir la mission",
    upcoming: "À venir par jour",
    noUpcoming: "Aucune mission à venir.",
    stays: "Séjours",
    missionsLayer: "Missions / interventions",
    proposedWindow: "Fenêtre possible",
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
    otherCleaner: "Autre intervenant",
    mine: "Mes missions",
    chooseDay: "Choisir",
    briefing: "Briefing séjour",
  },
  en: {
    back: "← Missions",
    title: "My schedule",
    subtitle: "Your 6-month work calendar: stays, possible windows, proposed missions and confirmed work.",
    next14: "Next 14 days",
    missions: "Missions",
    properties: "Properties",
    hours: "Hours",
    estimated: "Estimated",
    overdueTitle: "Deal with these first",
    overdueBody: "These missions are late or still waiting for your reply.",
    calendarTitle: "6-month schedule",
    calendarBody: "Tap a mission to open it. Tap a proposed window to choose your intervention day.",
    nextMission: "Next mission",
    noNextMission: "No confirmed upcoming mission.",
    openMission: "Open mission",
    upcoming: "Upcoming by day",
    noUpcoming: "No upcoming mission.",
    stays: "Stays",
    missionsLayer: "Missions / interventions",
    proposedWindow: "Possible window",
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
    otherCleaner: "Other cleaner",
    mine: "My missions",
    chooseDay: "Choose",
    briefing: "Stay briefing",
  },
  ru: {
    back: "← Задания",
    title: "Моё расписание",
    subtitle: "Календарь работы на 6 месяцев: проживания, возможные окна, предложенные и подтверждённые задания.",
    next14: "Следующие 14 дней",
    missions: "Задания",
    properties: "Объекты",
    hours: "Часы",
    estimated: "Сумма",
    overdueTitle: "Сначала обработать",
    overdueBody: "Эти задания просрочены или ждут вашего ответа.",
    calendarTitle: "План на 6 месяцев",
    calendarBody: "Нажмите на задание, чтобы открыть. Нажмите на предложенное окно, чтобы выбрать день.",
    nextMission: "Следующее задание",
    noNextMission: "Нет подтверждённых будущих заданий.",
    openMission: "Открыть задание",
    upcoming: "Ближайшие задания",
    noUpcoming: "Нет будущих заданий.",
    stays: "Проживания",
    missionsLayer: "Задания / работы",
    proposedWindow: "Возможное окно",
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
    otherCleaner: "Другой исполнитель",
    mine: "Мои задания",
    chooseDay: "Выбрать",
    briefing: "Информация о проживании",
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

function daysBetween(startKey: string, endKey: string): number {
  const start = new Date(`${startKey}T12:00:00.000Z`).getTime();
  const end = new Date(`${endKey}T12:00:00.000Z`).getTime();
  return Math.round((end - start) / 86400000);
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

function cleanerName(cleaner: Row | null | undefined, fallback: string): string {
  return cleaner?.display_name || cleaner?.name || cleaner?.full_name || cleaner?.first_name || fallback;
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

function windowStartAt(request: Row, reservation?: Row | null): string | null {
  return (
    request.work_window_start_at ||
    request.scheduled_start_at ||
    reservation?.checkout_at ||
    request.created_at ||
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
      return "bg-[#FFF5DD] text-[#8A4D00] ring-[#F4B044]/30";
    case "accepted":
      return "bg-[#ECFFF6] text-[#0B6B53] ring-[#0B6B53]/20";
    case "report_submitted":
    case "completed":
      return "bg-[#EFF6F8] text-[#112532]/70 ring-[#80A5B7]/20";
    case "problem_reported":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    default:
      return "bg-[#112532]/6 text-[#112532]/70 ring-[#112532]/10";
  }
}

function propertyPalette(index: number) {
  return PROPERTY_PALETTE[index % PROPERTY_PALETTE.length];
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

function linkedReservationId(request: Row): string | null {
  return request.prepares_reservation_id || request.reservation_id || null;
}

function linkedRequestForReservation(requests: Row[], reservation: Row): Row | null {
  return (
    requests.find(
      (request) =>
        request.public_token &&
        (String(request.prepares_reservation_id || "") === String(reservation.id) ||
          String(request.reservation_id || "") === String(reservation.id)),
    ) ?? null
  );
}

function hasProfilePhoto(cleaner?: Row | null): boolean {
  return Boolean(cleaner?.signedPhotoUrl);
}

function cleanerInitial(cleaner?: Row | null, fallback = "?") {
  const name = cleanerName(cleaner, fallback);
  return name.trim().slice(0, 1).toUpperCase() || fallback;
}

function missionOutlineClass(request: Row, overdue: boolean, mine: boolean) {
  if (!mine) return "ring-[#112532]/25 grayscale";
  if (overdue) return "ring-red-500";
  if (isIntervention(request)) return "ring-violet-500";
  switch (request.status) {
    case "created":
    case "sent":
      return "ring-[#F4B044]";
    case "accepted":
      return "ring-[#80A5B7]";
    case "report_submitted":
    case "completed":
      return "ring-[#0B6B53]";
    case "problem_reported":
      return "ring-[#E0680E]";
    default:
      return "ring-[#112532]/20";
  }
}

function missionBubbleFillClass(request: Row, mine: boolean) {
  if (!mine) return "bg-white text-[#112532]/45";
  if (["created", "sent"].includes(String(request.status))) return "bg-white text-[#8A4D00]";
  if (["accepted"].includes(String(request.status))) return "bg-white text-[#112532]";
  if (["report_submitted", "completed"].includes(String(request.status))) return "bg-white text-[#0B6B53]";
  if (request.status === "problem_reported") return "bg-white text-[#E0680E]";
  return "bg-white text-[#112532]";
}

function calendarMissionIcon(request: Row, overdue: boolean): string {
  if (overdue) return "!";
  if (request.status === "accepted") return "✓";
  if (request.status === "report_submitted" || request.status === "completed") return "✓";
  if (request.status === "problem_reported") return "?";
  if (request.status === "refused") return "×";
  return "!";
}

function dateKeyFrom(value?: string | null): string | null {
  const date = parseDate(value);
  return date ? parisDateKey(date) : null;
}

function halfDayReservationPosition({
  startKey,
  endExclusiveKey,
  units,
}: {
  startKey: string;
  endExclusiveKey: string;
  units: string[];
}) {
  const startOffset = daysBetween(units[0], startKey);
  const endOffset = daysBetween(units[0], endExclusiveKey);

  const rawLeft = startOffset * DAY_WIDTH + DAY_WIDTH / 2;
  const rawRight = endOffset * DAY_WIDTH + DAY_WIDTH / 2;

  const left = Math.max(0, rawLeft);
  const right = Math.min(units.length * DAY_WIDTH, rawRight);

  if (right <= 0 || left >= units.length * DAY_WIDTH || right <= left) return null;

  return {
    left: left + 4,
    width: Math.max(right - left - 8, 36),
  };
}

function centerForDateKey(dateKey: string, units: string[]) {
  const index = units.indexOf(dateKey);
  if (index < 0) return null;
  return index * DAY_WIDTH + DAY_WIDTH / 2;
}

function rangePosition(startKey: string, endKey: string, units: string[]) {
  const startOffset = daysBetween(units[0], startKey);
  const endOffset = daysBetween(units[0], endKey);

  const rawLeft = startOffset * DAY_WIDTH;
  const rawRight = (endOffset + 1) * DAY_WIDTH;

  const left = Math.max(0, rawLeft);
  const right = Math.min(units.length * DAY_WIDTH, rawRight);

  if (right <= 0 || left >= units.length * DAY_WIDTH || right <= left) return null;

  return {
    left: left + 5,
    width: Math.max(right - left - 10, 36),
  };
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

            <p className="mt-1 truncate text-sm font-semibold text-[#112532]/52">
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
          {copy.briefing} →
        </Link>
      ) : null}
    </div>
  );
}

async function signedUrl(supabase: any, bucket?: string | null, path?: string | null): Promise<string | null> {
  if (!bucket || !path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

function photoBucket(row: Row | null | undefined) {
  return row?.bucket || row?.photo_bucket || row?.storage_bucket || row?.image_bucket || null;
}

function photoPath(row: Row | null | undefined) {
  return row?.path || row?.photo_path || row?.storage_path || row?.image_path || null;
}

function CleanerAvatar({
  cleaner,
  fallback,
  className = "",
}: {
  cleaner?: Row | null;
  fallback: string;
  className?: string;
}) {
  if (hasProfilePhoto(cleaner)) {
    return (
      <img
        src={cleaner?.signedPhotoUrl}
        alt=""
        className={`h-full w-full rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span className={`grid h-full w-full place-items-center rounded-full bg-[#112532]/8 text-[11px] font-black ${className}`}>
      {cleanerInitial(cleaner, fallback)}
    </span>
  );
}

function PropertyThumb({
  property,
  index,
  locale,
}: {
  property: Row;
  index: number;
  locale: CleanerLocale;
}) {
  const palette = propertyPalette(index);
  const name = propertyName(property, locale);

  return (
    <div className="flex min-w-[8.5rem] items-center gap-2 rounded-2xl bg-white/82 px-2.5 py-2 shadow-sm ring-1 ring-[#112532]/8">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-[#112532]/6">
        {property.signedPhotoUrl ? (
          <img src={property.signedPhotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={`h-full w-full ${palette.soft}`} />
        )}
        <span className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${palette.dot}`} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-[#112532]">{name}</p>
      </div>
    </div>
  );
}

function MissionBubble({
  request,
  mine,
  cleaner,
  overdue,
  locale,
}: {
  request: Row;
  mine: boolean;
  cleaner?: Row | null;
  overdue: boolean;
  locale: CleanerLocale;
}) {
  const showIdentity = ["accepted", "completed", "report_submitted"].includes(String(request.status));
  const title = `${cleanerName(cleaner, mine ? c(locale).mine : c(locale).otherCleaner)} · ${statusLabel(request, overdue, locale)} · ${fullDateLabel(anchorAt(request), locale)}`;

  const classes = [
    "absolute top-0 flex h-10 w-10 items-center justify-center rounded-full text-sm font-black shadow-sm ring-2 transition",
    missionOutlineClass(request, overdue, mine),
    missionBubbleFillClass(request, mine),
    mine ? "hover:scale-105" : "opacity-72",
  ].join(" ");

  const content = showIdentity ? (
    <CleanerAvatar cleaner={cleaner} fallback={mine ? "M" : "?"} />
  ) : (
    <span>{calendarMissionIcon(request, overdue)}</span>
  );

  if (mine && request.public_token) {
    return (
      <Link href={missionHref(request)} className={classes} title={title}>
        {content}
      </Link>
    );
  }

  return (
    <div className={classes} title={title}>
      {content}
    </div>
  );
}

function PropertyPlanningTimeline({
  properties,
  reservations,
  requests,
  cleanersById,
  reservationsById,
  currentCleanerId,
  locale,
}: {
  properties: Row[];
  reservations: Row[];
  requests: Row[];
  cleanersById: Record<string, Row>;
  reservationsById: Record<string, Row>;
  currentCleanerId: string;
  locale: CleanerLocale;
}) {
  const copy = c(locale);
  const today = parisDateKey(new Date());
  const calendarStartKey = addDays(today, -HISTORY_DAYS);
  const todayIndex = HISTORY_DAYS;
  const units = Array.from({ length: HORIZON_DAYS }, (_, index) => addDays(calendarStartKey, index));
  const timelineWidth = units.length * DAY_WIDTH;

  const monthBlocks: Array<{ key: string; label: string; left: number; width: number }> = [];
  units.forEach((dateKey, index) => {
    const monthKey = dateKey.slice(0, 7);
    const existing = monthBlocks.find((block) => block.key === monthKey);

    if (existing) {
      existing.width += DAY_WIDTH;
    } else {
      const monthDate = new Date(`${monthKey}-01T12:00:00.000Z`);
      monthBlocks.push({
        key: monthKey,
        label: new Intl.DateTimeFormat(intlLocale(locale), {
          month: "short",
          year: "numeric",
        }).format(monthDate),
        left: index * DAY_WIDTH,
        width: DAY_WIDTH,
      });
    }
  });

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-[2.25rem] bg-white/94 p-4 shadow-sm ring-1 ring-[#112532]/8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#E0680E]">Pilotys planning</p>
          <h2 className="mt-1 text-2xl font-black text-[#112532]">{copy.calendarTitle}</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[#112532]/52">{copy.calendarBody}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] font-black">
          <span className="rounded-full bg-[#112532] px-2 py-1 text-white">{copy.stays}</span>
          <span className="rounded-full bg-[#FFF5DD] px-2 py-1 text-[#8A4D00] ring-1 ring-[#F4B044]/30">{copy.proposedWindow}</span>
          <span className="rounded-full bg-[#EFF6F8] px-2 py-1 text-[#112532] ring-1 ring-[#80A5B7]/25">{copy.missionsLayer}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {properties.map((property, index) => (
          <PropertyThumb
            key={property.id}
            property={property}
            index={index}
            locale={locale}
          />
        ))}
      </div>

      <div className="mt-3 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-[1.7rem] bg-[#F6F3EF] pb-3" data-cleaner-timeline-scroll data-today-index={todayIndex} data-day-width={DAY_WIDTH}>
        <div className="min-w-max max-w-none">
          <div className="relative h-[82px] border-b border-[#112532]/10 bg-white" style={{ width: timelineWidth }}>
            <div className="absolute left-0 top-0 h-[24px]">
              {monthBlocks.map((block) => (
                <div
                  key={block.key}
                  className="absolute top-0 h-[24px] border-l border-[#112532]/10 px-2 text-left text-[10px] font-black uppercase text-[#112532]/38"
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
                      isToday ? "bg-[#E0680E]/10 border-[#E0680E]/20" : "border-[#112532]/8"
                    }`}
                    style={{ width: DAY_WIDTH }}
                  >
                    <p className="text-[8px] font-black uppercase text-[#112532]/35">
                      {shortDay(dateKey, locale).slice(0, 3)}
                    </p>
                    <p className={`mt-1 text-[12px] font-black ${isToday ? "text-[#E0680E]" : "text-[#112532]"}`}>
                      {dateKey.slice(8, 10)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="divide-y divide-[#112532]/10">
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
                <div key={propertyId} className="relative bg-white" style={{ width: timelineWidth }}>
                  <div className={`absolute left-0 top-0 z-20 h-full w-1.5 ${palette.dot}`} />

                  <div className="relative h-[136px]" style={{ width: timelineWidth }}>
                    <div className="absolute inset-0 flex">
                      {units.map((dateKey) => {
                        const isToday = dateKey === today;

                        return (
                          <div
                            key={`${propertyId}-${dateKey}-bg`}
                            className={`flex-none border-l ${
                              isToday ? "bg-[#E0680E]/8 border-[#E0680E]/16" : "border-[#112532]/6 bg-white"
                            }`}
                            style={{ width: DAY_WIDTH }}
                          />
                        );
                      })}
                    </div>

                    <div className="absolute left-0 right-0 top-[108px] h-px border-t border-dashed border-[#112532]/10" />

                    <div className="absolute left-0 right-0 top-8 h-[54px]">
                      {propertyReservations.map((reservation) => {
                        if (!reservation.checkin_at || !reservation.checkout_at) return null;

                        const checkin = dateKeyFrom(reservation.checkin_at);
                        const checkout = dateKeyFrom(reservation.checkout_at);
                        if (!checkin || !checkout) return null;

                        const pos = halfDayReservationPosition({
                          startKey: checkin,
                          endExclusiveKey: checkout,
                          units,
                        });
                        if (!pos) return null;

                        const linkedRequest = linkedRequestForReservation(propertyRequests, reservation);
                        const briefing = briefingHref(linkedRequest);

                        const className = `absolute top-0 flex h-[48px] flex-col justify-center overflow-hidden rounded-[1.4rem] px-3 py-1 text-[10px] font-black shadow-sm ${palette.stay}`;

                        if (briefing) {
                          return (
                            <Link
                              key={reservation.id}
                              href={briefing}
                              className={className}
                              style={{ left: pos.left, width: pos.width }}
                              title={`${guestName(reservation, locale)} · ${copy.briefing}`}
                            >
                              <p className="truncate text-[11px] leading-tight">{guestName(reservation, locale)}</p>
                              <p className="truncate text-[9px] leading-tight opacity-70">{compactDateLabel(reservation.checkin_at, locale)} → {compactDateLabel(reservation.checkout_at, locale)}</p>
                            </Link>
                          );
                        }

                        return (
                          <div
                            key={reservation.id}
                            className={className}
                            style={{ left: pos.left, width: pos.width }}
                            title={`${guestName(reservation, locale)} · ${propertyName(property, locale)}`}
                          >
                            <p className="truncate text-[11px] leading-tight">{guestName(reservation, locale)}</p>
                            <p className="truncate text-[9px] leading-tight opacity-70">{compactDateLabel(reservation.checkin_at, locale)} → {compactDateLabel(reservation.checkout_at, locale)}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="absolute left-0 right-0 top-[86px] h-[24px]">
                      {propertyRequests.map((request) => {
                        if (!["created", "sent"].includes(String(request.status))) return null;
                        if (String(request.assigned_cleaner_id || "") !== currentCleanerId) return null;

                        const reservation = reservationsById[String(linkedReservationId(request) || "")];
                        const startKey = dateKeyFrom(windowStartAt(request, reservation));
                        const endKey = dateKeyFrom(anchorAt(request));
                        if (!startKey || !endKey) return null;

                        const pos = rangePosition(startKey, endKey, units);
                        if (!pos) return null;

                        return (
                          <Link
                            key={`${request.id}-zone`}
                            href={missionHref(request)}
                            className={`absolute top-0 h-[22px] rounded-full px-2 py-1 text-center text-[9px] font-black uppercase tracking-[0.08em] text-[#8A4D00] ring-1 ${palette.zone}`}
                            style={{ left: pos.left, width: pos.width }}
                            title={`${copy.proposedWindow} · ${statusLabel(request, false, locale)}`}
                          >
                            <span className="truncate">{copy.chooseDay}</span>
                          </Link>
                        );
                      })}
                    </div>


                    <div className="pointer-events-none absolute left-0 right-0 top-[78px] h-[42px]">
                      {propertyRequests.map((request) => {
                        const anchor = dateKeyFrom(anchorAt(request));
                        if (!anchor) return null;
                        const center = centerForDateKey(anchor, units);
                        if (center === null) return null;

                        const reservation = reservationsById[String(linkedReservationId(request) || "")];
                        if (!reservation) return null;

                        return (
                          <div
                            key={`${request.id}-connector`}
                            className={`absolute top-0 h-[42px] border-l-2 border-dashed ${palette.line}`}
                            style={{ left: center }}
                          />
                        );
                      })}
                    </div>

                    <div className="absolute left-0 right-0 top-[114px] h-[40px]">
                      {propertyRequests.map((request) => {
                        const anchor = dateKeyFrom(anchorAt(request));
                        if (!anchor) return null;

                        const center = centerForDateKey(anchor, units);
                        if (center === null) return null;

                        const mine = String(request.assigned_cleaner_id || "") === currentCleanerId;
                        const cleaner = cleanersById[String(request.assigned_cleaner_id || "")] ?? null;
                        const overdue = isOverdue(request, false);

                        return null;
                      })}
                    </div>

                    <div className="absolute left-0 right-0 top-[106px] h-[40px]">
                      {propertyRequests.map((request) => {
                        const anchor = dateKeyFrom(anchorAt(request));
                        if (!anchor) return null;
                        const center = centerForDateKey(anchor, units);
                        if (center === null) return null;

                        const mine = String(request.assigned_cleaner_id || "") === currentCleanerId;
                        const cleaner = cleanersById[String(request.assigned_cleaner_id || "")] ?? null;
                        const overdue = isOverdue(request, false);

                        return (
                          <div
                            key={`${request.id}-pos`}
                            className="absolute top-0"
                            style={{ left: center - 20 }}
                          >
                            <MissionBubble
                              request={request}
                              mine={mine}
                              cleaner={cleaner}
                              overdue={overdue}
                              locale={locale}
                            />
                          </div>
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
  const horizonEnd = addDays(today, HORIZON_DAYS - 1);
  const twoWeekEnd = addDays(today, 13);

  const calendarStartKey = addDays(today, -HISTORY_DAYS);
  const calendarStart = new Date(`${calendarStartKey}T00:00:00.000Z`);
  const calendarEnd = new Date(`${horizonEnd}T23:59:59.000Z`);

  const { data: requestRows } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("assigned_cleaner_id", cleaner.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(300);

  const myRequests = (requestRows ?? []) as Row[];

  const relevantMyRequests = myRequests.filter((request) => {
    const anchor = parseDate(anchorAt(request));
    if (!anchor) return false;

    const key = parisDateKey(anchor);

    return (
      (key >= today && key <= horizonEnd) ||
      isOverdue(request, false) ||
      ["created", "sent"].includes(String(request.status))
    );
  });

  const basePropertyIds = [
    ...new Set(relevantMyRequests.map((request) => request.property_id).filter(Boolean)),
  ];

  const { data: allPropertyRequestsRows } = basePropertyIds.length
    ? await supabase
        .from("cleaning_requests")
        .select("*")
        .in("property_id", basePropertyIds)
        .neq("status", "cancelled")
        .gte("ready_by_at", calendarStart.toISOString())
        .lte("ready_by_at", calendarEnd.toISOString())
        .order("ready_by_at", { ascending: true })
        .limit(600)
    : { data: [] };

  const allPropertyRequests = (allPropertyRequestsRows ?? []) as Row[];

  const calendarRequests = [
    ...allPropertyRequests,
    ...relevantMyRequests,
  ].filter((request, index, rows) => rows.findIndex((candidate) => String(candidate.id) === String(request.id)) === index);

  const propertyIds = [
    ...new Set(calendarRequests.map((request) => request.property_id).filter(Boolean)),
  ];

  const reservationIds = [
    ...new Set(
      calendarRequests
        .flatMap((request) => [request.reservation_id, request.prepares_reservation_id])
        .filter(Boolean),
    ),
  ];

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

  const reservationsById = Object.fromEntries(
    ((reservationsResult.data ?? []) as Row[]).map((reservation) => [String(reservation.id), reservation]),
  );

  const cancelledReservationIds = new Set(
    ((reservationsResult.data ?? []) as Row[])
      .filter(isReservationCancelled)
      .map((reservation) => String(reservation.id)),
  );

  const visibleRequests = relevantMyRequests.filter((request) => {
    const reservationId = linkedReservationId(request);
    if (!reservationId) return true;
    return !cancelledReservationIds.has(String(reservationId));
  });

  const visibleCalendarRequests = calendarRequests.filter((request) => {
    const reservationId = linkedReservationId(request);
    if (!reservationId) return true;
    return !cancelledReservationIds.has(String(reservationId));
  });

  const visibleCalendarReservations = ((calendarReservationsResult.data ?? []) as Row[]).filter(
    (reservation) => !isReservationCancelled(reservation),
  );

  const displayPropertyIds = new Set([
    ...visibleCalendarRequests.map((request) => String(request.property_id)).filter(Boolean),
    ...visibleCalendarReservations.map((reservation) => String(reservation.property_id)).filter(Boolean),
  ]);

  const baseProperties = ((propertiesResult.data ?? []) as Row[]).sort((a, b) =>
    propertyName(a, locale).localeCompare(propertyName(b, locale), intlLocale(locale)),
  );

  const displayProperties = baseProperties.filter((property) =>
    displayPropertyIds.has(String(property.id)),
  );

  const propertyPhotoRowsResult = displayProperties.length
    ? await supabase
        .from("property_reference_photos")
        .select("*")
        .in("property_id", displayProperties.map((property) => property.id))
        .eq("is_active", true)
        .order("is_cover", { ascending: false })
        .order("display_order", { ascending: true })
    : { data: [] };

  const firstPhotoByProperty = new Map<string, Row>();
  for (const photo of ((propertyPhotoRowsResult.data ?? []) as Row[])) {
    const propertyId = String(photo.property_id ?? "");
    if (propertyId && !firstPhotoByProperty.has(propertyId)) {
      firstPhotoByProperty.set(propertyId, photo);
    }
  }

  for (const property of displayProperties) {
    const photo = firstPhotoByProperty.get(String(property.id));
    property.signedPhotoUrl = await signedUrl(supabase, photoBucket(photo), photoPath(photo));
  }

  const cleanerIds = [
    ...new Set(visibleCalendarRequests.map((request) => request.assigned_cleaner_id).filter(Boolean)),
  ];

  const cleanersResult = cleanerIds.length
    ? await supabase.from("cleaners").select("*").in("id", cleanerIds)
    : { data: [] };

  const cleaners = (cleanersResult.data ?? []) as Row[];

  for (const row of cleaners) {
    row.signedPhotoUrl = await signedUrl(
      supabase,
      row.profile_photo_bucket || row.photo_bucket || row.avatar_bucket || null,
      row.profile_photo_path || row.photo_path || row.avatar_path || null,
    );
  }

  const cleanersById = Object.fromEntries(cleaners.map((row) => [String(row.id), row]));

  const propertiesById = Object.fromEntries(
    displayProperties.map((property) => [String(property.id), property]),
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
          <Link href={`/cleaner/${token}`} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-black text-[#112532]/56 ring-1 ring-[#112532]/8">
            {copy.back}
          </Link>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#E0680E]">
            Pilotys · cleaner planning
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            {copy.title}
          </h1>

          <p className="mt-2 max-w-3xl text-sm font-semibold text-[#112532]/52">
            {copy.subtitle}
          </p>
        </div>

        <section className="grid min-w-0 grid-cols-4 gap-2">
          <KpiCard
            label={copy.missions}
            value={String(twoWeekRequests.length)}
            className="bg-[#ECFFF6] text-[#0B6B53] ring-[#0B6B53]/15"
          />
          <KpiCard
            label={copy.properties}
            value={String(twoWeekProperties.size)}
            className="bg-[#EFF6F8] text-[#112532] ring-[#80A5B7]/25"
          />
          <KpiCard
            label={copy.hours}
            value={`${String(Math.round(twoWeekHours * 10) / 10).replace(".", ",")} h`}
            className="bg-[#FFF5DD] text-[#8A4D00] ring-[#F4B044]/25"
          />
          <KpiCard
            label={copy.estimated}
            value={money(twoWeekEarnings)}
            className="bg-white text-[#112532] ring-[#112532]/8"
          />
        </section>

        {(overdue.length > 0 || toConfirm.length > 0) && (
          <section className="rounded-[2rem] bg-[#FFF5DD] p-5 shadow-sm ring-1 ring-[#F4B044]/25">
            <h2 className="text-lg font-black text-[#8A4D00]">{copy.overdueTitle}</h2>
            <p className="mt-1 text-sm font-semibold text-[#8A4D00]/80">{copy.overdueBody}</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[...overdue, ...toConfirm].slice(0, 4).map((request) => (
                <MissionCompactCard
                  key={request.id}
                  request={request}
                  property={propertiesById[String(request.property_id)]}
                  reservation={reservationsById[String(linkedReservationId(request) || "")]}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        )}

        <PropertyPlanningTimeline
          properties={displayProperties}
          reservations={visibleCalendarReservations}
          requests={visibleCalendarRequests}
          cleanersById={cleanersById}
          reservationsById={reservationsById}
          currentCleanerId={String(cleaner.id)}
          locale={locale}
        />

        <section className="grid min-w-0 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="min-w-0 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
            <h2 className="text-xl font-black text-[#112532]">{copy.nextMission}</h2>

            {!nextMission ? (
              <p className="mt-4 rounded-2xl bg-[#F6F3EF] p-4 text-sm font-bold text-[#112532]/50">
                {copy.noNextMission}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <MissionCompactCard
                  request={nextMission}
                  property={propertiesById[String(nextMission.property_id)]}
                  reservation={reservationsById[String(linkedReservationId(nextMission) || "")]}
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

          <section className="min-w-0 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
            <h2 className="text-xl font-black text-[#112532]">{copy.upcoming}</h2>

            {groupedUpcoming.size === 0 ? (
              <p className="mt-4 rounded-2xl bg-[#F6F3EF] p-4 text-sm font-bold text-[#112532]/50">
                {copy.noUpcoming}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {[...groupedUpcoming.entries()].map(([dateKey, rows]) => (
                  <div key={dateKey}>
                    <h3 className="text-sm font-black text-[#112532]/50">
                      {dayHeading(dateKey, today, locale)}
                    </h3>

                    <div className="mt-2 space-y-2">
                      {rows.map((request) => (
                        <MissionCompactCard
                          key={request.id}
                          request={request}
                          property={propertiesById[String(request.property_id)]}
                          reservation={reservationsById[String(linkedReservationId(request) || "")]}
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

      <script
        dangerouslySetInnerHTML={{
          __html: `
            requestAnimationFrame(() => {
              const el = document.querySelector('[data-cleaner-timeline-scroll]');
              if (!el) return;
              const todayIndex = Number(el.getAttribute('data-today-index') || 0);
              const dayWidth = Number(el.getAttribute('data-day-width') || 52);
              const target = Math.max(0, todayIndex * dayWidth - 120);
              el.scrollLeft = target;
            });
          `,
        }}
      />

      <CleanerBottomNav cleanerToken={token} active="planning" locale={locale} />
    </main>
  );
}
