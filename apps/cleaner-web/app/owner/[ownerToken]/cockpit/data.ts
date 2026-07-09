import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addDays,
  compactDateLabel,
  marketTensionScore,
  missionTypeLabel,
  parisDateKey,
  requestStatusLabel,
  timeLabel,
} from "@/components/owner-planning/timelineUtils";
import {
  cleaningCost,
  numberValue,
  reservationRevenue,
} from "@/components/owner-planning/analyticsUtils";
import type {
  DailyPrice,
  ExpenseBreakdownItem,
  FinancialSummary,
  MonthlyRevenuePoint,
  Opportunity,
  OwnerCockpitData,
  OwnerCockpitListing,
  PlanningDay,
  PlanningMarker,
  PlanningMonthSpan,
  PlanningReservation,
  TimelineEvent,
  Tone,
} from "./types";

type Row = Record<string, any>;

async function signedUrl(supabase: ReturnType<typeof getSupabaseAdmin>, bucket?: string | null, path?: string | null): Promise<string | null> {
  if (!bucket || !path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}


function firstImageUrl(row: Row | undefined | null, candidates: string[]) {
  if (!row) return null;

  for (const key of candidates) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) return value.trim();

    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === "string" && first.trim()) return first.trim();
      if (first && typeof first === "object") {
        const nested = first.url || first.publicUrl || first.public_url || first.signedUrl || first.signed_url || first.path;
        if (typeof nested === "string" && nested.trim()) return nested.trim();
      }
    }

    if (value && typeof value === "object") {
      const nested = value.url || value.publicUrl || value.public_url || value.signedUrl || value.signed_url || value.path;
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
  }

  return null;
}

function propertyImageUrl(row: Row | undefined | null) {
  return firstImageUrl(row, [
    "cover_photo_signed_url",
    "cover_photo_url",
    "photo_signed_url",
    "photo_url",
    "image_signed_url",
    "image_url",
    "thumbnail_signed_url",
    "thumbnail_url",
    "main_photo_url",
    "main_image_url",
    "hero_image_url",
    "pictures",
    "photos",
    "images",
  ]);
}

function cleanerImageUrl(row: Row | undefined | null) {
  return firstImageUrl(row, [
    "profilePhotoSignedUrl",
    "profile_photo_signed_url",
    "profile_photo_url",
    "photo_signed_url",
    "photo_url",
    "avatar_signed_url",
    "avatar_url",
    "image_url",
    "thumbnail_url",
  ]);
}


function reservationHref(reservation: Row) {
  return `/owner/reservations/${reservation.id}`;
}

function requestHref(request: Row) {
  const status = String(request.status ?? "");
  if (["completed", "report_submitted", "problem_reported"].includes(status)) {
    return `/owner/reports/${request.id}`;
  }
  return `/owner/issues/request/${request.id}`;
}

function initialsFromParts(first?: unknown, last?: unknown, fallback = "?") {
  const a = String(first ?? "").trim();
  const b = String(last ?? "").trim();
  const out = `${a[0] ?? ""}${b[0] ?? ""}`.toUpperCase();
  return out || fallback;
}

function cleanerDisplayName(cleaner?: Row | null) {
  if (!cleaner) return "Intervenante";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || cleaner.display_name || cleaner.name || "Intervenante";
}

function cleanerInitials(cleaner?: Row | null) {
  if (!cleaner) return "?";
  return initialsFromParts(cleaner.first_name, cleaner.last_name, "?");
}

function cleanerPhotoUrl(cleaner?: Row | null) {
  if (!cleaner) return null;
  return cleaner.profile_photo_signed_url || cleanerImageUrl(cleaner);
}

function requestTone(request: Row): Tone {
  const status = String(request.status ?? "");
  const schedule = String(request.schedule_status ?? "");
  const issue =
    ["refused", "problem_reported"].includes(status) ||
    ["needs_manual_reassignment", "planning_changed", "cleaning_overdue", "overdue"].includes(schedule);

  if (issue) return "orange";
  if (["completed", "report_submitted"].includes(status)) return "blue";
  if (status === "accepted") return "green";
  return "mustard";
}

function requestIsIntervention(request: Row) {
  const serviceType = String(request.service_type ?? "");
  return ["garden_lawn", "maintenance_check", "inventory_check"].includes(serviceType);
}


function isReservationActiveOnDate(reservation: Row, dateKey: string) {
  if (!reservation.checkin_at || !reservation.checkout_at) return false;
  const checkin = parisDateKey(reservation.checkin_at);
  const checkout = parisDateKey(reservation.checkout_at);

  // Check-in day counts; checkout day does not.
  return checkin <= dateKey && dateKey < checkout;
}

function reservationDailyRevenue(reservation: Row) {
  if (!reservation.checkin_at || !reservation.checkout_at) return 0;

  const value = reservationRevenue(reservation);
  if (!value) return 0;

  const checkin = parisDateKey(reservation.checkin_at);
  const checkout = parisDateKey(reservation.checkout_at);
  const nights = Math.max(1, daysBetween(checkin, checkout));

  return value / nights;
}


const PROPERTY_DOTS = ["#112532", "#E0680E", "#F4B044", "#80A5B7", "#7C8A92"];
const PROPERTY_TONES: Tone[] = ["navy", "orange", "mustard", "blue", "green"];
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

function normaliseToken(token: string) {
  return decodeURIComponent(token || "").trim();
}

function todayParisDateKey() {
  return parisDateKey(new Date());
}

function dateAtNoon(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`);
}


function addMonths(dateKey: string, months: number) {
  const date = dateAtNoon(dateKey);
  date.setUTCMonth(date.getUTCMonth() + months);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function daysBetween(start: string, end: string) {
  const a = dateAtNoon(start).getTime();
  const b = dateAtNoon(end).getTime();
  return Math.round((b - a) / 86_400_000);
}

function toIsoStart(dateKey: string) {
  return `${dateKey}T00:00:00.000Z`;
}

function toIsoEnd(dateKey: string) {
  return `${dateKey}T23:59:59.999Z`;
}

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function monthLabelForDateKey(dateKey: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(dateAtNoon(dateKey));
}

function dayLabel(dateKey: string) {
  const date = dateAtNoon(dateKey);
  const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date);
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date).replace(".", "");
  return `${day}\n${weekday.slice(0, 3)}`;
}

function sum(rows: Row[], key: string) {
  return rows.reduce((total, row) => total + numberValue(row, [key]), 0);
}

function rowDateInRange(row: Row, start: string, end: string) {
  const date = String(row.date ?? "");
  return date >= start && date <= end;
}

function monthInRange(row: Row, start: string, end: string) {
  const month = String(row.year_month ?? "");
  return month >= start.slice(0, 7) && month <= end.slice(0, 7);
}

function expenseDateInRange(row: Row, start: string, end: string) {
  const date = String(row.expense_date ?? "");
  return Boolean(date && date >= start && date <= end);
}

function propertyMatches(row: Row, property: Row) {
  const propertyId = String(property.id ?? "");
  const propertyName = String(property.name ?? "");
  return (
    String(row.property_id ?? "") === propertyId ||
    String(row.listing_id ?? "") === propertyId ||
    (propertyName && String(row.listing_name ?? "") === propertyName)
  );
}

function monthRowsForProperty(monthlyRows: Row[], property: Row) {
  return monthlyRows.filter((row) => propertyMatches(row, property));
}

function dailyRowsForProperty(dailyRows: Row[], propertyId: string) {
  return dailyRows.filter((row) => !row.property_id || String(row.property_id) === propertyId);
}

function requestTimelineDateKey(request: Row): string | null {
  if (request.ready_by_at) return parisDateKey(request.ready_by_at);

  if (typeof request.ready_by_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(request.ready_by_date)) {
    return request.ready_by_date;
  }

  if (request.scheduled_start_at) return parisDateKey(request.scheduled_start_at);

  return null;
}

function reservationGuest(row: Row) {
  const explicit =
    row.guest_name ||
    row.guest_full_name ||
    row.primary_guest_name ||
    row.source_guest_name ||
    row.customer_name ||
    row.booker_name ||
    row.client_name ||
    row.name;

  if (explicit && String(explicit).trim()) return String(explicit).trim();

  const first = String(row.guest_first_name ?? row.first_name ?? "").trim();
  const last = String(row.guest_last_name ?? row.last_name ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ").trim();
  if (full) return full;

  return "Client";
}

function signedPhotoUrlOrNull(row: Row) {
  return row.cover_photo_signed_url || null;
}

function daysInMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return 30;
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

function hostPayout(row: Row) {
  return numberValue(row, ["host_payout", "host_payout_eur"]);
}

function hostPayoutAllocated(row: Row) {
  return numberValue(row, ["host_payout_allocated", "host_payout_allocated_eur"]);
}

function bookedNights(row: Row) {
  return numberValue(row, ["booked_nights", "nights", "occupied_nights"]);
}

function targetValue(row: Row) {
  return numberValue(row, ["target_gross_booking_value", "target_host_payout"]);
}

function hasPropertyDimension(row: Row) {
  return Boolean(row.property_id || row.listing_id || row.listing_name);
}

function preferGranularRows(rows: Row[]) {
  const granular = rows.filter(hasPropertyDimension);
  return granular.length > 0 ? granular : rows;
}

function scopedRows(rows: Row[], propertyIds: string[]) {
  const scoped = rows.filter((row) => {
    if (row.property_id) return propertyIds.includes(String(row.property_id));
    return true;
  });

  return preferGranularRows(scoped);
}

function monthlyRowsForMonth(rows: Row[], yearMonth: string) {
  return preferGranularRows(rows.filter((row) => String(row.year_month ?? "") === yearMonth));
}

function dailyRowsForMonth(rows: Row[], yearMonth: string) {
  return preferGranularRows(rows.filter((row) => String(row.date ?? "").slice(0, 7) === yearMonth));
}

function labelForExpense(row: Row): string {
  const category = String(row.category ?? "");
  if (category === "cleaning_actual_cost") return "Ménage";
  if (category === "energy_usage") return "Électricité";
  if (category === "water_usage") return "Eau";
  if (category === "concierge") return "Conciergerie";
  if (category === "concierge_fee") return "Conciergerie";
  if (category === "channel_commission") return "Commission";
  if (category) return category.replaceAll("_", " ");

  const family = String(row.cost_family ?? "");
  return family ? family.replaceAll("_", " ") : "Autres frais";
}

function expenseSource(row: Row): string {
  return String(row.expense_source ?? row.source ?? row.cost_source ?? row.kind ?? "");
}

function expenseAmount(row: Row): number {
  return numberValue(row, [
    "expense_amount",
    "amount_eur",
    "amount",
    "cost_eur",
    "expense_eur",
    "total_cost_eur",
    "total_eur",
    "value_eur",
  ]);
}

function expenseAmountPerDay(row: Row): number {
  return numberValue(row, [
    "amount_per_day",
    "daily_amount_eur",
    "cost_per_day_eur",
    "amount_eur_per_day",
  ]);
}

function addBreakdown(map: Map<string, ExpenseBreakdownItem>, label: string, amount: number, count = 1) {
  if (!amount) return;
  const current = map.get(label) ?? { label, amount: 0, count: 0 };
  current.amount += amount;
  current.count += count;
  map.set(label, current);
}

function exactVariableExpenseAmount({
  periodDaily,
  expenseRows,
}: {
  periodDaily: Row[];
  expenseRows: Row[];
}): { total: number; items: ExpenseBreakdownItem[] } {
  const breakdown = new Map<string, ExpenseBreakdownItem>();

  const variableRows = expenseRows.filter((row) => expenseSource(row) === "variable_period_costs");
  const directlyCountedRows = expenseRows.filter((row) => expenseSource(row) !== "variable_period_costs");

  // Booking-level and already-materialised expense lines, e.g. cleaning, concierge, commissions.
  for (const row of directlyCountedRows) {
    addBreakdown(breakdown, labelForExpense(row), expenseAmount(row));
  }

  // Monthly variable costs are stored as amount_per_day; count them only for booked days.
  for (const daily of periodDaily) {
    if (!daily.is_booked) continue;

    const matches = variableRows.filter(
      (expense) =>
        String(expense.property_id ?? "") === String(daily.property_id ?? "") &&
        String(expense.year_month ?? "") === String(daily.year_month ?? String(daily.date ?? "").slice(0, 7)),
    );

    for (const expense of matches) {
      addBreakdown(breakdown, labelForExpense(expense), expenseAmountPerDay(expense));
    }
  }

  const items = Array.from(breakdown.values()).sort((a, b) => b.amount - a.amount);
  const total = items.reduce((acc, item) => acc + item.amount, 0);

  return { total, items };
}

function reservationAmountFromDaily(row: Row, dailyRows: Row[]) {
  if (!row.checkin_at || !row.checkout_at || !row.property_id) return 0;

  const checkin = parisDateKey(row.checkin_at);
  const checkout = parisDateKey(row.checkout_at);
  return dailyRows
    .filter((daily) => {
      const date = String(daily.date ?? "");
      return (
        date >= checkin &&
        date < checkout &&
        String(daily.property_id ?? "") === String(row.property_id ?? "")
      );
    })
    .reduce((total, daily) => total + hostPayoutAllocated(daily), 0);
}

function averageNightlyForPropertyMonth({
  propertyId,
  month,
  monthlyRows,
  targets,
}: {
  propertyId: string;
  month: string;
  monthlyRows: Row[];
  targets: Row[];
}) {
  const rows = monthlyRows.filter((row) =>
    String(row.year_month ?? "") === month &&
    (!row.property_id || String(row.property_id) === propertyId || String(row.listing_id ?? "") === propertyId),
  );

  const payout = rows.reduce((total, row) => total + hostPayout(row), 0);
  const nights = rows.reduce((total, row) => total + bookedNights(row), 0);
  if (payout > 0 && nights > 0) return Math.round(payout / nights);

  const targetRows = targets.filter((row) =>
    String(row.year_month ?? "") === month &&
    (!row.property_id || String(row.property_id) === propertyId || String(row.listing_id ?? "") === propertyId),
  );
  const target = targetRows.reduce((total, row) => total + targetValue(row), 0);
  if (target > 0) return Math.round(target / daysInMonth(month));

  return 0;
}

function reservationAmount({
  reservation,
  dailyRows,
  monthlyRows,
  targets,
}: {
  reservation: Row;
  dailyRows: Row[];
  monthlyRows: Row[];
  targets: Row[];
}) {
  const explicit = reservationRevenue(reservation);
  if (explicit > 0) return explicit;

  const daily = reservationAmountFromDaily(reservation, dailyRows);
  if (daily > 0) return daily;

  if (!reservation.checkin_at || !reservation.checkout_at) return 0;

  const checkin = parisDateKey(reservation.checkin_at);
  const checkout = parisDateKey(reservation.checkout_at);
  const nights = Math.max(1, daysBetween(checkin, checkout));
  const month = checkin.slice(0, 7);
  const average = averageNightlyForPropertyMonth({
    propertyId: String(reservation.property_id ?? ""),
    month,
    monthlyRows,
    targets,
  });

  return average > 0 ? average * nights : 0;
}

function buildListings({
  properties,
  monthlyRows,
  yearReservations,
  dailyRows,
  targets,
}: {
  properties: Row[];
  monthlyRows: Row[];
  yearReservations: Row[];
  dailyRows: Row[];
  targets: Row[];
}): OwnerCockpitListing[] {
  return properties.map((property, index) => {
    const propertyMonthlyRows = monthRowsForProperty(monthlyRows, property);
    let revenue = propertyMonthlyRows.reduce((total, row) => total + hostPayout(row), 0);

    if (revenue === 0) {
      revenue = yearReservations
        .filter((reservation) => String(reservation.property_id ?? "") === String(property.id))
        .reduce((total, reservation) => total + reservationAmount({ reservation, dailyRows, monthlyRows, targets }), 0);
    }

    const booked = propertyMonthlyRows.reduce((total, row) => total + bookedNights(row), 0);
    const occupancyPct = propertyMonthlyRows.reduce((max, row) => Math.max(max, numberValue(row, ["occupancy_pct"])), 0);

    return {
      id: String(property.id),
      name: property.name || `Logement ${index + 1}`,
      short: String(property.name || index + 1).slice(0, 1).toUpperCase(),
      image: signedPhotoUrlOrNull(property),
      tone: PROPERTY_TONES[index % PROPERTY_TONES.length],
      dot: PROPERTY_DOTS[index % PROPERTY_DOTS.length],
      status: property.status_label || "À jour",
      revenue,
      occupancy: occupancyPct || Math.min(100, Math.round((booked / 365) * 100)),
    };
  });
}

function buildMonthlyRevenue({
  analyticsMonthly,
  analyticsDaily,
  targets,
  year,
}: {
  analyticsMonthly: Row[];
  analyticsDaily: Row[];
  targets: Row[];
  year: number;
}): MonthlyRevenuePoint[] {
  const today = todayParisDateKey();
  const todayMonth = today.slice(0, 7);

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const key = monthKey(year, monthIndex);
    const rows = monthlyRowsForMonth(analyticsMonthly, key);
    const dailyRows = dailyRowsForMonth(analyticsDaily, key);
    const targetRows = monthlyRowsForMonth(targets, key);

    const totalOnBooks = rows.reduce((total, row) => total + hostPayout(row), 0);
    const dailyRealised = dailyRows
      .filter((row) => String(row.date ?? "") <= today)
      .reduce((total, row) => total + hostPayoutAllocated(row), 0);

    let realised = 0;
    let future = 0;

    if (key < todayMonth) {
      // Historical months are closed: there should never be "à venir" revenue in the past.
      realised = totalOnBooks || dailyRealised;
      future = 0;
    } else if (key === todayMonth) {
      // Current month can be split between realised nights and remaining on-the-books revenue.
      realised = dailyRealised || 0;
      future = Math.max(0, totalOnBooks - realised);
    } else {
      realised = 0;
      future = totalOnBooks;
    }

    return {
      month: MONTH_LABELS[monthIndex],
      realised,
      future,
      target: targetRows.reduce((total, row) => total + targetValue(row), 0),
      live: key === todayMonth,
    };
  });
}


function dailyAllocatedRevenueForDate(rows: Row[], dateKey: string) {
  return preferGranularRows(rows.filter((row) => String(row.date ?? "") === dateKey))
    .reduce((sum, row) => sum + hostPayoutAllocated(row), 0);
}

function buildFinancial({
  monthly,
  dailyRows,
  expenses,
  yearStart,
  yearEnd,
}: {
  monthly: MonthlyRevenuePoint[];
  dailyRows: Row[];
  expenses: Row[];
  yearStart: string;
  yearEnd: string;
}): FinancialSummary {
  const today = todayParisDateKey();
  const todayMonth = today.slice(0, 7);

  // Card value should match the monthly chart: past months are realised, current month is split, future months are on the books.
  const realisedRevenue = monthly.reduce((total, row, index) => {
    const key = monthKey(Number(yearStart.slice(0, 4)), index);
    return key <= todayMonth ? total + row.realised : total;
  }, 0);

  const grossAnnualRevenue = monthly.reduce((total, row) => total + row.realised + row.future, 0);

  const yearDaily = preferGranularRows(dailyRows.filter((row) => rowDateInRange(row, yearStart, yearEnd)));
  const bookingExpenseRows = expenses.filter((row) => row.expense_source === "booking_expenses" && expenseDateInRange(row, yearStart, yearEnd));
  const variableRowsForSelectedMonths = expenses.filter((row) => row.expense_source === "variable_period_costs" && monthInRange(row, yearStart, yearEnd));
  const exactExpenses = exactVariableExpenseAmount({
    periodDaily: yearDaily,
    expenseRows: [...bookingExpenseRows, ...variableRowsForSelectedMonths],
  });
  const variableCosts = exactExpenses.total;

  return {
    realisedRevenue,
    realisedAtStartOfToday: realisedRevenue,
    activeDailyRevenue: 0,
    grossAnnualRevenue,
    afterVariables: Math.max(0, grossAnnualRevenue - variableCosts),
    variableCosts,
    expenseBreakdownItems: exactExpenses.items,
    grossDeltaPct: null,
    afterVariablesDeltaPct: null,
  };
}

function buildPlanningDays(start: string, end: string): PlanningDay[] {
  const dayCount = Math.max(1, daysBetween(start, end) + 1);

  return Array.from({ length: dayCount }, (_, index) => {
    const key = addDays(start, index);
    const tension = Math.max(0.1, Math.min(1, marketTensionScore(key) / 100));

    return {
      key,
      month: monthLabelForDateKey(key),
      label: dayLabel(key),
      tension,
    };
  });
}

function buildMonthSpans(days: PlanningDay[]): PlanningMonthSpan[] {
  const spans: PlanningMonthSpan[] = [];

  for (const [index, day] of days.entries()) {
    const current = spans[spans.length - 1];
    if (current && current.month === day.month) {
      current.span += 1;
    } else {
      spans.push({ month: day.month, start: index + 1, span: 1 });
    }
  }

  return spans;
}



function requestVisibleInPlanning(request: Row) {
  const status = String(request.status ?? "");
  return !["cancelled", "refused"].includes(status);
}

function cleaningCoverageForReservation(reservation: Row, requestsByReservationId: Map<string, Row[]>) {
  const linkedRequests = (requestsByReservationId.get(String(reservation.id)) ?? []).filter(requestVisibleInPlanning);

  if (linkedRequests.length === 0) {
    return { cleaningState: "none" as const, cleaningRequest: null as Row | null };
  }

  const accepted =
    linkedRequests.find((request) =>
      ["accepted", "completed", "report_submitted"].includes(String(request.status ?? "")),
    ) ?? null;

  return {
    cleaningState: accepted ? ("accepted" as const) : ("planned" as const),
    cleaningRequest: accepted ?? linkedRequests[0],
  };
}

function buildPlanningReservations({
  reservations,
  requests,
  planningStart,
  planningEnd,
  dailyRows,
  monthlyRows,
  targets,
}: {
  reservations: Row[];
  requests: Row[];
  planningStart: string;
  planningEnd: string;
  dailyRows: Row[];
  monthlyRows: Row[];
  targets: Row[];
}): PlanningReservation[] {
  const maxDay = daysBetween(planningStart, planningEnd) + 1;
  const requestsByReservationId = new Map<string, Row[]>();

  for (const request of requests) {
    if (!requestVisibleInPlanning(request)) continue;
    if (!request.reservation_id) continue;
    const key = String(request.reservation_id);
    const list = requestsByReservationId.get(key) ?? [];
    list.push(request);
    requestsByReservationId.set(key, list);
  }

  return reservations
    .filter((reservation) => reservation.property_id && reservation.checkin_at && reservation.checkout_at)
    .map((reservation) => {
      const checkin = parisDateKey(reservation.checkin_at);
      const checkout = parisDateKey(reservation.checkout_at);
      const displayStart = checkin < planningStart ? planningStart : checkin;
      const displayEnd = checkout > addDays(planningEnd, 1) ? addDays(planningEnd, 1) : checkout;
      const span = Math.max(1, daysBetween(displayStart, displayEnd));
      const price = reservationAmount({ reservation, dailyRows, monthlyRows, targets });
      const nights = Math.max(1, daysBetween(checkin, checkout));
      const coverage = cleaningCoverageForReservation(reservation, requestsByReservationId);
      const missionDate = coverage.cleaningRequest ? requestTimelineDateKey(coverage.cleaningRequest) : null;
      const cleaningDay = missionDate
        ? Math.max(1, Math.min(maxDay, daysBetween(planningStart, missionDate) + 1))
        : null;

      return {
        id: String(reservation.id),
        listingId: String(reservation.property_id),
        guest: checkin < planningStart ? `← ${reservationGuest(reservation)}` : reservationGuest(reservation),
        start: daysBetween(planningStart, displayStart) + 1,
        span,
        price,
        nightly: price > 0 ? Math.round(price / nights) : 0,
        href: reservationHref(reservation),
        cleaningState: coverage.cleaningState,
        cleaningDay,
      };
    })
    .filter((reservation) => reservation.span > 0);
}

function buildMarkers({
  requests,
  cleanersById,
  planningStart,
  planningEnd,
}: {
  requests: Row[];
  cleanersById: Record<string, Row>;
  planningStart: string;
  planningEnd: string;
}): PlanningMarker[] {
  const markers: PlanningMarker[] = [];
  const maxDay = daysBetween(planningStart, planningEnd) + 1;

  for (const request of requests) {
    if (!requestVisibleInPlanning(request)) continue;
    if (!request.property_id) continue;

    const dateKey = requestTimelineDateKey(request);
    if (!dateKey) continue;

    const day = daysBetween(planningStart, dateKey) + 1;
    if (day < 1 || day > maxDay) continue;

    const isIntervention = requestIsIntervention(request);
    const cleaner = cleanersById[String(request.assigned_cleaner_id ?? "")];
    const statusLabel = requestStatusLabel(request);
    const tone = requestTone(request);

    markers.push({
      id: String(request.id),
      listingId: String(request.property_id),
      day,
      icon: isIntervention ? "◆" : "✦",
      tone,
      label: isIntervention ? "intervention" : "ménage",
      href: requestHref(request),
      statusLabel,
      avatarUrl: cleanerPhotoUrl(cleaner),
      avatarInitials: cleanerInitials(cleaner),
    });
  }

  return markers;
}

function buildDailyPrices({
  listings,
  days,
  monthlyRows,
  targets,
}: {
  listings: OwnerCockpitListing[];
  days: PlanningDay[];
  monthlyRows: Row[];
  targets: Row[];
}): DailyPrice[] {
  return listings.flatMap((listing) =>
    days.map((day) => {
      const month = day.key.slice(0, 7);
      const average = averageNightlyForPropertyMonth({
        propertyId: listing.id,
        month,
        monthlyRows,
        targets,
      });

      const fallback = average || Math.round((80 + day.tension * 120) / 5) * 5;

      return {
        listingId: listing.id,
        day: daysBetween(days[0].key, day.key) + 1,
        price: fallback,
      };
    }),
  );
}

function timelineTitleForRequest(request: Row) {
  const label = missionTypeLabel(request);
  const status = String(request.status ?? "");

  if (["completed", "report_submitted", "problem_reported"].includes(status)) {
    return status === "problem_reported" ? `${label} · problème` : `${label} terminé`;
  }

  return label;
}

function timelineDetailForRequest(request: Row, cleanersById: Record<string, Row>) {
  const status = String(request.status ?? "");
  const cleaner = cleanersById[String(request.assigned_cleaner_id ?? "")];
  const cleanerName = cleanerDisplayName(cleaner);

  if (["completed", "report_submitted"].includes(status)) return "Photos et rapport disponibles";
  if (status === "problem_reported") return "Rapport à vérifier";
  if (status === "refused") return "Réattribuer la mission";

  return `${cleanerName || "Intervenante"} · ${requestStatusLabel(request)}`;
}

function buildTimeline({
  reservations,
  requests,
  cleanersById,
  ownerToken,
}: {
  reservations: Row[];
  requests: Row[];
  cleanersById: Record<string, Row>;
  ownerToken: string;
}): TimelineEvent[] {
  const now = Date.now();
  const events: TimelineEvent[] = [];

  for (const reservation of reservations) {
    const listingId = String(reservation.property_id ?? "");
    if (!listingId) continue;

    if (reservation.checkin_at) {
      const eventAt = reservation.checkin_at;
      events.push({
        id: `arrival-${reservation.id}`,
        kind: "arrival",
        side: new Date(eventAt).getTime() < now ? "past" : "future",
        time: timeLabel(eventAt),
        eventAt,
        listingId,
        title: "Arrivée",
        detail: reservationGuest(reservation),
        tone: "orange",
        href: reservationHref(reservation),
      });
    }

    if (reservation.checkout_at) {
      const eventAt = reservation.checkout_at;
      events.push({
        id: `departure-${reservation.id}`,
        kind: "departure",
        side: new Date(eventAt).getTime() < now ? "past" : "future",
        time: timeLabel(eventAt),
        eventAt,
        listingId,
        title: "Départ",
        detail: reservationGuest(reservation),
        tone: "navy",
        href: reservationHref(reservation),
      });
    }
  }

  for (const request of requests) {
    const dateKey = requestTimelineDateKey(request);
    if (!request.property_id || !dateKey) continue;

    const eventAt = request.ready_by_at || request.scheduled_start_at || `${dateKey}T16:00:00.000Z`;
    const status = String(request.status ?? "");
    const cleaner = cleanersById[String(request.assigned_cleaner_id ?? "")];
    const isIntervention = requestIsIntervention(request);
    const tone: Tone = requestTone(request);

    events.push({
      id: `mission-${request.id}`,
      kind: isIntervention ? "intervention" : "cleaning",
      side: new Date(eventAt).getTime() < now ? "past" : "future",
      time: timeLabel(eventAt),
      eventAt,
      listingId: String(request.property_id),
      title: timelineTitleForRequest(request),
      detail: timelineDetailForRequest(request, cleanersById),
      status: requestStatusLabel(request),
      tone,
      href: requestHref(request),
      avatarUrl: cleanerPhotoUrl(cleaner),
      avatarInitials: cleanerInitials(cleaner),
    });
  }

  const past = events
    .filter((event) => event.side === "past")
    .sort((a, b) => a.eventAt.localeCompare(b.eventAt));

  const future = events
    .filter((event) => event.side === "future")
    .sort((a, b) => a.eventAt.localeCompare(b.eventAt));

  return [...past, ...future];
}

function buildOpportunities({ listings }: { listings: OwnerCockpitListing[] }): Opportunity[] {
  const gapOpportunities: Opportunity[] = listings.slice(0, 2).map((listing, index) => {
    const tone: Tone = index === 0 ? "orange" : "mustard";

    return {
      id: `gap-${listing.id}`,
      title: index === 0 ? "Remplir un trou" : "Ajuster le prix",
      listing: listing.name,
      period: index === 0 ? "5 nuits disponibles" : "demande élevée",
      potential: index === 0 ? 620 : 540,
      action: index === 0 ? "Agir maintenant" : "Voir les tarifs",
      tone,
    };
  });

  const directOpportunity: Opportunity = {
    id: "direct-channel",
    title: "Relancer le direct",
    listing: "Tous les logements",
    period: "trafic en hausse",
    potential: 410,
    action: "Préparer l’offre",
    tone: "blue",
  };

  return [...gapOpportunities, directOpportunity].slice(0, 3);
}


async function maybeSignedCleanerImages(supabase: ReturnType<typeof getSupabaseAdmin>, rows: Row[]): Promise<Row[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      profile_photo_signed_url: await signedUrl(supabase, row.profile_photo_bucket, row.profile_photo_path),
    })),
  );
}


async function buildPropertyCoverMap(supabase: ReturnType<typeof getSupabaseAdmin>, photos: Row[]) {
  const coverByPropertyId: Record<string, string | null> = {};

  for (const photo of photos) {
    const propertyId = String(photo.property_id ?? "");
    if (!propertyId || coverByPropertyId[propertyId] !== undefined) continue;
    coverByPropertyId[propertyId] = await signedUrl(supabase, photo.storage_bucket, photo.storage_path);
  }

  return coverByPropertyId;
}


export async function getOwnerCockpitData(ownerTokenParam: string): Promise<OwnerCockpitData> {
  const ownerToken = normaliseToken(ownerTokenParam);
  if (!ownerToken) notFound();

  const supabase = getSupabaseAdmin();

  const { data: owner, error: ownerError } = await supabase
    .from("owners")
    .select("*")
    .eq("public_token", ownerToken)
    .eq("active", true)
    .maybeSingle();

  if (ownerError) {
    throw new Error(`Impossible de charger le propriétaire : ${ownerError.message}`);
  }

  if (!owner) notFound();

  const { data: rawProperties, error: propertiesError } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", owner.id)
    .order("name", { ascending: true });

  if (propertiesError) {
    throw new Error(`Impossible de charger les logements : ${propertiesError.message}`);
  }

  const properties = (rawProperties ?? []) as Row[];
  const propertyIds = properties.map((property) => String(property.id));

  if (propertyIds.length === 0) {
    return {
      owner: { id: owner.id, token: ownerToken, displayName: owner.display_name ?? "Propriétaire" },
      listings: [],
      selectedListingIds: [],
      financial: { realisedRevenue: 0, realisedAtStartOfToday: 0, activeDailyRevenue: 0, grossAnnualRevenue: 0, afterVariables: 0, variableCosts: 0, expenseBreakdownItems: [] },
      monthlyRevenue: MONTH_LABELS.map((month) => ({ month, realised: 0, future: 0, target: 0 })),
      today: todayParisDateKey(),
      planningDays: [],
      monthSpans: [],
      planningReservations: [],
      planningMarkers: [],
      dailyPrices: [],
      timelineEvents: [],
      opportunities: [],
    };
  }

  const today = todayParisDateKey();
  const year = Number(today.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Owner planning: 6 months before and 6 months after today.
  // Do not start at today/month-start only: that clips older stays and creates
  // the visual illusion that lots of reservations start on the same day.
  const planningStart = addMonths(today, -6);
  const planningEnd = addMonths(today, 6);

  const [
    reservationsResult,
    yearReservationsResult,
    requestsResult,
    cleanersResult,
    analyticsDailyResult,
    analyticsMonthlyResult,
    analyticsTargetsResult,
    analyticsExpensesResult,
    propertyPhotosResult,
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select("*")
      .neq("status", "cancelled")
      .in("property_id", propertyIds)
      .lte("checkin_at", toIsoEnd(addDays(planningEnd, 14)))
      .gte("checkout_at", toIsoStart(addDays(planningStart, -14)))
      .order("checkin_at", { ascending: true }),
    supabase
      .from("reservations")
      .select("*")
      .neq("status", "cancelled")
      .in("property_id", propertyIds)
      .lte("checkin_at", toIsoEnd(yearEnd))
      .gte("checkout_at", toIsoStart(yearStart))
      .order("checkin_at", { ascending: true }),
    supabase
      .from("cleaning_requests")
      .select("*")
      .in("property_id", propertyIds)
      .gte("scheduled_start_at", toIsoStart(addDays(planningStart, -14)))
      .lte("scheduled_start_at", toIsoEnd(addDays(planningEnd, 14)))
      .order("scheduled_start_at", { ascending: true }),
    supabase
      .from("cleaners")
      .select("*")
      .order("first_name", { ascending: true }),
    supabase
      .from("analytics_daily_calendar")
      .select("*")
      .gte("date", planningStart)
      .lte("date", planningEnd)
      .order("date", { ascending: true }),
    supabase
      .from("analytics_listing_month_financials")
      .select("*")
      .gte("year_month", yearStart.slice(0, 7))
      .lte("year_month", yearEnd.slice(0, 7))
      .order("year_month", { ascending: true }),
    supabase
      .from("analytics_listing_month_targets")
      .select("*")
      .gte("year_month", yearStart.slice(0, 7))
      .lte("year_month", yearEnd.slice(0, 7)),
    supabase
      .from("analytics_expense_lines")
      .select("*")
      .gte("year_month", yearStart.slice(0, 7))
      .lte("year_month", yearEnd.slice(0, 7)),
    propertyIds.length
      ? supabase
          .from("property_reference_photos")
          .select("*")
          .in("property_id", propertyIds)
          .eq("is_active", true)
          .order("is_cover", { ascending: false })
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const [label, result] of [
    ["réservations", reservationsResult],
    ["réservations annuelles", yearReservationsResult],
    ["missions", requestsResult],
    ["intervenantes", cleanersResult],
    ["analytics jour", analyticsDailyResult],
    ["analytics mois", analyticsMonthlyResult],
    ["objectifs", analyticsTargetsResult],
    ["dépenses", analyticsExpensesResult],
    ["photos logements", propertyPhotosResult],
  ] as const) {
    if ("error" in result && result.error) {
      throw new Error(`Impossible de charger ${label} : ${result.error.message}`);
    }
  }

  const reservations = reservationsResult.data ?? [];
  const yearReservations = yearReservationsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const cleaners = cleanersResult.data ?? [];
  const signedCleaners = await maybeSignedCleanerImages(supabase, cleaners as Row[]);
  const cleanersById = Object.fromEntries(signedCleaners.map((cleaner) => [cleaner.id, cleaner]));

  const coverByPropertyId = await buildPropertyCoverMap(supabase, (propertyPhotosResult.data ?? []) as Row[]);
  const propertiesWithCovers = properties.map((property) => ({
    ...property,
    cover_photo_signed_url: coverByPropertyId[String(property.id)] ?? null,
  }));

  const analyticsDaily = scopedRows(analyticsDailyResult.data ?? [], propertyIds.map(String));
  const analyticsMonthly = scopedRows(analyticsMonthlyResult.data ?? [], propertyIds.map(String));
  const targets = scopedRows(analyticsTargetsResult.data ?? [], propertyIds.map(String));
  const expenses = scopedRows(analyticsExpensesResult.data ?? [], propertyIds.map(String));


  const listings = buildListings({
    properties: propertiesWithCovers,
    monthlyRows: analyticsMonthly,
    yearReservations,
    dailyRows: analyticsDaily,
    targets,
  });
  const monthlyRevenue = buildMonthlyRevenue({
    analyticsMonthly,
    analyticsDaily,
    targets,
    year,
  });
  const financialBase = buildFinancial({
    monthly: monthlyRevenue,
    dailyRows: analyticsDaily,
    expenses,
    yearStart,
    yearEnd,
  });

  const activeReservations = reservations.filter((reservation) =>
    isReservationActiveOnDate(reservation, today),
  );

  const activeDailyRevenueFromReservations = activeReservations
    .reduce((sum, reservation) => sum + reservationDailyRevenue(reservation), 0);

  // Primary rule: active reservations daily rate = reservation value / stay duration.
  // Fallback: if reservation rows do not carry revenue, use today's allocated daily
  // analytics value, which is the same basis as CA réalisé.
  const activeDailyRevenue =
    activeDailyRevenueFromReservations > 0
      ? activeDailyRevenueFromReservations
      : activeReservations.length > 0
        ? dailyAllocatedRevenueForDate(analyticsDaily, today)
        : 0;

  // Start from the value at 00:00 today. The client then adds today's active
  // reservation revenue progressively, second by second.
  const financial = {
    ...financialBase,
    realisedAtStartOfToday: Math.max(0, financialBase.realisedRevenue - activeDailyRevenue),
    activeDailyRevenue,
  };
  const planningDays = buildPlanningDays(planningStart, planningEnd);
  const monthSpans = buildMonthSpans(planningDays);
  const planningReservations = buildPlanningReservations({
    reservations,
    requests,
    planningStart,
    planningEnd,
    dailyRows: analyticsDaily,
    monthlyRows: analyticsMonthly,
    targets,
  });
  const planningMarkers = buildMarkers({ requests, cleanersById, planningStart, planningEnd });
  const dailyPrices = buildDailyPrices({ listings, days: planningDays, monthlyRows: analyticsMonthly, targets });
  const timelineEvents = buildTimeline({ reservations, requests, cleanersById, ownerToken });
  const opportunities = buildOpportunities({ listings });

  return {
    owner: {
      id: owner.id,
      token: ownerToken,
      displayName: owner.display_name ?? "Propriétaire",
      profilePhotoUrl: owner.profile_photo_signed_url ?? null,
    },
    listings,
    selectedListingIds: listings.map((listing) => listing.id),
    financial,
    monthlyRevenue,
    today,
    planningDays,
    monthSpans,
    planningReservations,
    planningMarkers,
    dailyPrices,
    timelineEvents,
    opportunities,
  };
}
