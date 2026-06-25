import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { KpiStrip } from "@/components/owner-planning/KpiStrip";
import { NotificationFeed, type NotificationItem } from "@/components/owner-planning/NotificationFeed";
import { OwnerTimeline } from "@/components/owner-planning/OwnerTimeline";
import { PeriodControl } from "@/components/owner-planning/PeriodControl";
import { PeriodRangeSlider } from "@/components/owner-planning/PeriodRangeSlider";
import {
  addDays,
  compactDateLabel,
  isDateKey,
  manualActionNeeded,
  missingIssueHref,
  parisDateKey,
  requestIssueHref,
  todayParisDateKey,
  toIsoEnd,
  toIsoStart,
  type Row,
} from "@/components/owner-planning/timelineUtils";

export const dynamic = "force-dynamic";

type SearchParams = {
  start?: string;
  end?: string;
  property?: string;
  kpi?: string;
};

function notificationForManualAction(request: Row, property?: Row): NotificationItem {
  const date = request.scheduled_start_at ? compactDateLabel(parisDateKey(request.scheduled_start_at)) : "date à confirmer";

  const title =
    request.schedule_status === "planning_changed"
      ? "Vérifier le planning modifié"
      : request.status === "refused"
        ? "Réattribuer la mission refusée"
        : "Reprendre la mission manuellement";

  const summary =
    request.schedule_status === "planning_changed"
      ? `${property?.name ?? "Logement"} · ${date} · prévenir si besoin.`
      : request.status === "refused"
        ? `${property?.name ?? "Logement"} · ${date} · créer ou réattribuer.`
        : `${property?.name ?? "Logement"} · ${date} · automatisation arrêtée.`;

  return {
    key: `manual-${request.id}`,
    severity: "red",
    title,
    summary,
    meta: "Action",
    href: requestIssueHref(request),
  };
}

function notificationForPending(request: Row, property?: Row): NotificationItem {
  const date = request.scheduled_start_at ? compactDateLabel(parisDateKey(request.scheduled_start_at)) : "date à confirmer";

  return {
    key: `pending-${request.id}`,
    severity: "amber",
    title: "Mission en attente de réponse",
    summary: `${property?.name ?? "Logement"} · ${date} · à surveiller si l’échéance approche.`,
    meta: "Attente",
    href: requestIssueHref(request),
  };
}

function notificationForCompletedReport(
  request: Row,
  property?: Row,
  cleaner?: Row,
): NotificationItem {
  const hasProblem = request.status === "problem_reported";
  const date = request.ready_by_at
    ? compactDateLabel(parisDateKey(request.ready_by_at))
    : request.scheduled_start_at
      ? compactDateLabel(parisDateKey(request.scheduled_start_at))
      : "date à confirmer";

  return {
    key: `report-${request.id}`,
    severity: hasProblem ? "red" : "slate",
    title: hasProblem ? "Problème signalé" : "Ménage terminé",
    summary: `${property?.name ?? "Logement"} · ${date} · ${cleaner ? [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") : "rapport disponible"}.`,
    meta: hasProblem ? "Rapport" : "Prêt",
    href: `/owner/reports/${request.id}`,
  };
}

function paymentMoney(value: unknown): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function paymentCleanerName(request: Row): string {
  return (
    request.cleaner_name_snapshot ||
    request.cleaner_legal_name_snapshot ||
    "Intervenante"
  );
}

function paymentPeriodLabel(request: Row): string {
  if (!request.period_start) return "période à confirmer";

  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${request.period_start}T12:00:00.000Z`));
}

function paymentIsOverdue(request: Row): boolean {
  if (request.status === "overdue") return true;
  if (request.status !== "sent_to_owner") return false;
  if (!request.due_at) return false;

  const due = new Date(request.due_at);
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now();
}

function notificationForPaymentRequest(request: Row): NotificationItem {
  const overdue = paymentIsOverdue(request);

  return {
    key: `payment-${request.id}`,
    severity: overdue ? "red" : "amber",
    title: overdue ? "Paiement en retard" : "Paiement à régler",
    summary: `${paymentCleanerName(request)} · ${paymentPeriodLabel(request)} · ${paymentMoney(request.total_eur)}.`,
    meta: overdue ? "Retard" : "Paiement",
    href: `/owner/payments/${request.public_token}`,
  };
}

export default async function PlanningV2Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const today = todayParisDateKey();
  const start = isDateKey(params?.start) ? params.start : today;
  const rawEnd = isDateKey(params?.end) ? params.end : addDays(start, 29);
  const end = rawEnd < start ? addDays(start, 13) : rawEnd;
  const selectedPropertyId = params?.property || "";
  const selectedKpi = ["annual", "realised", "period", "after_variables"].includes(params?.kpi || "")
    ? params?.kpi
    : undefined;

  const yearStart = `${start.slice(0, 4)}-01-01`;
  const yearEnd = `${start.slice(0, 4)}-12-31`;

  const supabase = getSupabaseAdmin();

  const { data: propertiesData, error: propertiesError } = await supabase
    .from("properties")
    .select("id,name,address,preferred_cleaner_id")
    .order("name", { ascending: true });

  if (propertiesError) {
    throw new Error(`Impossible de charger les logements : ${propertiesError.message}`);
  }

  const properties = propertiesData ?? [];
  const visibleProperties = selectedPropertyId
    ? properties.filter((property) => property.id === selectedPropertyId)
    : properties;
  const visiblePropertyIds = visibleProperties.map((property) => property.id);

  const { data: reservationsData, error: reservationsError } = await supabase
    .from("reservations")
    .select("*")
    .neq("status", "cancelled")
    .lte("checkin_at", toIsoEnd(addDays(end, 2)))
    .gte("checkout_at", toIsoStart(addDays(start, -2)))
    .order("checkin_at", { ascending: true });

  if (reservationsError) {
    throw new Error(`Impossible de charger les réservations : ${reservationsError.message}`);
  }

  const { data: yearReservationsData, error: yearReservationsError } = await supabase
    .from("reservations")
    .select("*")
    .neq("status", "cancelled")
    .lte("checkin_at", toIsoEnd(yearEnd))
    .gte("checkout_at", toIsoStart(yearStart))
    .order("checkin_at", { ascending: true });

  if (yearReservationsError) {
    throw new Error(`Impossible de charger les réservations annuelles : ${yearReservationsError.message}`);
  }

  const { data: requestsData, error: requestsError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .gte("scheduled_start_at", toIsoStart(addDays(start, -2)))
    .lte("scheduled_start_at", toIsoEnd(addDays(end, 2)))
    .order("scheduled_start_at", { ascending: true });

  if (requestsError) {
    throw new Error(`Impossible de charger les missions : ${requestsError.message}`);
  }

  const { data: cleanersData, error: cleanersError } = await supabase
    .from("cleaners")
    .select("*")
    .order("first_name", { ascending: true });

  if (cleanersError) {
    throw new Error(`Impossible de charger les intervenantes : ${cleanersError.message}`);
  }

  const reservations = (reservationsData ?? []).filter((reservation) =>
    visiblePropertyIds.includes(reservation.property_id),
  );
  const yearReservations = (yearReservationsData ?? []).filter((reservation) =>
    visiblePropertyIds.includes(reservation.property_id),
  );
  const requests = (requestsData ?? []).filter((request) =>
    visiblePropertyIds.includes(request.property_id),
  );

  // Notifications are operational and should not disappear just because the calendar period changes.
  // Use a rolling operational watch window instead of the selected planning period.
  const alertStart = addDays(today, -7);
  const alertEnd = addDays(today, 90);

  const { data: alertRequestsData, error: alertRequestsError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .gte("scheduled_start_at", toIsoStart(alertStart))
    .lte("scheduled_start_at", toIsoEnd(alertEnd))
    .order("scheduled_start_at", { ascending: true });

  if (alertRequestsError) {
    throw new Error(`Impossible de charger les alertes missions : ${alertRequestsError.message}`);
  }

  const { data: alertReservationsData, error: alertReservationsError } = await supabase
    .from("reservations")
    .select("*")
    .neq("status", "cancelled")
    .gte("checkout_at", toIsoStart(alertStart))
    .lte("checkout_at", toIsoEnd(alertEnd))
    .order("checkout_at", { ascending: true });

  if (alertReservationsError) {
    throw new Error(`Impossible de charger les alertes réservations : ${alertReservationsError.message}`);
  }

  const alertRequests = (alertRequestsData ?? []).filter((request) =>
    visiblePropertyIds.includes(request.property_id),
  );

  const alertReservations = (alertReservationsData ?? []).filter((reservation) =>
    visiblePropertyIds.includes(reservation.property_id),
  );

  const { data: paymentRequestsData, error: paymentRequestsError } = await supabase
    .from("monthly_payment_requests")
    .select(`
      id,
      public_token,
      status,
      total_eur,
      due_at,
      period_start,
      period_end,
      cleaner_name_snapshot,
      cleaner_legal_name_snapshot,
      owner_recipient_name,
      sent_at,
      created_at
    `)
    .in("status", ["sent_to_owner", "overdue"])
    .order("due_at", { ascending: true });

  if (paymentRequestsError) {
    throw new Error(`Impossible de charger les demandes de paiement : ${paymentRequestsError.message}`);
  }

  const openPaymentRequests = (paymentRequestsData ?? []) as Row[];
  const overduePaymentRequests = openPaymentRequests.filter(paymentIsOverdue);
  const paymentActionCount = openPaymentRequests.length;

  const { data: analyticsDailyData, error: analyticsDailyError } = await supabase
    .from("analytics_daily_calendar")
    .select("*")
    .gte("date", yearStart)
    .lte("date", yearEnd)
    .order("date", { ascending: true });

  if (analyticsDailyError) {
    throw new Error(`Impossible de charger analytics_daily_calendar : ${analyticsDailyError.message}`);
  }

  const { data: analyticsMonthlyData, error: analyticsMonthlyError } = await supabase
    .from("analytics_listing_month_financials")
    .select("*")
    .gte("year_month", yearStart.slice(0, 7))
    .lte("year_month", yearEnd.slice(0, 7))
    .order("year_month", { ascending: true });

  if (analyticsMonthlyError) {
    throw new Error(`Impossible de charger analytics_listing_month_financials : ${analyticsMonthlyError.message}`);
  }

  const { data: analyticsKpisData, error: analyticsKpisError } = await supabase
    .from("analytics_dashboard_kpis")
    .select("*")
    .eq("year", Number(yearStart.slice(0, 4)));

  if (analyticsKpisError) {
    throw new Error(`Impossible de charger analytics_dashboard_kpis : ${analyticsKpisError.message}`);
  }

  const analyticsDaily = (analyticsDailyData ?? []).filter((row) =>
    !row.property_id || visiblePropertyIds.includes(row.property_id),
  );

  const analyticsMonthly = (analyticsMonthlyData ?? []).filter((row) =>
    !row.property_id || visiblePropertyIds.includes(row.property_id),
  );

  const visiblePortfolioIds = Array.from(
    new Set([
      ...analyticsDaily.map((row) => row.portfolio_id).filter(Boolean),
      ...analyticsMonthly.map((row) => row.portfolio_id).filter(Boolean),
    ]),
  );

  const { data: analyticsExpensesData, error: analyticsExpensesError } = await supabase
    .from("analytics_expense_lines")
    .select("*")
    .gte("year_month", yearStart.slice(0, 7))
    .lte("year_month", yearEnd.slice(0, 7));

  if (analyticsExpensesError) {
    throw new Error(`Impossible de charger analytics_expense_lines : ${analyticsExpensesError.message}`);
  }

  const analyticsKpis = (analyticsKpisData ?? []).filter((row) =>
    visiblePortfolioIds.length === 0 || visiblePortfolioIds.includes(row.portfolio_id),
  );

  const analyticsExpenses = (analyticsExpensesData ?? []).filter((row) =>
    !row.property_id || visiblePropertyIds.includes(row.property_id),
  );

  const { data: analyticsTargetsData, error: analyticsTargetsError } = await supabase
    .from("analytics_listing_month_targets")
    .select("*")
    .gte("year_month", yearStart.slice(0, 7))
    .lte("year_month", yearEnd.slice(0, 7));

  if (analyticsTargetsError) {
    throw new Error(`Impossible de charger analytics_listing_month_targets : ${analyticsTargetsError.message}`);
  }

  const analyticsTargets = (analyticsTargetsData ?? []).filter((row) =>
    !row.property_id || visiblePropertyIds.includes(row.property_id),
  );


  const requestIds = Array.from(
    new Set([...requests, ...alertRequests].map((request) => request.id)),
  );

  let outboundRows: Row[] = [];
  if (requestIds.length > 0) {
    const { data: outboundData } = await supabase
      .from("outbound_messages")
      .select("*")
      .in("cleaning_request_id", requestIds)
      .order("created_at", { ascending: false });

    outboundRows = outboundData ?? [];
  }

  const cleaners = await Promise.all(
    (cleanersData ?? []).map(async (cleaner) => {
      if (!cleaner.profile_photo_path) return cleaner;

      const { data } = await supabase.storage
        .from(cleaner.profile_photo_bucket || "cleaner-profile-photos")
        .createSignedUrl(cleaner.profile_photo_path, 60 * 60);

      return {
        ...cleaner,
        profilePhotoSignedUrl: data?.signedUrl ?? null,
      };
    }),
  );

  const cleanersById = Object.fromEntries(cleaners.map((cleaner) => [cleaner.id, cleaner]));
  const propertyById = Object.fromEntries(properties.map((property) => [property.id, property]));

  const outboundByRequestId: Record<string, Row[]> = {};
  for (const message of outboundRows) {
    const key = String(message.cleaning_request_id);
    outboundByRequestId[key] = outboundByRequestId[key] ?? [];
    outboundByRequestId[key].push(message);
  }

  const requestByReservationId = Object.fromEntries(
    requests
      .filter((request) => request.reservation_id)
      .map((request) => [request.reservation_id, request]),
  );

  const checkoutsInRange = reservations.filter((reservation) => {
    if (!reservation.checkout_at) return false;
    const checkout = parisDateKey(reservation.checkout_at);
    return checkout >= start && checkout <= end;
  });

  const missingCleanings = checkoutsInRange.filter((reservation) => {
    const request = requestByReservationId[reservation.id];
    return !request || request.status === "cancelled";
  });

  const alertRequestByReservationId = Object.fromEntries(
    alertRequests
      .filter((request) => request.reservation_id)
      .map((request) => [request.reservation_id, request]),
  );

  const alertMissingCleanings = alertReservations.filter((reservation) => {
    const request = alertRequestByReservationId[reservation.id];
    return !request || request.status === "cancelled";
  });

  const manualActionRequests = alertRequests.filter(manualActionNeeded);
  const pendingRequests = alertRequests.filter((request) =>
    ["created", "sent"].includes(request.status) && !manualActionNeeded(request),
  );

  const smsFailedRequests = alertRequests.filter((request) =>
    (outboundByRequestId[request.id] ?? []).some((message) => message.status === "failed"),
  );

  const completedReportRequests = alertRequests
    .filter((request) =>
      ["report_submitted", "completed", "problem_reported"].includes(request.status),
    )
    .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));

  const notifications: NotificationItem[] = [
    ...openPaymentRequests.map(notificationForPaymentRequest),
    ...completedReportRequests.slice(0, 4).map((request) =>
      notificationForCompletedReport(
        request,
        propertyById[request.property_id],
        cleanersById[request.assigned_cleaner_id],
      ),
    ),
    ...manualActionRequests.map((request) =>
      notificationForManualAction(request, propertyById[request.property_id]),
    ),
    ...alertMissingCleanings.map((reservation) => ({
      key: `missing-${reservation.id}`,
      severity: "red" as const,
      title: "Créer une mission ménage",
      summary: `${propertyById[reservation.property_id]?.name ?? "Logement"} · départ ${compactDateLabel(parisDateKey(reservation.checkout_at))}.`,
      meta: "Manquant",
      href: missingIssueHref(reservation),
    })),
    ...smsFailedRequests.map((request) => ({
      key: `sms-${request.id}`,
      severity: "red" as const,
      title: "Vérifier SMS échoué",
      summary: `${propertyById[request.property_id]?.name ?? "Logement"} · notification non envoyée correctement.`,
      meta: "SMS",
      href: requestIssueHref(request),
    })),
    ...pendingRequests.slice(0, 4).map((request) =>
      notificationForPending(request, propertyById[request.property_id]),
    ),
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-3">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/admin" className="text-sm font-bold text-slate-600">
              ← Back office
            </Link>
            <h1 className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Calendrier central
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {visibleProperties.length === 1
                ? visibleProperties[0]?.name
                : `${visibleProperties.length} logements`} · {compactDateLabel(start)} → {compactDateLabel(end)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <NotificationFeed items={notifications} />

            <nav className="flex max-w-[58vw] gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:max-w-none">
              <Link
                href="/owner/cockpit"
                className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white sm:px-4 sm:text-sm"
              >
                Planning
              </Link>

              <Link
                href="/owner/payments"
                className="relative rounded-full px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 sm:px-4 sm:text-sm"
              >
                Paiements
                {paymentActionCount > 0 && (
                  <span className={`ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black text-white ${overduePaymentRequests.length ? "bg-red-600" : "bg-amber-500"}`}>
                    {paymentActionCount}
                  </span>
                )}
              </Link>

              <Link
                href="/admin/settings"
                className="rounded-full px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 sm:px-4 sm:text-sm"
              >
                Rappels
              </Link>

              <Link
                href="/admin/operations"
                className="rounded-full px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 sm:px-4 sm:text-sm"
              >
                Ancien
              </Link>
            </nav>
          </div>
        </header>

        <KpiStrip
          dailyRows={analyticsDaily}
          monthlyRows={analyticsMonthly}
          kpiRows={analyticsKpis}
          expenseRows={analyticsExpenses}
          targetRows={analyticsTargets}
          start={start}
          end={end}
          selectedKpi={selectedKpi}
          selectedPropertyId={selectedPropertyId}
        />

        <PeriodRangeSlider
          start={start}
          end={end}
          selectedPropertyId={selectedPropertyId}
          properties={visibleProperties}
        />

        <div id="calendar">
          <OwnerTimeline
            properties={properties}
            reservations={reservations}
            requests={requests}
            cleanersById={cleanersById}
            outboundByRequestId={outboundByRequestId}
            start={start}
            end={end}
            selectedPropertyId={selectedPropertyId}
          />
        </div>

        <details className="rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <summary className="cursor-pointer list-none p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Réglages
                </p>
                <p className="text-lg font-black text-slate-950">
                  Période et filtres
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                Ouvrir
              </span>
            </div>
          </summary>

          <div className="border-t border-slate-100 p-4">
            <PeriodControl
              start={start}
              end={end}
              selectedPropertyId={selectedPropertyId}
              properties={properties}
            />
          </div>
        </details>
      </div>
    </main>
  );
}
