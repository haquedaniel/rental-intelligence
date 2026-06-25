import Link from "next/link";
import { notFound } from "next/navigation";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";

type Row = Record<string, any>;

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

function cleanerName(cleaner: Row): string {
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || "Intervenante";
}

function cleanerInitials(cleaner: Row): string {
  const first = cleaner.first_name?.[0] ?? "";
  const last = cleaner.last_name?.[0] ?? "";
  return `${first}${last}` || "I";
}

function propertyName(property?: Row | null): string {
  return property?.name || "Logement";
}

function guestName(reservation?: Row | null): string {
  return reservation?.guest_name || reservation?.source_booking_id || "Séjour";
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

function statusLabel(request: Row, overdue: boolean): string {
  if (overdue) return "En retard";

  switch (request.status) {
    case "created":
      return "À confirmer";
    case "sent":
      return "Proposée";
    case "accepted":
      return "Confirmée";
    case "report_submitted":
    case "completed":
      return "Terminée";
    case "problem_reported":
      return "Problème";
    case "cancelled":
      return "Annulée";
    case "refused":
      return "Refusée";
    default:
      return request.status || "Mission";
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
}: {
  reservations: Row[];
  requests: Row[];
  propertiesById: Record<string, Row>;
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
          <h2 className="text-lg font-black text-slate-950">Mini planning</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Séjours et dates limites sur les 3 prochaines semaines.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
          21 jours
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
                    title={`${guestName(reservation)} · ${propertyName(propertiesById[String(reservation.property_id)])}`}
                  >
                    <p className="truncate text-[10px] font-black">{guestName(reservation)}</p>
                    <p className="truncate text-[8px] font-bold text-white/60">
                      {propertyName(propertiesById[String(reservation.property_id)])}
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
                        title={`${propertyName(propertiesById[String(request.property_id)])} · ${statusLabel(request, overdue)} · ${dateLabel(anchorAt(request))}`}
                      >
                        {request.status === "accepted" ? "OK" : "À confirmer"}
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

function MissionCard({
  request,
  property,
  reservation,
  hasReport,
}: {
  request: Row;
  property?: Row | null;
  reservation?: Row | null;
  hasReport: boolean;
}) {
  const overdue = isOverdue(request, hasReport);
  const amount = missionAmount(request);

  return (
    <Link
      href={missionHref(request)}
      className="block rounded-[1.35rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1 ${statusClass(request, overdue)}`}>
            {statusLabel(request, overdue)}
          </span>
          <h3 className="mt-3 truncate text-base font-black text-slate-950">
            {propertyName(property)}
          </h3>
          <p className="mt-1 truncate text-sm font-semibold text-slate-500">
            {guestName(reservation)} · {money(amount)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase text-slate-400">
            Prêt avant
          </p>
          <p className="mt-1 text-xs font-black text-slate-900">
            {dateLabel(anchorAt(request))}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase text-slate-400">Durée</p>
          <p className="mt-1 text-slate-900">{request.estimated_hours ?? "—"} h</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase text-slate-400">Linge</p>
          <p className="mt-1 text-slate-900">{request.linen_required ? "Oui" : "Non"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase text-slate-400">Validation</p>
          <p className="mt-1 text-slate-900">{hasReport ? "Rapport reçu" : "À faire"}</p>
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
        <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
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
                  Espace intervenante
                </p>
                <h1 className="mt-1 truncate text-3xl font-black tracking-tight sm:text-5xl">
                  Bonjour {cleaner.first_name || cleanerName(cleaner)}
                </h1>
                <p className="mt-2 truncate text-sm font-bold text-white/65">
                  {textValue(cleaner, ["trading_name", "legal_name", "worker_type"], "Planning et missions")}
                </p>
              </div>
            </div>

            <Link
              href={`/cleaner/${token}/payments`}
              className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950"
            >
              Paiements
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <div className="rounded-[1.35rem] bg-white/10 p-4 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase text-white/45">À confirmer</p>
              <p className="mt-2 text-3xl font-black">{toConfirm.length}</p>
            </div>
            <div className="rounded-[1.35rem] bg-white/10 p-4 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase text-white/45">Confirmées</p>
              <p className="mt-2 text-3xl font-black">{accepted.length}</p>
            </div>
            <div className="rounded-[1.35rem] bg-white/10 p-4 ring-1 ring-white/10">
              <p className="text-xs font-black uppercase text-white/45">En retard</p>
              <p className="mt-2 text-3xl font-black">{overdue.length}</p>
            </div>
            <div className="rounded-[1.35rem] bg-white p-4 text-slate-950">
              <p className="text-xs font-black uppercase text-slate-400">Confirmé ce mois-ci</p>
              <p className="mt-2 text-3xl font-black">{money(monthExpected)}</p>
            </div>
          </div>
        </div>
      </section>

      <div id="planning" className="mx-auto max-w-6xl scroll-mt-6 space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        {overdue.length > 0 && (
          <section className="rounded-[1.75rem] bg-red-50 p-5 shadow-sm ring-1 ring-red-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-red-950">Missions en retard</h2>
                <p className="mt-1 text-sm font-semibold text-red-800/70">
                  À traiter en priorité : ces missions attendent un rapport ou une validation.
                </p>
              </div>
              <span className="rounded-full bg-red-200 px-3 py-1 text-xs font-black text-red-950">
                {overdue.length} en retard
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
                />
              ))}
            </div>
          </section>
        )}

        {toConfirm.length > 0 && (
          <section className="rounded-[1.75rem] bg-amber-50 p-5 shadow-sm ring-1 ring-amber-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-amber-950">Nouvelles missions à confirmer</h2>
                <p className="mt-1 text-sm font-semibold text-amber-800/70">
                  Ces missions ne sont pas encore dans votre planning confirmé.
                </p>
              </div>
              <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">
                {toConfirm.length} à confirmer
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
                  Prochaine mission
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  {dayLabel(anchorAt(nextMission.request))}
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {propertyName(nextMission.property)}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  {guestName(nextMission.reservation)} · {money(missionAmount(nextMission.request))}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">Prêt avant</p>
                    <p className="mt-1 text-sm font-black">{dateLabel(anchorAt(nextMission.request))}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">Durée</p>
                    <p className="mt-1 text-sm font-black">{nextMission.request.estimated_hours ?? "—"} h</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">Voyageurs</p>
                    <p className="mt-1 text-sm font-black">{nextMission.request.number_of_guests ?? "—"}</p>
                  </div>
                </div>

                <Link
                  href={missionHref(nextMission.request)}
                  className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
                >
                  Ouvrir la mission
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <section>
              {sectionTitle("Planning à venir", "Missions confirmées et prochaines interventions.")}
              <div className="mt-3 space-y-3">
                {upcoming.length === 0 ? (
                  <div className="rounded-[1.35rem] bg-white p-4 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
                    Aucun ménage prévu pour le moment.
                  </div>
                ) : (
                  upcoming.slice(0, 10).map(({ request, property, reservation, hasReport }) => (
                    <MissionCard
                      key={request.id}
                      request={request}
                      property={property}
                      reservation={reservation}
                      hasReport={hasReport}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              {sectionTitle("À valider", "Missions terminées ou en retard.")}
              <div className="mt-4 space-y-3">
                {overdue.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500">Rien en retard.</p>
                ) : (
                  overdue.slice(0, 4).map(({ request, property, reservation, hasReport }) => (
                    <MissionCard
                      key={request.id}
                      request={request}
                      property={property}
                      reservation={reservation}
                      hasReport={hasReport}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              {sectionTitle("Paiements", "Récapitulatif et demandes.")}
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Missions du mois</p>
                <p className="mt-1 text-3xl font-black">{money(monthExpected)}</p>
              </div>

              <div className="mt-4 space-y-2">
                {payments.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500">
                    Aucune demande de paiement récente.
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
                        {textValue(payment, ["status"], "Statut inconnu")}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <Link
                href={`/cleaner/${token}/payments`}
                className="mt-4 inline-flex w-full justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white"
              >
                Gérer mes paiements
              </Link>
            </section>

            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              {sectionTitle("Contacts & logements", "Informations utiles pour vos missions.")}
              <div className="mt-4 space-y-3">
                {managedProperties.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500">Aucun logement associé.</p>
                ) : (
                  managedProperties.map((property) => (
                    <div key={property.id} className="rounded-2xl bg-slate-50 p-3">
                      <p className="font-black text-slate-950">{property.name}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {property.address || "Adresse à compléter"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              {sectionTitle("Historique récent")}
              <div className="mt-4 space-y-2">
                {history.length === 0 ? (
                  <p className="text-sm font-bold text-slate-500">Aucune mission terminée récemment.</p>
                ) : (
                  history.map(({ request, property, reservation }) => (
                    <Link
                      key={request.id}
                      href={missionHref(request)}
                      className="block rounded-2xl bg-slate-50 p-3 text-sm"
                    >
                      <p className="font-black text-slate-950">{propertyName(property)}</p>
                      <p className="mt-1 font-semibold text-slate-500">
                        {guestName(reservation)} · {dateLabel(anchorAt(request))}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>

      <CleanerBottomNav cleanerToken={token} active="missions" />
    </main>
  );
}
