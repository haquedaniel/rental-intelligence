export const PARIS_TZ = "Europe/Paris";

export type ReadyDayOption = {
  dateKey: string;
  readyByAt: string;
  label: string;
};

function parisParts(date: Date) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    day: parts.find((part) => part.type === "day")?.value ?? "",
    hour: parts.find((part) => part.type === "hour")?.value ?? "",
    minute: parts.find((part) => part.type === "minute")?.value ?? "",
  };
}

export function parisDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = parisParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function parisLocalDateTimeToUtcIso(dateKey: string, hour: number, minute = 0): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  // Paris is UTC+1 or UTC+2. Try a small UTC range and keep the instant
  // that formats back to the requested Paris local time.
  for (let utcHour = hour - 3; utcHour <= hour + 1; utcHour += 1) {
    const candidate = new Date(Date.UTC(year, month - 1, day, utcHour, minute, 0));
    const parts = parisParts(candidate);

    if (
      Number(parts.year) === year &&
      Number(parts.month) === month &&
      Number(parts.day) === day &&
      Number(parts.hour) === hour &&
      Number(parts.minute) === minute
    ) {
      return candidate.toISOString();
    }
  }

  // Fallback should almost never happen for France, but gives a predictable value.
  return new Date(Date.UTC(year, month - 1, day, hour - 1, minute, 0)).toISOString();
}

export function formatReadyDayLabel(dateKey: string, checkoutDateKey?: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  if (checkoutDateKey && dateKey === checkoutDateKey) {
    return `Aujourd’hui · prêt avant 16h`;
  }

  if (checkoutDateKey && dateKey === addDaysToDateKey(checkoutDateKey, 1)) {
    return `Demain · prêt avant 16h`;
  }

  return `${dayLabel} · prêt avant 16h`;
}

export function buildReadyDayOptions({
  checkoutAt,
  deadlineAt,
  maxDays = 3,
}: {
  checkoutAt: string;
  deadlineAt?: string | null;
  maxDays?: number;
}): ReadyDayOption[] {
  const checkoutDateKey = parisDateKey(checkoutAt);
  const deadline = deadlineAt ? new Date(deadlineAt) : null;

  const options: ReadyDayOption[] = [];

  for (let offset = 0; offset <= maxDays; offset += 1) {
    const dateKey = addDaysToDateKey(checkoutDateKey, offset);
    const readyByAt = parisLocalDateTimeToUtcIso(dateKey, 16, 0);

    if (deadline && new Date(readyByAt).getTime() > deadline.getTime()) {
      continue;
    }

    options.push({
      dateKey,
      readyByAt,
      label: formatReadyDayLabel(dateKey, checkoutDateKey),
    });
  }

  return options;
}

export function fullDateTimeLabel(value?: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
