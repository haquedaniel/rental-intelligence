import Link from "next/link";
import { notFound } from "next/navigation";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getCleanerLocale, t, type CleanerLocale } from "@/lib/cleanerI18n";
import type { Metadata } from "next";

type Row = Record<string, any>;

type CleanerPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function generateMetadata({
  params,
}: CleanerPageProps): Promise<Metadata> {
  const { token } = await params;

  return {
    title: "Pilotys",
    applicationName: "Pilotys",
    manifest: `/cleaner/${token}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: "Pilotys",
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        {
          url: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: "/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
  };
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function numberValue(row: Row | null | undefined, fields: string[]): number | null {
  if (!row) return null;

  for (const field of fields) {
    const raw = row[field];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

function textValue(row: Row | null | undefined, fields: string[], fallback = "—"): string {
  if (!row) return fallback;

  for (const field of fields) {
    const raw = row[field];
    if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
      return String(raw);
    }
  }

  return fallback;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(":", "h");
}

function dayLabel(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function cleanerName(cleaner: Row, locale: CleanerLocale = "fr"): string {
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || t(locale, "common.cleanerFallback");
}

function cleanerInitials(cleaner: Row): string {
  const first = cleaner.first_name?.[0] ?? "";
  const last = cleaner.last_name?.[0] ?? "";
  return `${first}${last}` || "I";
}

function cleanerDisplayName(cleaner: Row): string {
  const first = String(cleaner.first_name ?? "").trim();
  const last = String(cleaner.last_name ?? "").trim();
  const fullName = [first, last].filter(Boolean).join(" ");

  return (
    fullName ||
    textValue(cleaner, ["trading_name", "legal_name", "name"], "votre espace")
  );
}

function cleanerGreetingName(cleaner: Row): string {
  const first = String(cleaner.first_name ?? "").trim();
  if (first) return first;

  return cleanerDisplayName(cleaner);
}

function cleanerWelcomeSubtitle(cleaner: Row): string {
  const city = textValue(cleaner, ["city", "home_city", "base_city", "area"], "");

  if (city !== "—" && city.trim()) {
    return `Vos missions autour de ${city}`;
  }

  return "Vos missions, votre planning et vos paiements";
}

function propertyName(property?: Row | null, locale: CleanerLocale = "fr"): string {
  return property?.name || t(locale, "common.propertyFallback");
}

function guestName(reservation?: Row | null, locale: CleanerLocale = "fr"): string {
  return reservation?.guest_name || reservation?.source_booking_id || t(locale, "common.stayFallback");
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

function isOverdue(request: Row, hasReport: boolean): boolean {
  if (hasReport) return false;
  if (request.status !== "accepted") return false;

  const anchor = parseDate(anchorAt(request));
  if (!anchor) return false;

  return anchor.getTime() < Date.now();
}

function missionHref(request: Row): string {
  if (!request.public_token) return "#";

  if (["created", "sent"].includes(request.status)) {
    return `/mission/${request.public_token}/ready-day`;
  }

  return `/mission/${request.public_token}/report`;
}

function statusLabel(request: Row, overdue: boolean, locale: CleanerLocale = "fr"): string {
  if (overdue) return t(locale, "status.overdue");

  switch (request.status) {
    case "created":
      return t(locale, "status.toConfirm");
    case "sent":
      return t(locale, "status.offered");
    case "accepted":
      return t(locale, "status.confirmed");
    case "report_submitted":
    case "completed":
      return t(locale, "status.completed");
    case "problem_reported":
      return t(locale, "status.problem");
    case "cancelled":
      return t(locale, "status.cancelled");
    case "refused":
      return t(locale, "status.refused");
    default:
      return request.status || t(locale, "common.missionFallback");
  }
}

function statusClass(request: Row, overdue: boolean): string {
  if (overdue) return "bg-red-100 text-red-800 ring-red-200";

  switch (request.status) {
    case "created":
    case "sent":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "accepted":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "report_submitted":
    case "completed":
      return "bg-slate-950 text-white ring-slate-950";
    case "problem_reported":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

async function signedUrl(supabase: any, bucket?: string | null, path?: string | null): Promise<string | null> {
  if (!bucket || !path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

function missionAmount(request: Row): number {
  return (
    numberValue(request, ["total_cost_eur", "cleaning_cost_eur", "amount_eur"]) ??
    0
  );
}

function parisDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthKey(date = new Date()): string {
  return parisDateKey(date).slice(0, 7);
}

function shortDay(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
  }).format(date).replace(".", "");
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

function missionMonthKey(request: Row): string | null {
  const anchor = parseDate(anchorAt(request));
  if (!anchor) return null;
  return monthKey(anchor);
}


function MiniCleanerCalendar({
  reservations,
  requests,
  propertiesById,
  locale,
}: {
  reservations: Row[];
  requests: Row[];
  propertiesById: Record<string, Row>;
  locale: CleanerLocale;
}) {
  const today = parisDateKey(new Date());
  const units = Array.from({ length: 21 }, (_, index) => addDays(today, index));
  const gridTemplateColumns = `repeat(${units.length}, 34px)`;

  const visibleReservations = reservations.filter((reservation) => {
    if (!reservation.checkin_at || !reservation.checkout_at) return false;
    const checkin = parisDateKey(new Date(reservation.checkin_at));
    const checkout = parisDateKey(new Date(reservation.checkout_at));
    return checkout >= units[0] && checkin <= units[units.length - 1];
  });

  const visibleRequests = requests.filter((request) => {
    const anchor = parseDate(anchorAt(request));
    if (!anchor) return false;
    const key = parisDateKey(anchor);
    return key >= units[0] && key <= units[units.length - 1];
  });

  return (
    <section className="rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">{t(locale, "calendar.miniTitle")}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {t(locale, "calendar.homeSubtitle")}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
          {t(locale, "calendar.twentyOneDays")}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-max space-y-2">
          <div className="grid gap-1" style={{ gridTemplateColumns }}>
            {units.map((dateKey) => (
              <div key={dateKey} className="rounded-xl bg-slate-50 px-1 py-1 text-center">
                <p className="text-[8px] font-black uppercase text-slate-400">
                  {shortDay(dateKey).slice(0, 3)}
                </p>
                <p className="mt-0.5 text-[10px] font-black text-slate-900">
                  {dateKey.slice(8, 10)}
                </p>
              </div>
            ))}
          </div>

          <div className="relative rounded-2xl bg-slate-50 p-1.5">
            <div className="absolute inset-1.5 grid gap-1" style={{ gridTemplateColumns }}>
              {units.map((dateKey) => (
                <div key={`${dateKey}-bg`} className="rounded-xl bg-white/65" />
              ))}
            </div>

            <div className="relative grid min-h-10 gap-1" style={{ gridTemplateColumns }}>
              {visibleReservations.map((reservation) => {
                const checkin = parisDateKey(new Date(reservation.checkin_at));
                const checkout = parisDateKey(new Date(reservation.checkout_at));
                const span = spanForCalendar(checkin, checkout, units);
                if (!span) return null;

                return (
                  <div
                    key={reservation.id}
                    className="z-10 rounded-xl bg-slate-900 px-2 py-1 text-white shadow-sm"
                    style={{ gridColumn: `${span.start} / span ${span.span}` }}
                    title={`${guestName(reservation, locale)} · ${propertyName(propertiesById[String(reservation.property_id)], locale)}`}
                  >
                    <p className="truncate text-[10px] font-black">{guestName(reservation, locale)}</p>
                    <p className="truncate text-[8px] font-bold text-white/60">
                      {propertyName(propertiesById[String(reservation.property_id)], locale)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-1 rounded-2xl bg-slate-50 p-1.5" style={{ gridTemplateColumns }}>
            {units.map((dateKey) => {
              const dayRequests = visibleRequests.filter((request) => {
                const anchor = parseDate(anchorAt(request));
                return anchor ? parisDateKey(anchor) === dateKey : false;
              });

              return (
                <div
                  key={`${dateKey}-missions`}
                  className={`flex min-h-10 flex-col items-center justify-center gap-1 rounded-xl ${
                    dayRequests.length ? "bg-white p-1 ring-1 ring-white" : ""
                  }`}
                >
                  {dayRequests.map((request) => {
                    const overdue = isOverdue(request, false);
                    return (
                      <Link
                        key={request.id}
                        href={missionHref(request)}
                        className={`w-full rounded-lg px-1 py-1 text-center text-[8px] font-black leading-tight ring-1 ${statusClass(request, overdue)}`}
                        title={`${propertyName(propertiesById[String(request.property_id)], locale)} · ${statusLabel(request, overdue, locale)} · ${dateLabel(anchorAt(request))}`}
                      >
                        {request.status === "accepted" ? t(locale, "common.ok") : t(locale, "status.toConfirm")}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function sectionTitle(title: string, subtitle?: string) {
  return (
    <div>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {subtitle && <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>}
    </div>
  );
}


function urgencyBadge(request: Row): string | null {
  const amount =
    numberValue(request, [
      "urgency_bonus_eur",
      "urgent_bonus_eur",
      "urgency_fee_eur",
      "urgent_fee_eur",
    ]) ?? 0;

  const hasUrgency =
    amount > 0 ||
    request.urgent === true ||
    request.is_urgent === true ||
    request.urgency === true ||
    request.schedule_status === "urgent";

  if (!hasUrgency) return null;
  if (amount > 0) return `Prime urgence +${money(amount)}`;
  return "Prime urgence";
}

function dateChoiceBadge(request: Row): string | null {
  if (!["created", "sent"].includes(request.status)) {
    if (request.status === "accepted") return "Rapport à envoyer";
    return null;
  }

  const start = parseDate(
    request.work_window_start_at ||
      request.scheduled_start_at ||
      request.ready_from_at ||
      request.checkout_at,
  );

  const deadline = parseDate(
    request.completion_deadline_at ||
      request.ready_by_at ||
      request.work_window_end_at ||
      request.scheduled_end_at,
  );

  if (!start || !deadline) return "Date à choisir";

  const hours = (deadline.getTime() - start.getTime()) / (1000 * 60 * 60);

  if (hours <= 28) {
    return "Date imposée · arrivée proche";
  }

  return "Date à choisir";
}

function MissionCard({
  request,
  property,
  reservation,
  hasReport,
  thumbnailUrl,
}: {
  request: Row;
  property?: Row | null;
  reservation?: Row | null;
  hasReport: boolean;
  thumbnailUrl?: string | null;
  locale?: unknown;
}) {
  const overdue = isOverdue(request, hasReport);
  const amount = missionAmount(request);
  const urgency = urgencyBadge(request);
  const dateChoice = dateChoiceBadge(request);
  const title = propertyName(property);

  return (
    <Link
      href={missionHref(request)}
      className="block overflow-hidden rounded-[1.35rem] bg-white shadow-sm ring-1 ring-slate-200 transition active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.15rem] bg-slate-100">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-900 text-2xl font-black text-white">
              {title.slice(0, 1)}
            </div>
          )}

          {overdue && (
            <div className="absolute inset-x-1 bottom-1 rounded-full bg-red-600 px-2 py-1 text-center text-[9px] font-black uppercase text-white">
              Retard
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${statusClass(
                request,
                overdue,
              )}`}
            >
              {statusLabel(request, overdue)}
            </span>

            {urgency && (
              <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black text-orange-900 ring-1 ring-orange-200">
                {urgency}
              </span>
            )}
          </div>

          <h3 className="mt-2 truncate text-base font-black text-slate-950">
            {title}
          </h3>

          <div className="mt-1 flex min-w-0 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-500">
              {guestName(reservation)}
            </p>
            <span className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">
              {money(amount)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-100">
              Prêt avant {dateLabel(anchorAt(request))}
            </span>

            {dateChoice && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-800 ring-1 ring-blue-100">
                {dateChoice}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-slate-100 bg-slate-100 text-[10px] font-black text-slate-500">
        <div className="bg-white px-3 py-2">
          <p className="uppercase text-slate-400">Durée</p>
          <p className="mt-0.5 text-slate-900">{request.estimated_hours ?? "—"} h</p>
        </div>

        <div className="bg-white px-3 py-2">
          <p className="uppercase text-slate-400">Linge</p>
          <p className="mt-0.5 text-slate-900">{request.linen_required ? "Oui" : "Non"}</p>
        </div>

        <div className="bg-white px-3 py-2">
          <p className="uppercase text-slate-400">Rapport</p>
          <p className="mt-0.5 text-slate-900">{hasReport ? "Reçu" : "À faire"}</p>
        </div>
      </div>
    </Link>
  );
}

export default async function CleanerHomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const cleanerResult = await supabase
    .from("cleaners")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  const cleaner = cleanerResult.data as Row | null;
  if (!cleaner) notFound();

  const locale = getCleanerLocale(cleaner.preferred_language);

  const cleanerPhotoUrl = await signedUrl(
    supabase,
    cleaner.profile_photo_bucket,
    cleaner.profile_photo_path,
  );

  const requestsResult = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("assigned_cleaner_id", cleaner.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(80);

  const requests = (requestsResult.data ?? []) as Row[];

  const propertyIds = [...new Set(requests.map((request) => request.property_id).filter(Boolean))];
  const reservationIds = [...new Set(requests.map((request) => request.reservation_id).filter(Boolean))];
  const requestIds = requests.map((request) => request.id).filter(Boolean);

  const calendarStart = new Date();
  calendarStart.setDate(calendarStart.getDate() - 1);
  const calendarEnd = new Date();
  calendarEnd.setDate(calendarEnd.getDate() + 22);

  const [propertiesResult, reservationsResult, calendarReservationsResult, reportsResult, paymentsResult, photosResult] =
    await Promise.all([
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
      requestIds.length
        ? supabase.from("cleaning_reports").select("*").in("cleaning_request_id", requestIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("payment_requests")
        .select("*")
        .eq("cleaner_id", cleaner.id)
        .order("created_at", { ascending: false })
        .limit(5),
      propertyIds.length
        ? supabase
            .from("property_reference_photos")
            .select("*")
            .in("property_id", propertyIds)
            .eq("is_active", true)
            .order("is_cover", { ascending: false })
            .order("display_order", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

  const propertiesById = Object.fromEntries(
    ((propertiesResult.data ?? []) as Row[]).map((property) => [String(property.id), property]),
  );

  const reservationsById = Object.fromEntries(
    ((reservationsResult.data ?? []) as Row[]).map((reservation) => [String(reservation.id), reservation]),
  );

  const calendarReservations = (calendarReservationsResult.data ?? []) as Row[];

  const reportsByRequestId: Record<string, Row[]> = {};
  for (const report of (reportsResult.data ?? []) as Row[]) {
    const key = String(report.cleaning_request_id);
    reportsByRequestId[key] = reportsByRequestId[key] ?? [];
    reportsByRequestId[key].push(report);
  }

  const coverByPropertyId: Record<string, string | null> = {};
  for (const photo of (photosResult.data ?? []) as Row[]) {
    const propertyId = String(photo.property_id);
    if (coverByPropertyId[propertyId] !== undefined) continue;
    coverByPropertyId[propertyId] = await signedUrl(supabase, photo.storage_bucket, photo.storage_path);
  }

  const payments = paymentsResult.error ? [] : ((paymentsResult.data ?? []) as Row[]);

  const enriched = requests
    .map((request) => ({
      request,
      property: propertiesById[String(request.property_id)],
      reservation: reservationsById[String(request.reservation_id)],
      hasReport: Boolean(reportsByRequestId[String(request.id)]?.length),
      anchor: parseDate(anchorAt(request)),
    }))
    .sort((a, b) => {
      const at = a.anchor?.getTime() ?? 0;
      const bt = b.anchor?.getTime() ?? 0;
      return at - bt;
    });

  const now = new Date();

  const toConfirm = enriched.filter(({ request }) => ["created", "sent"].includes(request.status));
  const accepted = enriched.filter(({ request }) => request.status === "accepted");
  const overdue = enriched.filter(({ request, hasReport }) => isOverdue(request, hasReport));
  const upcoming = enriched.filter(({ request, anchor }) => {
    if (!anchor) return false;
    if (request.status !== "accepted") return false;
    return anchor.getTime() >= now.getTime() - 24 * 60 * 60 * 1000;
  });
  const history = enriched
    .filter(({ request }) => ["completed", "report_submitted", "problem_reported"].includes(request.status))
    .reverse()
    .slice(0, 5);

  const currentMonth = monthKey();
  const earningStatuses = new Set(["accepted", "completed", "report_submitted", "problem_reported"]);
  const monthMissions = enriched.filter(
    ({ request }) => missionMonthKey(request) === currentMonth && earningStatuses.has(request.status),
  );
  const monthExpected = monthMissions.reduce((sum, { request }) => sum + missionAmount(request), 0);

  const nextMission = upcoming[0];

  const managedProperties = propertyIds
    .map((id) => propertiesById[String(id)])
    .filter(Boolean)
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-950">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.35),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.30),transparent_35%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              {cleanerPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cleanerPhotoUrl}
                  alt=""
                  className="h-20 w-20 rounded-[1.5rem] object-cover ring-4 ring-white/10"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-white/10 text-2xl font-black">
                  {cleanerInitials(cleaner)}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-white/45">
                  {t(locale, "home.space")}
                </p>
                <h1 className="mt-1 text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                  {t(locale, "home.greeting")} {cleanerGreetingName(cleaner)}
                </h1>
                <p className="mt-2 truncate text-sm font-bold text-white/65">
                  {textValue(cleaner, ["trading_name", "legal_name", "worker_type"], t(locale, "home.fallbackSubtitle"))}
                </p>
              </div>
            </div>

          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[1.35rem] bg-white/10 p-3 ring-1 ring-white/10 sm:p-4">
              <p className="text-xs font-black uppercase text-white/45">{t(locale, "home.toConfirm")}</p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">{toConfirm.length}</p>
            </div>
            <div className="rounded-[1.35rem] bg-white/10 p-3 ring-1 ring-white/10 sm:p-4">
              <p className="text-xs font-black uppercase text-white/45">{t(locale, "home.confirmed")}</p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">{accepted.length}</p>
            </div>
            <div className="rounded-[1.35rem] bg-white/10 p-3 ring-1 ring-white/10 sm:p-4">
              <p className="text-xs font-black uppercase text-white/45">{t(locale, "home.overdue")}</p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">{overdue.length}</p>
            </div>
            <div className="rounded-[1.35rem] bg-white p-3 text-slate-950 sm:p-4">
              <p className="text-xs font-black uppercase text-slate-400">{t(locale, "home.confirmedThisMonth")}</p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">{money(monthExpected)}</p>
            </div>
          </div>
        </div>
      </section>

      <div id="planning" className="mx-auto max-w-6xl scroll-mt-6 space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        {overdue.length > 0 && (
          <section className="rounded-[1.75rem] bg-red-50 p-5 shadow-sm ring-1 ring-red-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-red-950">{t(locale, "home.overdueTitle")}</h2>
                <p className="mt-1 text-sm font-semibold text-red-800/70">
                  {t(locale, "home.overdueBody")}
                </p>
              </div>
              <span className="rounded-full bg-red-200 px-3 py-1 text-xs font-black text-red-950">
                {overdue.length} {t(locale, "home.overdueCount")}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {overdue.map(({ request, property, reservation, hasReport }) => (
                <MissionCard
                  key={request.id}
                  request={request}
                  property={property}
                  reservation={reservation}
                  hasReport={hasReport}
                  thumbnailUrl={coverByPropertyId[String(request.property_id)]}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        )}

        {toConfirm.length > 0 && (
          <section className="rounded-[1.75rem] bg-amber-50 p-5 shadow-sm ring-1 ring-amber-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-amber-950">{t(locale, "home.newToConfirmTitle")}</h2>
                <p className="mt-1 text-sm font-semibold text-amber-800/70">
                  {t(locale, "home.newToConfirmBody")}
                </p>
              </div>
              <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">
                {toConfirm.length} {t(locale, "home.toConfirmCount")}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {toConfirm.slice(0, 4).map(({ request, property, reservation, hasReport }) => (
                <MissionCard
                  key={request.id}
                  request={request}
                  property={property}
                  reservation={reservation}
                  hasReport={hasReport}
                  thumbnailUrl={coverByPropertyId[String(request.property_id)]}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        )}


        {nextMission && (
          <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.4fr]">
              <div className="relative min-h-44 bg-slate-900">
                {coverByPropertyId[String(nextMission.request.property_id)] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverByPropertyId[String(nextMission.request.property_id)] ?? ""}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-700" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                <div className="absolute bottom-4 left-4 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-950">
                  {t(locale, "home.nextMission")}
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  {dayLabel(anchorAt(nextMission.request))}
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {propertyName(nextMission.property, locale)}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  {guestName(nextMission.reservation, locale)} · {money(missionAmount(nextMission.request))}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">{t(locale, "card.readyBefore")}</p>
                    <p className="mt-1 text-sm font-black">{dateLabel(anchorAt(nextMission.request))}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">{t(locale, "card.duration")}</p>
                    <p className="mt-1 text-sm font-black">{nextMission.request.estimated_hours ?? "—"} h</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">{t(locale, "card.guests")}</p>
                    <p className="mt-1 text-sm font-black">{nextMission.request.number_of_guests ?? "—"}</p>
                  </div>
                </div>

                <Link
                  href={missionHref(nextMission.request)}
                  className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
                >
                  {t(locale, "home.openMission")}
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <section>
              {sectionTitle(t(locale, "home.upcomingTitle"), t(locale, "home.upcomingSubtitle"))}
              <div className="mt-3 space-y-3">
                {upcoming.length === 0 ? (
                  <div className="rounded-[1.35rem] bg-white p-4 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
                    {t(locale, "home.noUpcoming")}
                  </div>
                ) : (
                  upcoming.slice(0, 10).map(({ request, property, reservation, hasReport }) => (
                    <MissionCard
                      key={request.id}
                      request={request}
                      property={property}
                      reservation={reservation}
                      hasReport={hasReport}
                  thumbnailUrl={coverByPropertyId[String(request.property_id)]}
                      locale={locale}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              {sectionTitle(t(locale, "home.toValidateTitle"), t(locale, "home.toValidateSubtitle"))}
              <div className="mt-4 space-y-3">
                {overdue.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500">{t(locale, "home.nothingOverdue")}</p>
                ) : (
                  overdue.slice(0, 4).map(({ request, property, reservation, hasReport }) => (
                    <MissionCard
                      key={request.id}
                      request={request}
                      property={property}
                      reservation={reservation}
                      hasReport={hasReport}
                  thumbnailUrl={coverByPropertyId[String(request.property_id)]}
                      locale={locale}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              {sectionTitle(t(locale, "home.payments"), t(locale, "home.paymentsSubtitle"))}
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">{t(locale, "home.monthMissions")}</p>
                <p className="mt-1 text-3xl font-black">{money(monthExpected)}</p>
              </div>

              <div className="mt-4 space-y-2">
                {payments.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500">
                    {t(locale, "home.noRecentPaymentRequests")}
                  </p>
                ) : (
                  payments.map((payment) => (
                    <div key={payment.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="font-bold text-slate-500">
                          {textValue(payment, ["period_label", "month", "created_at"])}
                        </span>
                        <span className="font-black">
                          {money(numberValue(payment, ["amount_eur", "total_eur", "amount"]))}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {textValue(payment, ["status"], t(locale, "status.unknown"))}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <Link
                href={`/cleaner/${token}/payments`}
                className="mt-4 inline-flex w-full justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white"
              >
                {t(locale, "home.managePayments")}
              </Link>
            </section>

            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              {sectionTitle(t(locale, "home.contactsTitle"), t(locale, "home.contactsSubtitle"))}
              <div className="mt-4 space-y-3">
                {managedProperties.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500">{t(locale, "home.noLinkedProperty")}</p>
                ) : (
                  managedProperties.map((property) => (
                    <div key={property.id} className="rounded-2xl bg-slate-50 p-3">
                      <p className="font-black text-slate-950">{property.name}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {property.address || t(locale, "home.addressMissing")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              {sectionTitle(t(locale, "home.recentHistoryTitle"))}
              <div className="mt-4 space-y-2">
                {history.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500">{t(locale, "home.noRecentCompletedMission")}</p>
                ) : (
                  history.map(({ request, property, reservation }) => (
                    <Link
                      key={request.id}
                      href={missionHref(request)}
                      className="block rounded-2xl bg-slate-50 p-3 text-sm"
                    >
                      <p className="font-black text-slate-950">{propertyName(property, locale)}</p>
                      <p className="mt-1 font-semibold text-slate-500">
                        {guestName(reservation, locale)} · {dateLabel(anchorAt(request))}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>

      <CleanerBottomNav cleanerToken={token} active="missions" locale={locale} />
    </main>
  );
}
