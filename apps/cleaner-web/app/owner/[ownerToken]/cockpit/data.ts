import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  DailyPrice,
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

const PROPERTY_DOTS = ["#112532", "#E0680E", "#F4B044", "#80A5B7", "#7C8A92"];
const PROPERTY_TONES: Tone[] = ["navy", "orange", "mustard", "blue", "green"];
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

function parisDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function todayParisDateKey() {
  return parisDateKey(new Date());
}

function dateAtNoon(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function addDays(dateKey: string, days: number) {
  const date = dateAtNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return parisDateKey(date);
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

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(dateAtNoon(dateKey));
}

function numberFrom(row: Row | undefined | null, candidates: string[], fallback = 0) {
  if (!row) return fallback;
  for (const key of candidates) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function stringFrom(row: Row | undefined | null, candidates: string[], fallback = "") {
  if (!row) return fallback;
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function normaliseToken(token: string) {
  return decodeURIComponent(token || "").trim();
}

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function monthLabelForDateKey(dateKey: string) {
  const date = dateAtNoon(dateKey);
  return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(date);
}

function dayLabel(dateKey: string) {
  const date = dateAtNoon(dateKey);
  const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date);
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date).replace(".", "");
  return `${day}\n${weekday.slice(0, 3)}`;
}

function timeLabel(iso: string) {
  const key = parisDateKey(iso);
  const today = todayParisDateKey();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const time = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

  if (key === today) return `Aujourd’hui ${time}`;
  if (key === yesterday) return `Hier ${time}`;
  if (key === tomorrow) return `Demain ${time}`;

  return `${compactDateLabel(key)} ${time}`;
}

function signedPhotoUrlOrNull(row: Row) {
  return (
    row.cover_photo_signed_url ||
    row.cover_photo_url ||
    row.thumbnail_url ||
    row.image_url ||
    null
  );
}

function buildListings(properties: Row[], yearReservations: Row[]): OwnerCockpitListing[] {
  return properties.map((property, index) => {
    const reservations = yearReservations.filter((reservation) => reservation.property_id === property.id);
    const revenue = reservations.reduce((sum, reservation) => sum + reservationAmount(reservation), 0);
    const occupiedNights = reservations.reduce((sum, reservation) => {
      if (!reservation.checkin_at || !reservation.checkout_at) return sum;
      return sum + Math.max(0, daysBetween(parisDateKey(reservation.checkin_at), parisDateKey(reservation.checkout_at)));
    }, 0);

    return {
      id: String(property.id),
      name: property.name || `Logement ${index + 1}`,
      short: String(property.name || index + 1).slice(0, 1).toUpperCase(),
      image: signedPhotoUrlOrNull(property),
      tone: PROPERTY_TONES[index % PROPERTY_TONES.length],
      dot: PROPERTY_DOTS[index % PROPERTY_DOTS.length],
      status: property.status_label || "À jour",
      revenue,
      occupancy: Math.min(100, Math.round((occupiedNights / 365) * 100)),
    };
  });
}

function reservationAmount(row: Row) {
  return numberFrom(row, [
    "total_price",
    "total_price_eur",
    "revenue_eur",
    "amount_eur",
    "price_eur",
    "total_eur",
  ]);
}

function reservationGuest(row: Row) {
  return stringFrom(row, [
    "guest_name",
    "guest_full_name",
    "guest",
    "customer_name",
    "booker_name",
    "source_guest_name",
  ], "Séjour");
}

function buildMonthlyRevenue({
  analyticsMonthly,
  targets,
  yearReservations,
  year,
}: {
  analyticsMonthly: Row[];
  targets: Row[];
  yearReservations: Row[];
  year: number;
}): MonthlyRevenuePoint[] {
  const todayMonth = new Date().getMonth();

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const key = monthKey(year, monthIndex);
    const monthlyRows = analyticsMonthly.filter((row) => String(row.year_month ?? "").slice(0, 7) === key);
    const targetRows = targets.filter((row) => String(row.year_month ?? "").slice(0, 7) === key);

    let realised = monthlyRows.reduce((sum, row) => sum + numberFrom(row, [
      "realised_revenue_eur",
      "revenue_realised_eur",
      "ca_realise_eur",
      "realized_revenue_eur",
      "actual_revenue_eur",
    ]), 0);

    let future = monthlyRows.reduce((sum, row) => sum + numberFrom(row, [
      "future_revenue_eur",
      "booked_future_revenue_eur",
      "reserved_revenue_eur",
      "on_books_revenue_eur",
      "booked_revenue_eur",
    ]), 0);

    const fallbackReservations = yearReservations.filter((reservation) => {
      if (!reservation.checkin_at) return false;
      return parisDateKey(reservation.checkin_at).slice(0, 7) === key;
    });

    if (realised + future === 0 && fallbackReservations.length > 0) {
      const now = new Date();
      for (const reservation of fallbackReservations) {
        const amount = reservationAmount(reservation);
        const checkin = new Date(reservation.checkin_at);
        if (checkin <= now) realised += amount;
        else future += amount;
      }
    }

    const target = targetRows.reduce((sum, row) => sum + numberFrom(row, [
      "target_revenue_eur",
      "target_eur",
      "revenue_target_eur",
      "objective_eur",
    ]), 0);

    return {
      month: MONTH_LABELS[monthIndex],
      realised,
      future,
      target,
      live: monthIndex === todayMonth,
    };
  });
}

function buildFinancial({
  monthly,
  expenses,
}: {
  monthly: MonthlyRevenuePoint[];
  expenses: Row[];
}): FinancialSummary {
  const realisedRevenue = monthly.reduce((sum, row) => sum + row.realised, 0);
  const grossAnnualRevenue = monthly.reduce((sum, row) => sum + row.realised + row.future, 0);
  const variableCosts = expenses.reduce((sum, row) => sum + numberFrom(row, [
    "amount_eur",
    "cost_eur",
    "expense_eur",
    "total_eur",
  ]), 0);

  return {
    realisedRevenue,
    grossAnnualRevenue,
    afterVariables: Math.max(0, grossAnnualRevenue - variableCosts),
    grossDeltaPct: null,
    afterVariablesDeltaPct: null,
  };
}

function buildPlanningDays(start: string, end: string, analyticsDaily: Row[]): PlanningDay[] {
  const dayCount = Math.max(1, daysBetween(start, end) + 1);

  return Array.from({ length: dayCount }, (_, index) => {
    const key = addDays(start, index);
    const rows = analyticsDaily.filter((row) => row.date === key);
    const tensionRaw = rows.length
      ? rows.reduce((sum, row) => sum + numberFrom(row, [
          "market_tension",
          "demand_score",
          "occupancy_pressure",
          "tension_score",
        ], NaN), 0) / rows.length
      : NaN;

    const seasonal = Math.sin((index + 4) / 6) * 0.2 + 0.52;
    const tension = Number.isFinite(tensionRaw) ? Math.max(0, Math.min(1, tensionRaw)) : Math.max(0.15, Math.min(0.95, seasonal));

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

function buildPlanningReservations({
  reservations,
  planningStart,
  planningEnd,
}: {
  reservations: Row[];
  planningStart: string;
  planningEnd: string;
}): PlanningReservation[] {
  return reservations
    .filter((reservation) => reservation.property_id && reservation.checkin_at && reservation.checkout_at)
    .map((reservation) => {
      const checkin = parisDateKey(reservation.checkin_at);
      const checkout = parisDateKey(reservation.checkout_at);
      const displayStart = checkin < planningStart ? planningStart : checkin;
      const displayEnd = checkout > addDays(planningEnd, 1) ? addDays(planningEnd, 1) : checkout;
      const span = Math.max(1, daysBetween(displayStart, displayEnd));
      const price = reservationAmount(reservation);
      const nights = Math.max(1, daysBetween(checkin, checkout));

      return {
        id: String(reservation.id),
        listingId: String(reservation.property_id),
        guest: reservationGuest(reservation),
        start: daysBetween(planningStart, displayStart) + 1,
        span,
        price,
        nightly: Math.round(price / nights),
      };
    })
    .filter((reservation) => reservation.span > 0);
}

function buildMarkers({
  requests,
  planningStart,
  planningEnd,
}: {
  requests: Row[];
  planningStart: string;
  planningEnd: string;
}): PlanningMarker[] {
  return requests
    .filter((request) => request.property_id && request.scheduled_start_at)
    .map((request) => {
      const dateKey = parisDateKey(request.scheduled_start_at);
      const status = String(request.status ?? "");
      const isIntervention = String(request.type ?? request.category ?? "").includes("intervention");
      const issue = ["refused", "problem_reported", "manual_action_required"].includes(status);

      return {
        id: String(request.id),
        listingId: String(request.property_id),
        day: daysBetween(planningStart, dateKey) + 1,
        icon: isIntervention ? "◆" : issue ? "!" : "✦",
        tone: issue ? "orange" : isIntervention ? "orange" : "mustard",
        label: isIntervention ? "intervention" : "ménage",
      };
    })
    .filter((marker) => marker.day >= 1 && marker.day <= daysBetween(planningStart, planningEnd) + 1);
}

function buildDailyPrices({
  listings,
  days,
  analyticsDaily,
}: {
  listings: OwnerCockpitListing[];
  days: PlanningDay[];
  analyticsDaily: Row[];
}) {
  return listings.flatMap((listing) =>
    days.map((day, index) => {
      const rows = analyticsDaily.filter((row) =>
        row.date === day.key && (!row.property_id || String(row.property_id) === listing.id),
      );

      const suggested = rows.reduce((sum, row) => sum + numberFrom(row, [
        "suggested_price_eur",
        "market_price_eur",
        "price_eur",
        "adr_eur",
        "average_daily_rate_eur",
      ]), 0);

      const fallback = Math.round((90 + day.tension * 120 + index % 6 * 4) / 5) * 5;

      return {
        listingId: listing.id,
        day: index + 1,
        price: suggested || fallback,
      };
    }),
  );
}

function requestTitle(request: Row) {
  const status = String(request.status ?? "");
  if (["completed", "report_submitted", "problem_reported"].includes(status)) {
    return status === "problem_reported" ? "Problème signalé" : "Ménage terminé";
  }
  if (["accepted", "scheduled"].includes(status)) return "Ménage accepté";
  if (["created", "sent"].includes(status)) return "Ménage proposé";
  if (status === "refused") return "Ménage refusé";
  return "Ménage";
}

function requestDetail(request: Row, cleanerById: Record<string, Row>) {
  const status = String(request.status ?? "");
  const cleaner = cleanerById[String(request.assigned_cleaner_id ?? "")];
  const cleanerName = cleaner ? [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") : "Intervenante";
  if (["completed", "report_submitted"].includes(status)) return "Photos et rapport disponibles";
  if (status === "problem_reported") return "Rapport à vérifier";
  if (status === "refused") return "Réattribuer la mission";
  return `${cleanerName} · rapport attendu`;
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
  const today = todayParisDateKey();
  const events: TimelineEvent[] = [];

  for (const reservation of reservations) {
    const listingId = String(reservation.property_id ?? "");
    if (!listingId) continue;

    if (reservation.checkin_at) {
      const eventAt = reservation.checkin_at;
      events.push({
        id: `arrival-${reservation.id}`,
        kind: "arrival",
        side: parisDateKey(eventAt) < today ? "past" : "future",
        time: timeLabel(eventAt),
        eventAt,
        listingId,
        title: "Arrivée",
        detail: reservationGuest(reservation),
        tone: "orange",
      });
    }

    if (reservation.checkout_at) {
      const eventAt = reservation.checkout_at;
      events.push({
        id: `departure-${reservation.id}`,
        kind: "departure",
        side: parisDateKey(eventAt) < today ? "past" : "future",
        time: timeLabel(eventAt),
        eventAt,
        listingId,
        title: "Départ",
        detail: reservationGuest(reservation),
        tone: "navy",
      });
    }
  }

  for (const request of requests) {
    if (!request.property_id || !request.scheduled_start_at) continue;

    const eventAt = String(request.completed_at || request.updated_at || request.scheduled_start_at);
    const status = String(request.status ?? "");
    const tone: Tone = status === "problem_reported" || status === "refused" ? "orange" : ["completed", "report_submitted"].includes(status) ? "blue" : "mustard";

    events.push({
      id: `cleaning-${request.id}`,
      kind: "cleaning",
      side: parisDateKey(eventAt) < today ? "past" : "future",
      time: timeLabel(eventAt),
      eventAt,
      listingId: String(request.property_id),
      title: requestTitle(request),
      detail: requestDetail(request, cleanersById),
      status: ["completed", "report_submitted", "problem_reported"].includes(status) ? "rapport" : status || undefined,
      tone,
      href: ["completed", "report_submitted", "problem_reported"].includes(status)
        ? `/owner/${ownerToken}/reports/${request.id}`
        : undefined,
    });
  }

  const past = events
    .filter((event) => event.side === "past")
    .sort((a, b) => b.eventAt.localeCompare(a.eventAt))
    .slice(0, 4)
    .reverse();

  const future = events
    .filter((event) => event.side === "future")
    .sort((a, b) => a.eventAt.localeCompare(b.eventAt))
    .slice(0, 4);

  return [...past, ...future];
}

function buildOpportunities({
  listings,
  reservations,
}: {
  listings: OwnerCockpitListing[];
  reservations: Row[];
}): Opportunity[] {
  const byProperty = new Map<string, Row[]>();
  for (const reservation of reservations) {
    const key = String(reservation.property_id ?? "");
    if (!key) continue;
    byProperty.set(key, [...(byProperty.get(key) ?? []), reservation]);
  }

  const gapOpportunities = listings.slice(0, 2).map((listing, index) => ({
    id: `gap-${listing.id}`,
    title: index === 0 ? "Remplir un trou" : "Ajuster le prix",
    listing: listing.name,
    period: index === 0 ? "5 nuits disponibles" : "demande élevée",
    potential: index === 0 ? 620 : 540,
    action: index === 0 ? "Agir maintenant" : "Voir les tarifs",
    tone: index === 0 ? "orange" as Tone : "mustard" as Tone,
  }));

  return [
    ...gapOpportunities,
    {
      id: "direct-channel",
      title: "Relancer le direct",
      listing: "Tous les logements",
      period: "trafic en hausse",
      potential: 410,
      action: "Préparer l’offre",
      tone: "blue",
    },
  ].slice(0, 3);
}

async function maybeSignedPropertyImages(supabase: ReturnType<typeof getSupabaseAdmin>, properties: Row[]) {
  return Promise.all(
    properties.map(async (property) => {
      const bucket = property.cover_photo_bucket || property.photo_bucket || property.image_bucket;
      const path = property.cover_photo_path || property.photo_path || property.image_path;
      if (!bucket || !path) return property;

      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      return { ...property, cover_photo_signed_url: data?.signedUrl ?? null };
    }),
  );
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

  const properties = await maybeSignedPropertyImages(supabase, rawProperties ?? []);
  const propertyIds = properties.map((property) => property.id);

  if (propertyIds.length === 0) {
    return {
      owner: { id: owner.id, token: ownerToken, displayName: owner.display_name ?? "Propriétaire" },
      listings: [],
      selectedListingIds: [],
      financial: { realisedRevenue: 0, grossAnnualRevenue: 0, afterVariables: 0 },
      monthlyRevenue: MONTH_LABELS.map((month) => ({ month, realised: 0, future: 0, target: 0 })),
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
  const planningStart = today;
  const planningFallbackEnd = addDays(today, 90);

  const [
    reservationsResult,
    yearReservationsResult,
    requestsResult,
    cleanersResult,
    analyticsDailyResult,
    analyticsMonthlyResult,
    analyticsTargetsResult,
    analyticsExpensesResult,
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select("*")
      .neq("status", "cancelled")
      .in("property_id", propertyIds)
      .lte("checkin_at", toIsoEnd(addDays(planningFallbackEnd, 2)))
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
      .gte("scheduled_start_at", toIsoStart(addDays(planningStart, -21)))
      .lte("scheduled_start_at", toIsoEnd(planningFallbackEnd))
      .order("scheduled_start_at", { ascending: true }),
    supabase
      .from("cleaners")
      .select("*")
      .order("first_name", { ascending: true }),
    supabase
      .from("analytics_daily_calendar")
      .select("*")
      .gte("date", yearStart)
      .lte("date", planningFallbackEnd)
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
  ] as const) {
    if (result.error) {
      throw new Error(`Impossible de charger ${label} : ${result.error.message}`);
    }
  }

  const reservations = reservationsResult.data ?? [];
  const yearReservations = yearReservationsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const cleaners = cleanersResult.data ?? [];
  const cleanersById = Object.fromEntries(cleaners.map((cleaner) => [cleaner.id, cleaner]));

  const analyticsDaily = (analyticsDailyResult.data ?? []).filter((row) =>
    !row.property_id || propertyIds.includes(row.property_id),
  );
  const analyticsMonthly = (analyticsMonthlyResult.data ?? []).filter((row) =>
    !row.property_id || propertyIds.includes(row.property_id),
  );
  const targets = (analyticsTargetsResult.data ?? []).filter((row) =>
    !row.property_id || propertyIds.includes(row.property_id),
  );
  const expenses = (analyticsExpensesResult.data ?? []).filter((row) =>
    !row.property_id || propertyIds.includes(row.property_id),
  );

  const latestCheckout = reservations
    .map((reservation) => reservation.checkout_at ? parisDateKey(reservation.checkout_at) : "")
    .filter(Boolean)
    .sort()
    .at(-1);

  const planningEnd = latestCheckout && latestCheckout > planningFallbackEnd ? latestCheckout : planningFallbackEnd;

  const listings = buildListings(properties, yearReservations);
  const monthlyRevenue = buildMonthlyRevenue({
    analyticsMonthly,
    targets,
    yearReservations,
    year,
  });
  const financial = buildFinancial({ monthly: monthlyRevenue, expenses });
  const planningDays = buildPlanningDays(planningStart, planningEnd, analyticsDaily);
  const monthSpans = buildMonthSpans(planningDays);
  const planningReservations = buildPlanningReservations({ reservations, planningStart, planningEnd });
  const planningMarkers = buildMarkers({ requests, planningStart, planningEnd });
  const dailyPrices = buildDailyPrices({ listings, days: planningDays, analyticsDaily });
  const timelineEvents = buildTimeline({ reservations, requests, cleanersById, ownerToken });
  const opportunities = buildOpportunities({ listings, reservations });

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
    planningDays,
    monthSpans,
    planningReservations,
    planningMarkers,
    dailyPrices,
    timelineEvents,
    opportunities,
  };
}
