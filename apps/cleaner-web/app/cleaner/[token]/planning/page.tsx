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
          <span
            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1 ${statusClass(
              request,
              overdue,
            )}`}
          >
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
          <p className="text-[10px] font-black uppercase text-slate-400">
            Prêt avant
          </p>
          <p className="mt-1 text-xs font-black text-slate-900">
            {dateLabel(anchorAt(request))}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold text-slate-500">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase text-slate-400">Durée</p>
          <p className="mt-1 text-slate-900">{request.estimated_hours ?? "—"} h</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase text-slate-400">Linge</p>
          <p className="mt-1 text-slate-900">{request.linen_required ? "Oui" : "Non"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase text-slate-400">Rapport</p>
          <p className="mt-1 text-slate-900">{hasReport ? "Reçu" : "À faire"}</p>
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
        {subtitle && (
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
        )}
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

  const [propertiesResult, reservationsResult, reportsResult] = await Promise.all([
    propertyIds.length
      ? supabase.from("properties").select("*").in("id", propertyIds)
      : Promise.resolve({ data: [] }),
    reservationIds.length
      ? supabase.from("reservations").select("*").in("id", reservationIds)
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

  const toConfirm = enriched.filter(({ request }) => ["created", "sent"].includes(request.status));
  const confirmed = enriched.filter(({ request }) => request.status === "accepted");
  const finished = enriched
    .filter(({ request }) => ["report_submitted", "completed", "problem_reported"].includes(request.status))
    .reverse()
    .slice(0, 12);

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-5 text-slate-950">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-[2rem] bg-slate-950 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-wide text-white/50">
            Planning intervenante
          </p>
          <h1 className="mt-2 text-3xl font-black">Planning</h1>
          <p className="mt-2 text-sm font-semibold text-white/60">
            Missions à confirmer, interventions confirmées et historique récent.
          </p>
        </header>

        <Section title="À confirmer" subtitle="Ces missions attendent une réponse.">
          {toConfirm.length === 0 ? (
            <p className="rounded-3xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
              Aucune mission à confirmer.
            </p>
          ) : (
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
          )}
        </Section>

        <Section title="Confirmées" subtitle="Vos prochaines interventions acceptées.">
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

        <Section title="Historique récent">
          {finished.length === 0 ? (
            <p className="rounded-3xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
              Aucun historique récent.
            </p>
          ) : (
            <div className="space-y-3">
              {finished.map(({ request, property, reservation, hasReport }) => (
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
