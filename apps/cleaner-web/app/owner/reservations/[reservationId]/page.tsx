import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import OwnerBottomNav, { OwnerTopNav } from "@/components/owner/OwnerBottomNav";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

const BRAND = {
  navy: "#112532",
  blue: "#80A5B7",
  orange: "#E0680E",
  mustard: "#F4B044",
};

function textValue(row: Row | null | undefined, fields: string[], fallback = "—"): string {
  if (!row) return fallback;

  for (const field of fields) {
    const value = row[field];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }

  return fallback;
}

function numberValue(row: Row | null | undefined, fields: string[]): number | null {
  if (!row) return null;

  for (const field of fields) {
    const value = row[field];
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return null;
}

function euro(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
  }).format(value);
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function dateTime(value: string | null | undefined): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(":", "h");
}

function shortDate(value: string | null | undefined): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function shortDateNoYear(value: string | null | undefined): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function nightsBetween(checkin?: string | null, checkout?: string | null): number | null {
  if (!checkin || !checkout) return null;

  const start = new Date(checkin);
  const end = new Date(checkout);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);

  return Number.isFinite(nights) && nights > 0 ? nights : null;
}

function isPast(value?: string | null) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function isNowBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return false;
  const now = Date.now();
  return new Date(start).getTime() <= now && now < new Date(end).getTime();
}

function statusLabel(value?: string | null): string {
  switch (value) {
    case "confirmed":
      return "Confirmée";
    case "cancelled":
    case "canceled":
      return "Annulée";
    case "accepted":
      return "Acceptée";
    case "created":
      return "Créée";
    case "sent":
      return "Proposée";
    case "completed":
    case "report_submitted":
      return "Terminée";
    case "problem_reported":
      return "Problème";
    case "refused":
      return "Refusée";
    default:
      return value || "—";
  }
}

function statusTone(value?: string | null): string {
  switch (value) {
    case "accepted":
    case "completed":
    case "report_submitted":
      return "bg-emerald-50 text-emerald-800 ring-emerald-100";
    case "created":
    case "sent":
      return "bg-[#FFF5DD] text-[#A45C00] ring-[#F4B044]/25";
    case "cancelled":
    case "refused":
      return "bg-red-50 text-red-800 ring-red-100";
    case "problem_reported":
      return "bg-orange-50 text-orange-900 ring-orange-100";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function lifecycleLabel(value?: string | null): string {
  switch (value) {
    case "before_arrival":
      return "Préparation de l’arrivée";
    case "in_stay":
      return "Séjour en cours";
    case "turnover_today":
      return "Rotation aujourd’hui";
    case "after_checkout":
      return "Après départ";
    case "cancelled":
      return "Réservation annulée";
    default:
      return "Contexte séjour";
  }
}

function riskTone(value?: string | null): string {
  switch (value) {
    case "urgent":
    case "action":
      return "bg-red-50 text-red-900 ring-red-100";
    case "watch":
      return "bg-[#FFF5DD] text-[#A45C00] ring-[#F4B044]/25";
    case "info":
      return "bg-[#EFF6F8] text-[#1E5365] ring-[#80A5B7]/25";
    default:
      return "bg-emerald-50 text-emerald-900 ring-emerald-100";
  }
}


function ownerMissionHref(value?: string | null): string | null {
  if (!value) return null;
  return value.replace("/owner/missions/", "/owner/missions/");
}

function cleanerName(cleaner?: Row | null): string {
  if (!cleaner) return "Non affectée";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || "Intervenante";
}

function guestName(reservation: Row): string {
  const joined = [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ").trim();
  return joined || textValue(reservation, ["guest_name", "guest_full_name", "source_booking_id"], "Séjour");
}

function stripHtml(value?: string | null): string {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractLinks(value?: string | null): string[] {
  if (!value) return [];
  const matches = String(value).match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 4);
}

function directionLabel(value?: string | null): string {
  switch (value) {
    case "guest_to_host":
      return "Voyageur";
    case "host_to_guest":
      return "Hôte";
    case "system":
      return "Système";
    case "internal":
      return "Interne";
    default:
      return "Message";
  }
}

function directionClass(value?: string | null): string {
  switch (value) {
    case "guest_to_host":
      return "bg-white text-[#112532] ring-[#112532]/10";
    case "host_to_guest":
      return "bg-[#EFF6F8] text-[#1E5365] ring-[#80A5B7]/20";
    case "system":
      return "bg-slate-100 text-slate-500 ring-slate-200";
    default:
      return "bg-white text-slate-700 ring-slate-200";
  }
}

async function signedStorageUrl(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bucket?: string | null,
  path?: string | null,
): Promise<string | null> {
  if (!bucket || !path) return null;

  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

function sumRows(rows: Row[], fields: string[]) {
  return rows.reduce((sum, row) => sum + (numberValue(row, fields) ?? 0), 0);
}

function labelForExpense(row: Row) {
  const raw = String(row.category || row.cost_family || row.rule_id || "Variable").toLowerCase();

  if (raw.includes("clean")) return "Ménage";
  if (raw.includes("concierge")) return "Conciergerie";
  if (raw.includes("commission")) return "Commission";
  if (raw.includes("electric") || raw.includes("électric") || raw.includes("energy")) return "Électricité";
  if (raw.includes("water") || raw.includes("eau")) return "Eau";

  return String(row.category || row.cost_family || row.rule_id || "Variable");
}

function median(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function priceAssessment(adr: number | null, benchmarkAdr: number | null) {
  if (!adr || !benchmarkAdr) {
    return {
      label: "Benchmark à construire",
      detail: "Pas encore assez de données comparables pour juger ce prix.",
      tone: "bg-[#EFF6F8] text-[#1E5365] ring-[#80A5B7]/25",
      delta: null as number | null,
    };
  }

  const delta = ((adr - benchmarkAdr) / benchmarkAdr) * 100;

  if (delta >= 15) {
    return {
      label: "Très bon prix",
      detail: `ADR ${Math.round(delta)}% au-dessus de la médiane comparable.`,
      tone: "bg-emerald-50 text-emerald-900 ring-emerald-100",
      delta,
    };
  }

  if (delta >= -8) {
    return {
      label: "Prix cohérent",
      detail: `ADR proche de la médiane comparable (${euro(benchmarkAdr)}/nuit).`,
      tone: "bg-[#EFF6F8] text-[#1E5365] ring-[#80A5B7]/25",
      delta,
    };
  }

  return {
    label: "Prix faible",
    detail: `ADR ${Math.abs(Math.round(delta))}% sous la médiane comparable.`,
    tone: "bg-[#FFF5DD] text-[#A45C00] ring-[#F4B044]/25",
    delta,
  };
}

function financialLine(label: string, value: string, muted = false) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[#112532]/8 py-3 first:border-t-0">
      <span className={`text-sm font-bold ${muted ? "text-[#112532]/45" : "text-[#112532]/62"}`}>
        {label}
      </span>
      <span className={`text-right font-black ${muted ? "text-[#112532]/50" : "text-[#112532]"}`}>
        {value}
      </span>
    </div>
  );
}

function MiniMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-[#112532]/8">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#112532]/38">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#112532]">{value}</p>
      {detail ? <p className="mt-1 text-xs font-bold text-[#112532]/45">{detail}</p> : null}
    </div>
  );
}

function StayCard({ title, reservation }: { title: string; reservation: Row | null }) {
  return (
    <div className="rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#80A5B7]">{title}</p>
      {reservation ? (
        <>
          <p className="mt-2 truncate text-sm font-black text-[#112532]">{guestName(reservation)}</p>
          <p className="mt-1 text-xs font-bold text-[#112532]/52">
            {shortDateNoYear(reservation.checkin_at)} → {shortDateNoYear(reservation.checkout_at)}
          </p>
          <Link href={`/owner/reservations/${reservation.id}`} className="mt-3 inline-flex text-xs font-black text-[#E0680E]">
            Ouvrir →
          </Link>
        </>
      ) : (
        <p className="mt-2 text-sm font-bold text-[#112532]/45">Aucune réservation identifiée.</p>
      )}
    </div>
  );
}

function MissionCard({
  label,
  request,
  cleaner,
  report,
}: {
  label: string;
  request: Row | null;
  cleaner?: Row | null;
  report?: Row | null;
}) {
  if (!request) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-500">{label}</p>
        <p className="mt-2 text-sm font-black text-red-900">Aucune mission liée</p>
        <p className="mt-1 text-xs font-bold text-red-700/70">À vérifier si une rotation est nécessaire.</p>
      </div>
    );
  }

  const requestHref =
    ["completed", "report_submitted", "problem_reported"].includes(String(request.status))
      ? `/owner/reports/${request.id}`
      : `/owner/missions/${request.id}`;

  return (
    <Link href={requestHref} className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#112532]/8 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#80A5B7]">{label}</p>
          <h3 className="mt-2 text-sm font-black text-[#112532]">{request.title || (request.mission_type === "intervention" ? "Intervention" : "Ménage")}</h3>
          <p className="mt-1 text-xs font-bold text-[#112532]/50">{cleanerName(cleaner)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black ring-1 ${statusTone(request.status)}`}>
          {statusLabel(request.status)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs font-bold text-[#112532]/58 sm:grid-cols-2">
        <span>Fenêtre : {dateTime(request.work_window_start_at || request.scheduled_start_at)}</span>
        <span>Prêt avant : {dateTime(request.ready_by_at || request.completion_deadline_at || request.work_window_end_at || request.scheduled_end_at)}</span>
      </div>

      {report ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900 ring-1 ring-emerald-100">
          Rapport reçu · ouvrir le détail →
        </p>
      ) : null}
    </Link>
  );
}

export default async function OwnerReservationPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  await requireAdmin();

  const { reservationId } = await params;
  const supabase = getSupabaseAdmin();

  const reservationResult = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();

  const reservation = reservationResult.data as Row | null;
  if (!reservation) notFound();

  const sourceSystem = textValue(reservation, ["source_system", "source"], "");
  const sourceBookingId = textValue(reservation, ["source_booking_id"], "");

  const [
    propertyResult,
    financialResult,
    coverPhotoResult,
    contextResult,
    cleaningRequestsResult,
    messageResult,
    expenseByBookingResult,
  ] = await Promise.all([
    reservation.property_id
      ? supabase.from("properties").select("*").eq("id", reservation.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sourceSystem && sourceBookingId
      ? supabase
          .from("reservation_financials")
          .select("*")
          .eq("source_system", sourceSystem)
          .eq("source_booking_id", sourceBookingId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    reservation.property_id
      ? supabase
          .from("property_reference_photos")
          .select("*")
          .eq("property_id", reservation.property_id)
          .eq("is_active", true)
          .order("is_cover", { ascending: false })
          .order("display_order", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("reservation_operational_context")
      .select("*")
      .eq("reservation_id", reservation.id)
      .maybeSingle(),
    supabase
      .from("cleaning_requests")
      .select("*")
      .eq("reservation_id", reservation.id)
      .order("created_at", { ascending: true }),
    sourceBookingId
      ? supabase
          .from("reservation_messages")
          .select("*")
          .or(`reservation_id.eq.${reservation.id},source_booking_id.eq.${sourceBookingId}`)
          .order("sent_at", { ascending: false })
          .limit(60)
      : supabase
          .from("reservation_messages")
          .select("*")
          .eq("reservation_id", reservation.id)
          .order("sent_at", { ascending: false })
          .limit(60),
    sourceBookingId
      ? supabase
          .from("analytics_expense_lines")
          .select("*")
          .eq("source_booking_id", sourceBookingId)
      : Promise.resolve({ data: [] }),
  ]);

  const property = propertyResult.data as Row | null;
  const financial = financialResult.data as Row | null;
  const coverPhoto = coverPhotoResult.data as Row | null;
  const context = contextResult.data as Row | null;
  const cleaningRequests = ((cleaningRequestsResult.data ?? []) as Row[]).filter(
    (request) => !["cancelled", "refused"].includes(String(request.status ?? "")),
  );
  const messages = (messageResult.data ?? []) as Row[];
  const expenseLines = (expenseByBookingResult.data ?? []) as Row[];

  const contextIds = [
    context?.previous_reservation_id,
    context?.next_reservation_id,
    context?.preparation_mission_id,
    context?.checkout_mission_id,
    context?.latest_cleaning_report_id,
  ].filter(Boolean);

  const [
    previousReservationResult,
    nextReservationResult,
    preparationMissionResult,
    checkoutMissionResult,
    latestReportResult,
  ] = await Promise.all([
    context?.previous_reservation_id
      ? supabase.from("reservations").select("*").eq("id", context.previous_reservation_id).maybeSingle()
      : Promise.resolve({ data: null }),
    context?.next_reservation_id
      ? supabase.from("reservations").select("*").eq("id", context.next_reservation_id).maybeSingle()
      : Promise.resolve({ data: null }),
    context?.preparation_mission_id
      ? supabase.from("cleaning_requests").select("*").eq("id", context.preparation_mission_id).maybeSingle()
      : Promise.resolve({ data: null }),
    context?.checkout_mission_id
      ? supabase.from("cleaning_requests").select("*").eq("id", context.checkout_mission_id).maybeSingle()
      : Promise.resolve({ data: null }),
    context?.latest_cleaning_report_id
      ? supabase.from("cleaning_reports").select("*").eq("id", context.latest_cleaning_report_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const previousReservation = previousReservationResult.data as Row | null;
  const nextReservation = nextReservationResult.data as Row | null;
  const preparationMission = (preparationMissionResult.data as Row | null) ?? null;
  const checkoutMission =
    (checkoutMissionResult.data as Row | null) ??
    cleaningRequests[0] ??
    null;
  const latestReport = latestReportResult.data as Row | null;

  const allMissionCleanerIds = Array.from(
    new Set(
      [preparationMission, checkoutMission, ...cleaningRequests]
        .map((request) => request?.assigned_cleaner_id)
        .filter(Boolean)
        .map(String),
    ),
  );

  const allRequestIds = Array.from(
    new Set(
      [preparationMission, checkoutMission, ...cleaningRequests]
        .map((request) => request?.id)
        .filter(Boolean)
        .map(String),
    ),
  );

  const [cleanersResult, reportsResult, benchmarkResult] = await Promise.all([
    allMissionCleanerIds.length
      ? supabase.from("cleaners").select("*").in("id", allMissionCleanerIds)
      : Promise.resolve({ data: [] }),
    allRequestIds.length
      ? supabase.from("cleaning_reports").select("*").in("cleaning_request_id", allRequestIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    financial?.listing_name
      ? supabase
          .from("reservation_financials")
          .select("source_booking_id,listing_name,checkin_date,adr_eur,accommodation_revenue_eur,nights,reservation_status")
          .eq("listing_name", financial.listing_name)
          .neq("source_booking_id", sourceBookingId || "__none__")
          .limit(80)
      : Promise.resolve({ data: [] }),
  ]);

  const cleaners = (cleanersResult.data ?? []) as Row[];
  const cleanersById = Object.fromEntries(cleaners.map((cleaner) => [String(cleaner.id), cleaner]));

  const reports = (reportsResult.data ?? []) as Row[];
  const reportsByRequestId: Record<string, Row> = {};
  for (const report of reports) {
    if (!reportsByRequestId[String(report.cleaning_request_id)]) {
      reportsByRequestId[String(report.cleaning_request_id)] = report;
    }
  }

  const coverUrl = await signedStorageUrl(
    supabase,
    coverPhoto?.storage_bucket,
    coverPhoto?.storage_path,
  );

  const nights =
    numberValue(financial, ["nights"]) ??
    numberValue(reservation, ["nights"]) ??
    nightsBetween(reservation.checkin_at, reservation.checkout_at);

  const guestCount =
    numberValue(financial, ["number_of_guests"]) ??
    numberValue(reservation, ["number_of_guests", "guest_count", "guests"]);

  const adultCount = numberValue(reservation, ["num_adult"]);
  const childCount = numberValue(reservation, ["num_child"]);
  const petsCount = numberValue(reservation, ["pets_count"]);

  const grossBooking = numberValue(financial, ["gross_booking_value_eur", "customer_paid_eur", "price_total_eur"]);
  const customerPaid = numberValue(financial, ["customer_paid_eur", "price_total_eur", "gross_booking_value_eur"]);
  const accommodation = numberValue(financial, ["accommodation_revenue_eur"]);
  const hostPayout = numberValue(financial, ["host_payout_eur"]);
  const cleaningFeeCharged = numberValue(financial, ["cleaning_fee_charged_eur"]);
  const touristTax = numberValue(financial, ["tourist_tax_eur"]);
  const channelCommission = numberValue(financial, ["channel_commission_eur"]);
  const adr = numberValue(financial, ["adr_eur"]) ?? (accommodation !== null && nights ? accommodation / nights : null);

  const cleanerCost = sumRows(cleaningRequests, ["total_cost_eur", "cleaning_cost_eur", "amount_eur"]);
  const expenseByLabel = new Map<string, number>();
  for (const line of expenseLines) {
    const label = labelForExpense(line);
    const value = numberValue(line, ["expense_amount", "amount_per_day"]) ?? 0;
    expenseByLabel.set(label, (expenseByLabel.get(label) ?? 0) + value);
  }

  if (cleanerCost && !expenseByLabel.has("Ménage")) {
    expenseByLabel.set("Ménage", cleanerCost);
  }

  const otherVariableCosts = Array.from(expenseByLabel.entries()).reduce((sum, [label, value]) => {
    if (label === "Ménage") return sum;
    return sum + value;
  }, 0);

  const netAfterKnownVariables =
    (hostPayout ?? grossBooking ?? 0)
    - (cleanerCost || 0)
    - otherVariableCosts;

  const benchmarkRows = ((benchmarkResult.data ?? []) as Row[]).filter((row) => {
    const status = String(row.reservation_status ?? "").toLowerCase();
    return !status.includes("cancel");
  });

  const benchmarkAdr = median(
    benchmarkRows
      .map((row) => numberValue(row, ["adr_eur"]) ?? (
        numberValue(row, ["accommodation_revenue_eur"]) && numberValue(row, ["nights"])
          ? (numberValue(row, ["accommodation_revenue_eur"]) ?? 0) / (numberValue(row, ["nights"]) ?? 1)
          : null
      ))
      .filter((value): value is number => value !== null && Number.isFinite(value)),
  );

  const price = priceAssessment(adr, benchmarkAdr);

  const displayPropertyName = property?.name ?? financial?.property_name ?? "Logement";
  const displayListingName = financial?.listing_name ?? displayPropertyName;
  const displaySource = financial?.booking_channel ?? reservation.channel ?? reservation.api_source ?? reservation.source_system ?? "Source inconnue";
  const lifecycleState =
    context?.lifecycle_state ??
    (isPast(reservation.checkout_at)
      ? "after_checkout"
      : isNowBetween(reservation.checkin_at, reservation.checkout_at)
        ? "in_stay"
        : "before_arrival");

  const primaryTitle =
    context?.primary_title ??
    (lifecycleState === "after_checkout"
      ? "Rapport après départ"
      : lifecycleState === "in_stay"
        ? "Séjour en cours"
        : "Préparation de l’arrivée");

  const primarySummary =
    context?.primary_summary ??
    "Le contexte opérationnel sera enrichi à la prochaine synchronisation.";

  const primaryRisk = context?.risk_level ?? "info";

  const latestGuestMessages = messages.filter((message) => message.direction === "guest_to_host");
  const unreadGuestMessages = latestGuestMessages.filter((message) => !message.read_at && message.raw_payload?.read === false);

  return (
    <main className="min-h-screen bg-[#F6F3EF] text-[#112532]">
      <section className="relative overflow-hidden bg-[#112532] text-white">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-58"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#112532] via-[#163444] to-[#80A5B7]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#112532] via-[#112532]/68 to-[#112532]/22" />

        <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-5 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white/8 p-2 backdrop-blur-md ring-1 ring-white/12">
            <OwnerTopNav active="reservations" />
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-white/55">
                {displayListingName}
              </p>
              <h1 className="mt-2 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
                {guestName(reservation)}
              </h1>
              <p className="mt-3 text-base font-bold text-white/76">
                {dateTime(reservation.checkin_at)} → {dateTime(reservation.checkout_at)}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#112532]">
                  {statusLabel(reservation.status)}
                </span>
                <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black text-white ring-1 ring-white/20">
                  {displaySource}
                </span>
                <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black text-white ring-1 ring-white/20">
                  Réf. {sourceBookingId || "—"}
                </span>
              </div>
            </div>

            <div className="rounded-[1.7rem] bg-white/12 p-4 backdrop-blur-md ring-1 ring-white/18">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Synthèse séjour</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/12 p-3">
                  <p className="text-[10px] font-bold text-white/45">Nuits</p>
                  <p className="mt-1 text-2xl font-black">{nights ?? "—"}</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-3">
                  <p className="text-[10px] font-bold text-white/45">Voyageurs</p>
                  <p className="mt-1 text-2xl font-black">{guestCount ?? "—"}</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-3">
                  <p className="text-[10px] font-bold text-white/45">ADR</p>
                  <p className="mt-1 text-2xl font-black">{euro(adr)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className={`rounded-[2rem] p-5 shadow-sm ring-1 ${riskTone(primaryRisk)}`}>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
                {lifecycleLabel(lifecycleState)}
              </p>
              <h2 className="mt-2 text-2xl font-black">{primaryTitle}</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold opacity-75">{primarySummary}</p>
            </div>

            {context?.primary_action_href ? (
              <Link href={ownerMissionHref(context.primary_action_href) || context.primary_action_href} className="rounded-full bg-[#112532] px-5 py-3 text-sm font-black text-white">
                {context.primary_action_label || "Ouvrir"}
              </Link>
            ) : null}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniMetric label="CA brut" value={euro(grossBooking)} detail={displaySource} />
          <MiniMetric label="Net connu" value={euro(netAfterKnownVariables)} detail="Après variables connues" />
          <MiniMetric label="Prix / marché" value={price.label} detail={price.delta !== null ? `${Math.round(price.delta)}% vs médiane` : "À enrichir"} />
          <MiniMetric label="Messages voyageurs" value={`${latestGuestMessages.length}`} detail={unreadGuestMessages.length ? `${unreadGuestMessages.length} non lus` : "Aucun non lu"} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-[#112532]/8">
            <div className="bg-[#112532] p-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">Financier propriétaire</p>
                  <h2 className="mt-2 text-2xl font-black">Valeur et rentabilité</h2>
                </div>
                <span className={`rounded-full px-3 py-2 text-xs font-black ring-1 ${price.tone}`}>
                  {price.label}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold text-white/45">Client payé / CA brut</p>
                  <p className="mt-1 text-3xl font-black">{euro(customerPaid ?? grossBooking)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-white/45">Hébergement</p>
                  <p className="mt-1 text-3xl font-black">{euro(accommodation)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-white/45">ADR</p>
                  <p className="mt-1 text-3xl font-black">{euro(adr)}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div>
                {financialLine("Reversement hôte", euro(hostPayout))}
                {financialLine("Frais de ménage facturés", euro(cleaningFeeCharged))}
                {financialLine("Taxe de séjour", euro(touristTax), true)}
                {financialLine("Commission canal", euro(channelCommission), true)}
                {financialLine("Canal", displaySource, true)}
              </div>

              <div>
                {financialLine("Coût ménage prévu", euro(cleanerCost))}
                {Array.from(expenseByLabel.entries())
                  .filter(([label]) => label !== "Ménage")
                  .map(([label, value]) => financialLine(label, euro(value), true))}
                {financialLine("Net après variables connues", euro(netAfterKnownVariables), false)}
                {financialLine("Médiane comparable", euro(benchmarkAdr), true)}
              </div>
            </div>

            <div className="mx-5 mb-5 rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">
              <p className="text-sm font-black text-[#112532]">Lecture prix</p>
              <p className="mt-1 text-sm font-bold text-[#112532]/58">{price.detail}</p>
            </div>
          </article>

          <article className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Détails séjour</p>
                <h2 className="mt-2 text-2xl font-black text-[#112532]">Brief opérationnel</h2>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F4F8FA] p-3">
                <dt className="font-black text-[#112532]/40">Arrivée</dt>
                <dd className="mt-1 font-bold">{dateTime(reservation.checkin_at)}</dd>
              </div>
              <div className="rounded-2xl bg-[#F4F8FA] p-3">
                <dt className="font-black text-[#112532]/40">Départ</dt>
                <dd className="mt-1 font-bold">{dateTime(reservation.checkout_at)}</dd>
              </div>
              <div className="rounded-2xl bg-[#F4F8FA] p-3">
                <dt className="font-black text-[#112532]/40">Adultes / enfants</dt>
                <dd className="mt-1 font-bold">{adultCount ?? "—"} / {childCount ?? "—"}</dd>
              </div>
              <div className="rounded-2xl bg-[#F4F8FA] p-3">
                <dt className="font-black text-[#112532]/40">Langue / pays</dt>
                <dd className="mt-1 font-bold">{textValue(reservation, ["guest_language"], "—")} · {textValue(reservation, ["guest_country"], "—")}</dd>
              </div>
              <div className="rounded-2xl bg-[#F4F8FA] p-3">
                <dt className="font-black text-[#112532]/40">Animaux</dt>
                <dd className="mt-1 font-bold">{petsCount !== null ? petsCount : "—"}</dd>
              </div>
              <div className="rounded-2xl bg-[#F4F8FA] p-3">
                <dt className="font-black text-[#112532]/40">Créée</dt>
                <dd className="mt-1 font-bold">{shortDate(reservation.booking_time || reservation.created_at)}</dd>
              </div>
            </dl>

            {textValue(reservation, ["guest_comments", "special_requests", "internal_notes"], "") ? (
              <div className="mt-4 rounded-2xl bg-[#FFF5DD] p-4 text-sm font-bold text-[#8A4D00] ring-1 ring-[#F4B044]/25">
                {textValue(reservation, ["guest_comments", "special_requests", "internal_notes"], "")}
              </div>
            ) : null}
          </article>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Avant / après</p>
            <h2 className="mt-2 text-2xl font-black text-[#112532]">Contexte de rotation</h2>

            <div className="mt-5 grid gap-3">
              <StayCard title="Réservation précédente" reservation={previousReservation} />
              <StayCard title="Réservation suivante" reservation={nextReservation} />
            </div>
          </article>

          <article className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Missions liées</p>
                <h2 className="mt-2 text-2xl font-black text-[#112532]">Préparation, départ et rapport</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <MissionCard
                label="Mission de préparation"
                request={preparationMission}
                cleaner={preparationMission?.assigned_cleaner_id ? cleanersById[String(preparationMission.assigned_cleaner_id)] : null}
                report={preparationMission?.id ? reportsByRequestId[String(preparationMission.id)] : null}
              />
              <MissionCard
                label="Mission après départ"
                request={checkoutMission}
                cleaner={checkoutMission?.assigned_cleaner_id ? cleanersById[String(checkoutMission.assigned_cleaner_id)] : null}
                report={checkoutMission?.id ? (latestReport ?? reportsByRequestId[String(checkoutMission.id)]) : null}
              />
            </div>

            {cleaningRequests.length > 1 ? (
              <div className="mt-4 rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">
                <p className="text-sm font-black">Toutes les missions associées</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cleaningRequests.map((request) => (
                    <Link key={request.id} href={`/owner/missions/${request.id}`} className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#112532] ring-1 ring-[#112532]/8">
                      {request.title || request.mission_type || "Mission"} · {statusLabel(request.status)}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Correspondance</p>
              <h2 className="mt-2 text-2xl font-black text-[#112532]">Messages voyageur / hôte</h2>
              <p className="mt-1 text-sm font-bold text-[#112532]/50">
                Messages Beds24 / OTA synchronisés. Les messages les plus récents sont affichés en premier.
              </p>
            </div>

            <span className="rounded-full bg-[#F4F8FA] px-4 py-2 text-xs font-black text-[#112532]/58 ring-1 ring-[#112532]/6">
              {messages.length} messages
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-[#F4F8FA] p-5 text-sm font-bold text-[#112532]/50">
                Aucun message synchronisé pour cette réservation.
              </div>
            ) : (
              messages.slice(0, 24).map((message) => {
                const body = stripHtml(message.body_text || message.body);
                const links = extractLinks(message.body || message.body_text);
                return (
                  <div key={message.id} className={`rounded-[1.4rem] p-4 ring-1 ${directionClass(message.direction)}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="rounded-full bg-[#112532]/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#112532]/50">
                          {directionLabel(message.direction)}
                        </span>
                        <p className="mt-2 text-xs font-bold text-[#112532]/45">
                          {dateTime(message.sent_at || message.received_at)}
                        </p>
                      </div>
                      {message.raw_payload?.read === false ? (
                        <span className="rounded-full bg-[#FFF5DD] px-3 py-1 text-[10px] font-black text-[#A45C00] ring-1 ring-[#F4B044]/25">
                          Non lu
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-[#112532]/76">
                      {body || "Message sans texte."}
                    </p>

                    {links.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {links.map((link) => (
                          <a key={link} href={link} target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#E0680E] ring-1 ring-[#E0680E]/15">
                            Pièce jointe / lien →
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
      <OwnerBottomNav active="reservations" />
    </main>
  );
}
