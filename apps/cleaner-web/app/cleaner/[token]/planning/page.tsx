import Link from "next/link";
import { notFound } from "next/navigation";

import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

function shortDay(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
  })
    .format(date)
    .replace(".", "");
}

function dateLabel(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(":", "h");
}

function propertyName(property?: Row | null): string {
  return property?.name || "Logement";
}

function guestName(reservation?: Row | null): string {
  return reservation?.guest_name || reservation?.source_booking_id || "Séjour";
}

function money(value: unknown): string {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

function missionAmount(request: Row): number {
  return Number(
    request.total_cost_eur ??
      request.cleaning_cost_eur ??
      request.amount_eur ??
      0,
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

function spanForCalendar(startKey: string, endExclusiveKey: string, units: string[]) {
  const touched = units
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit }) => startKey <= unit && endExclusiveKey > unit);

  if (touched.length === 0) return null;

  const first = touched[0].index;
  const last = touched[touched.length - 1].index;

  return { start: first + 1, span: last - first + 1 };
}

function MiniPlanning({
  reservations,
  requests,
  propertiesById,
  reservationsById,
}: {
  reservations: Row[];
  requests: Row[];
  propertiesById: Record<string, Row>;
  reservationsById: Record<string, Row>;
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
    <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">Mini planning</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Séjours et missions sur les 3 prochaines semaines.
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
                    const reservation = reservationsById[String(request.reservation_id)];
                    const overdue = isOverdue(request, false);
                    return (
                      <Link
                        key={request.id}
                        href={missionHref(request)}
                        className={`w-full rounded-lg px-1 py-1 text-center text-[8px] font-black leading-tight ring-1 ${statusClass(request, overdue)}`}
                        title={`${propertyName(propertiesById[String(request.property_id)])} · ${guestName(reservation)} · ${statusLabel(request, overdue)}`}
                      >
                        {overdue ? "RETARD" : request.status === "accepted" ? "OK" : "À confirmer"}
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

function MissionPlanningCard({
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

  return (
    <Link
      href={missionHref(request)}
      className="block rounded-[1.35rem] bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1 ${statusClass(request, overdue)}`}>
            {statusLabel(request, overdue)}
          </span>

          <h2 className="mt-3 truncate text-base font-black text-slate-950">
            {propertyName(property)}
          </h2>

          <p className="mt-1 truncate text-sm font-semibold text-slate-500">
            {guestName(reservation)} · {money(missionAmount(request))}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase text-slate-400">Prêt avant</p>
          <p className="mt-1 text-xs font-black text-slate-900">
            {dateLabel(anchorAt(request))}
          </p>
        </div>
      </div>
    </Link>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>}
      </div>
      {children}
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

  const { data: requestRows } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("assigned_cleaner_id", cleaner.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(120);

  const requests = (requestRows ?? []) as Row[];
  const propertyIds = [...new Set(requests.map((request) => request.property_id).filter(Boolean))];
  const reservationIds = [...new Set(requests.map((request) => request.reservation_id).filter(Boolean))];
  const requestIds = requests.map((request) => request.id).filter(Boolean);

  const calendarStart = new Date();
  calendarStart.setDate(calendarStart.getDate() - 1);
  const calendarEnd = new Date();
  calendarEnd.setDate(calendarEnd.getDate() + 22);

  const [propertiesResult, reservationsResult, calendarReservationsResult, reportsResult] = await Promise.all([
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
      ? supabase.from("cleaning_reports").select("id,cleaning_request_id").in("cleaning_request_id", requestIds)
      : Promise.resolve({ data: [] }),
  ]);

  const propertiesById = Object.fromEntries(
    ((propertiesResult.data ?? []) as Row[]).map((property) => [String(property.id), property]),
  );

  const reservationsById = Object.fromEntries(
    ((reservationsResult.data ?? []) as Row[]).map((reservation) => [String(reservation.id), reservation]),
  );

  const reportsByRequestId = new Set(
    ((reportsResult.data ?? []) as Row[]).map((report) => String(report.cleaning_request_id)),
  );

  const enriched = requests
    .map((request) => ({
      request,
      property: propertiesById[String(request.property_id)],
      reservation: reservationsById[String(request.reservation_id)],
      hasReport: reportsByRequestId.has(String(request.id)),
      anchor: parseDate(anchorAt(request)),
    }))
    .sort((a, b) => (a.anchor?.getTime() ?? 0) - (b.anchor?.getTime() ?? 0));

  const overdue = enriched.filter(({ request, hasReport }) => isOverdue(request, hasReport));
  const toConfirm = enriched.filter(({ request }) => ["created", "sent"].includes(request.status));
  const confirmed = enriched.filter(
    ({ request, hasReport }) => request.status === "accepted" && !isOverdue(request, hasReport),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-5 text-slate-950">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-[2rem] bg-slate-950 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-wide text-white/50">
            Planning intervenante
          </p>
          <h1 className="mt-2 text-3xl font-black">Planning</h1>
          <p className="mt-2 text-sm font-semibold text-white/60">
            Vue calendrier des séjours et des interventions à venir.
          </p>
        </header>

        {overdue.length > 0 && (
          <section className="rounded-[1.75rem] bg-red-50 p-5 shadow-sm ring-1 ring-red-100">
            <h2 className="text-lg font-black text-red-950">Missions en retard</h2>
            <p className="mt-1 text-sm font-semibold text-red-800/70">
              À traiter avant de regarder le reste du planning.
            </p>

            <div className="mt-4 space-y-3">
              {overdue.map(({ request, property, reservation, hasReport }) => (
                <MissionPlanningCard
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

        <MiniPlanning
          reservations={(calendarReservationsResult.data ?? []) as Row[]}
          requests={requests}
          propertiesById={propertiesById}
          reservationsById={reservationsById}
        />

        {toConfirm.length > 0 && (
          <Section title="À confirmer" subtitle="Missions proposées, pas encore acceptées.">
            <div className="space-y-3">
              {toConfirm.map(({ request, property, reservation, hasReport }) => (
                <MissionPlanningCard
                  key={request.id}
                  request={request}
                  property={property}
                  reservation={reservation}
                  hasReport={hasReport}
                />
              ))}
            </div>
          </Section>
        )}

        <Section title="Interventions confirmées" subtitle="Liste détaillée des prochaines missions.">
          {confirmed.length === 0 ? (
            <p className="rounded-3xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
              Aucune mission confirmée.
            </p>
          ) : (
            <div className="space-y-3">
              {confirmed.map(({ request, property, reservation, hasReport }) => (
                <MissionPlanningCard
                  key={request.id}
                  request={request}
                  property={property}
                  reservation={reservation}
                  hasReport={hasReport}
                />
              ))}
            </div>
          )}
        </Section>
      </div>

      <CleanerBottomNav cleanerToken={token} active="planning" />
    </main>
  );
}
