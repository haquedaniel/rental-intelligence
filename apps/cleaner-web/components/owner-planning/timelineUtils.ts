export const PARIS_TZ = "Europe/Paris";

export type Row = Record<string, any>;

export type TimelineMode = "daily" | "weekly" | "monthly";

export type TimelineUnit = {
  key: string;
  start: string;
  end: string;
  label: string;
  subLabel: string;
  mode: TimelineMode;
};

export function isDateKey(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function dateAtNoonUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export function dateKeyFromUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, days: number): string {
  const date = dateAtNoonUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyFromUtcDate(date);
}

export function daysBetweenInclusive(start: string, end: string): number {
  const startDate = dateAtNoonUtc(start);
  const endDate = dateAtNoonUtc(end);
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
}

export function parisDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;

  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function todayParisDateKey(): string {
  return parisDateKey(new Date());
}

export function toIsoStart(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

export function toIsoEnd(dateKey: string): string {
  return `${dateKey}T23:59:59.999Z`;
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function compactDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "short",
  })
    .format(dateAtNoonUtc(dateKey))
    .replace(".", "");
}

export function longDateLabel(dateKey: string): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: PARIS_TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dateAtNoonUtc(dateKey)),
  );
}

export function shortDayName(dateKey: string): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: PARIS_TZ,
      weekday: "short",
    })
      .format(dateAtNoonUtc(dateKey))
      .replace(".", ""),
  );
}

export function monthLabel(dateKey: string): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: PARIS_TZ,
      month: "short",
    })
      .format(dateAtNoonUtc(dateKey))
      .replace(".", ""),
  );
}

export function timeLabel(iso?: string | null): string {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(":", "h");
}

export function rangeMode(start: string, end: string): TimelineMode {
  const days = daysBetweenInclusive(start, end);
  if (days <= 31) return "daily";
  if (days <= 150) return "weekly";
  return "monthly";
}

export function modeLabel(mode: TimelineMode): string {
  if (mode === "daily") return "Vue jour";
  if (mode === "weekly") return "Vue semaine";
  return "Vue mois";
}

export function buildTimelineUnits(start: string, end: string): TimelineUnit[] {
  const mode = rangeMode(start, end);
  const units: TimelineUnit[] = [];

  if (mode === "daily") {
    let cursor = start;
    while (cursor <= end) {
      units.push({
        key: cursor,
        start: cursor,
        end: cursor,
        label: shortDayName(cursor),
        subLabel: compactDateLabel(cursor),
        mode,
      });
      cursor = addDays(cursor, 1);
    }
    return units;
  }

  if (mode === "weekly") {
    let cursor = start;
    while (cursor <= end) {
      const unitEnd = addDays(cursor, 6) > end ? end : addDays(cursor, 6);
      units.push({
        key: `${cursor}:${unitEnd}`,
        start: cursor,
        end: unitEnd,
        label: "Semaine",
        subLabel: compactDateLabel(cursor),
        mode,
      });
      cursor = addDays(unitEnd, 1);
    }
    return units;
  }

  let cursor = start.slice(0, 7) + "-01";
  if (cursor < start) cursor = start;

  while (cursor <= end) {
    const d = dateAtNoonUtc(cursor);
    const month = d.getUTCMonth();
    const next = new Date(d);
    next.setUTCMonth(month + 1, 1);
    const nextMonth = dateKeyFromUtcDate(next);
    const unitEnd = addDays(nextMonth, -1) > end ? end : addDays(nextMonth, -1);

    units.push({
      key: `${cursor}:${unitEnd}`,
      start: cursor,
      end: unitEnd,
      label: monthLabel(cursor),
      subLabel: cursor.slice(0, 4),
      mode,
    });

    cursor = addDays(unitEnd, 1);
  }

  return units;
}

export function dateInUnit(dateKey: string, unit: TimelineUnit): boolean {
  return dateKey >= unit.start && dateKey <= unit.end;
}

export function spanForRange(units: TimelineUnit[], startDate: string, endExclusive: string) {
  const touched = units
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit }) => startDate <= unit.end && endExclusive > unit.start);

  if (touched.length === 0) return null;

  const first = touched[0].index;
  const last = touched[touched.length - 1].index;

  return {
    start: first + 1,
    span: last - first + 1,
  };
}

export function unitIndexForDate(units: TimelineUnit[], dateKey: string): number {
  return units.findIndex((unit) => dateInUnit(dateKey, unit));
}

export function fullName(cleaner?: Row | null): string {
  if (!cleaner) return "Non affecté";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || "Intervenante";
}

export function initials(cleaner?: Row | null): string {
  if (!cleaner) return "?";
  const first = cleaner.first_name?.[0] ?? "";
  const last = cleaner.last_name?.[0] ?? "";
  return `${first}${last}` || "?";
}

export function reservationTitle(reservation?: Row | null): string {
  if (!reservation) return "Séjour";
  return reservation.guest_name || reservation.source_booking_id || "Séjour";
}

export function requestStatusLabel(request: Row): string {
  if (request.schedule_status === "needs_manual_reassignment") return "Action requise";
  if (request.schedule_status === "planning_changed") return "Planning modifié";

  switch (request.status) {
    case "created":
      return "Créée";
    case "sent":
      return "Proposée";
    case "accepted":
      return "Confirmée";
    case "refused":
      return "Refusée";
    case "cancelled":
      return "Annulée";
    case "report_submitted":
    case "completed":
      return "Fait";
    case "problem_reported":
      return "Problème";
    default:
      return request.status || "À créer";
  }
}

export function requestStatusClass(request: Row): string {
  if (request.schedule_status === "needs_manual_reassignment") {
    return "bg-red-600 text-white ring-red-700";
  }

  if (request.schedule_status === "planning_changed") {
    return "bg-red-600 text-white ring-red-700";
  }

  switch (request.status) {
    case "accepted":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "sent":
    case "created":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "report_submitted":
    case "completed":
      return "bg-slate-950 text-white ring-slate-950";
    case "problem_reported":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    case "refused":
    case "cancelled":
      return "bg-red-100 text-red-800 ring-red-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function manualActionNeeded(request: Row): boolean {
  return ["needs_manual_reassignment", "planning_changed"].includes(request.schedule_status);
}

export function reportHref(request?: Row | null): string | null {
  if (!request?.public_token) return null;

  if (["report_submitted", "completed", "problem_reported"].includes(request.status)) {
    return `/mission/${request.public_token}/report`;
  }

  return null;
}

export function manualMissionHref(propertyId: string, dateKey: string): string {
  const params = new URLSearchParams();
  params.set("property_id", propertyId);
  params.set("date", dateKey);
  return `/admin/operations/create-cleaning-request?${params.toString()}`;
}

export function missingCleaningHref(reservation: Row): string {
  const params = new URLSearchParams();
  params.set("reservation_id", reservation.id);
  params.set("property_id", reservation.property_id);
  return `/admin/operations/create-cleaning-request?${params.toString()}`;
}

export function manualReassignmentHref(request: Row): string {
  const params = new URLSearchParams();

  if (request.property_id) params.set("property_id", String(request.property_id));
  if (request.reservation_id) params.set("reservation_id", String(request.reservation_id));
  if (request.scheduled_start_at) params.set("date", parisDateKey(request.scheduled_start_at));

  params.set("reason", String(request.schedule_status || "needs_manual_reassignment"));
  params.set("source_request_id", String(request.id));

  return `/admin/operations/create-cleaning-request?${params.toString()}`;
}

export function missionTypeIcon(serviceType?: string): string {
  switch (serviceType) {
    case "garden_lawn":
      return "🌿";
    case "deep_cleaning":
      return "✨";
    case "linen_laundry":
      return "🧺";
    case "inventory_check":
      return "🔎";
    case "maintenance_check":
      return "🔧";
    default:
      return "🧹";
  }
}

export function missionTypeLabel(request: Row): string {
  if (request.title) return request.title;

  switch (request.service_type) {
    case "garden_lawn":
      return "Jardin";
    case "deep_cleaning":
      return "Grand ménage";
    case "linen_laundry":
      return "Linge";
    case "inventory_check":
      return "Inventaire";
    case "maintenance_check":
      return "Maintenance";
    default:
      return "Ménage";
  }
}

export function marketTensionScore(dateKey: string): number {
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));

  if (month === 7) return 62 + Math.min(18, Math.floor(day / 2));
  if (month === 8) return day < 20 ? 88 : 74;
  if (month === 6) return day > 15 ? 52 : 36;
  if (month === 9) return day < 15 ? 50 : 32;
  return 24;
}

export function tensionClass(score: number): string {
  if (score >= 80) return "bg-amber-200/45";
  if (score >= 60) return "bg-amber-100/55";
  if (score >= 40) return "bg-sky-100/45";
  return "bg-slate-100/60";
}

export function tensionLabel(score: number): string {
  if (score >= 80) return "forte";
  if (score >= 60) return "soutenue";
  if (score >= 40) return "normale";
  return "faible";
}


export function requestIssueHref(request: Row): string {
  return `/owner/issues/request/${request.id}`;
}

export function missingIssueHref(reservation: Row): string {
  return `/owner/issues/missing/${reservation.id}`;
}
