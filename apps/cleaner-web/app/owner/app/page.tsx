import Link from "next/link";
import OwnerBottomNav from "@/components/owner/OwnerBottomNav";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { OwnerAppNav } from "@/components/owner-app/OwnerAppNav";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

type SearchParams = {
  property?: string | string[];
  start?: string;
  end?: string;
};

const PARIS_TZ = "Europe/Paris";

function asArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function isDateKey(value?: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function parisDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoStart(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

function isoEnd(dateKey: string): string {
  return `${dateKey}T23:59:59.999Z`;
}

function compactDate(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function money(value: unknown, digits = 0): string {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
  }).format(Number.isFinite(number) ? number : 0);
}

function numberValue(row: Row, fields: string[]): number {
  for (const field of fields) {
    const value = Number(row[field] ?? 0);
    if (Number.isFinite(value) && value !== 0) return value;
  }
  return 0;
}

function reservationRevenue(row: Row): number {
  return numberValue(row, [
    "total_revenue_eur",
    "accommodation_revenue_eur",
    "revenue_eur",
    "gross_revenue_eur",
    "total_price_eur",
    "price_eur",
    "amount_eur",
    "total",
    "price",
  ]);
}

function isCancelled(row: Row): boolean {
  if (row.cancelled_at || row.canceled_at) return true;

  const status = [
    row.status,
    row.booking_status,
    row.reservation_status,
    row.source_status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return status.includes("cancel") || status.includes("annul");
}

function propertyName(property?: Row | null): string {
  return property?.name || "Logement";
}

function guestName(reservation?: Row | null): string {
  return reservation?.guest_name || reservation?.source_booking_id || "Voyageur";
}

function statusLabel(request: Row): string {
  if (request.mission_type === "intervention") {
    if (request.status === "accepted") return "Intervention confirmée";
    if (request.status === "report_submitted") return "Intervention terminée";
    if (request.status === "problem_reported") return "Intervention à vérifier";
    if (["created", "sent"].includes(String(request.status))) return "Intervention proposée";
  }

  if (request.status === "accepted") return "Ménage confirmé";
  if (request.status === "report_submitted") return "Ménage terminé";
  if (request.status === "problem_reported") return "Problème signalé";
  if (["created", "sent"].includes(String(request.status))) return "Mission en attente";
  if (request.status === "refused") return "Mission refusée";

  return request.status || "Mission";
}

function requestHref(request: Row): string {
  if (["report_submitted", "problem_reported"].includes(String(request.status))) {
    return `/owner/reports/${request.id}`;
  }

  if (request.mission_type === "intervention") {
    return request.public_token ? `/mission/${request.public_token}/intervention` : "/admin/interventions";
  }

  return `/owner/missions/${request.id}`;
}

function periodHref({
  days,
  selectedPropertyIds,
}: {
  days: number;
  selectedPropertyIds: string[];
}) {
  const start = parisDateKey();
  const end = addDays(start, days - 1);
  const params = new URLSearchParams();
  params.set("start", start);
  params.set("end", end);
  selectedPropertyIds.forEach((id) => params.append("property", id));
  return `/owner/app?${params.toString()}`;
}

function KpiCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "slate" | "emerald" | "sky" | "amber" | "violet" | "red";
}) {
  const classes = {
    slate: "bg-white text-[#112532] ring-[#112532]/10",
    emerald: "bg-[#ECFFF6] text-emerald-950 ring-emerald-100",
    sky: "bg-sky-50 text-sky-950 ring-sky-100",
    amber: "bg-[#FFF5DD] text-amber-950 ring-amber-100",
    violet: "bg-violet-50 text-violet-950 ring-violet-100",
    red: "bg-red-50 text-red-950 ring-red-100",
  };

  return (
    <div className={`rounded-[1.35rem] p-4 shadow-sm ring-1 ${classes[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs font-bold opacity-60">{detail}</p>}
    </div>
  );
}

function FilterBar({
  properties,
  selectedPropertyIds,
  start,
  end,
}: {
  properties: Row[];
  selectedPropertyIds: string[];
  start: string;
  end: string;
}) {
  return (
    <form className="rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-[#112532]/10">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <details className="rounded-2xl bg-[#F6F3EF] p-3">
          <summary className="cursor-pointer text-sm font-black text-[#112532]/86">
            {selectedPropertyIds.length === 0
              ? "Tous les logements"
              : `${selectedPropertyIds.length} logement(s) sélectionné(s)`}
          </summary>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <label
                key={property.id}
                className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-bold text-[#112532]/76 ring-1 ring-slate-100"
              >
                <input
                  type="checkbox"
                  name="property"
                  value={property.id}
                  defaultChecked={selectedPropertyIds.includes(String(property.id))}
                />
                <span className="min-w-0 truncate">{property.name}</span>
              </label>
            ))}
          </div>
        </details>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">Début</span>
            <input
              type="date"
              name="start"
              defaultValue={start}
              className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-white px-3 py-2 text-sm font-bold"
            />
          </label>

          <label>
            <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">Fin</span>
            <input
              type="date"
              name="end"
              defaultValue={end}
              className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-white px-3 py-2 text-sm font-bold"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <Link href={periodHref({ days: 30, selectedPropertyIds })} className="rounded-full bg-[#112532]/6 px-3 py-2 text-[#112532]/60">
            30 jours
          </Link>
          <Link href={periodHref({ days: 90, selectedPropertyIds })} className="rounded-full bg-[#112532]/6 px-3 py-2 text-[#112532]/60">
            90 jours
          </Link>
          <Link href={periodHref({ days: 365, selectedPropertyIds })} className="rounded-full bg-[#112532]/6 px-3 py-2 text-[#112532]/60">
            Saison
          </Link>
        </div>

        <button className="rounded-full bg-[#112532] px-5 py-2 text-sm font-black text-white">
          Appliquer
        </button>
      </div>
    </form>
  );
}

export default async function OwnerAppPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const today = parisDateKey();
  const start = isDateKey(params?.start) ? params.start : today;
  const rawEnd = isDateKey(params?.end) ? params.end : addDays(start, 29);
  const end = rawEnd < start ? addDays(start, 29) : rawEnd;

  const supabase = getSupabaseAdmin();

  const { data: propertiesData, error: propertiesError } = await supabase
    .from("properties")
    .select("*")
    .order("name", { ascending: true });

  if (propertiesError) {
    throw new Error(`Impossible de charger les logements : ${propertiesError.message}`);
  }

  const properties = (propertiesData ?? []) as Row[];
  const propertyIds = new Set(properties.map((property) => String(property.id)));
  const selectedPropertyIds = asArray(params?.property).filter((id) => propertyIds.has(id));
  const visiblePropertyIds = selectedPropertyIds.length
    ? selectedPropertyIds
    : properties.map((property) => String(property.id));

  const propertyById = new Map(properties.map((property) => [String(property.id), property]));

  const [reservationsResult, requestsResult, paymentsResult] = await Promise.all([
    visiblePropertyIds.length
      ? supabase
          .from("reservations")
          .select("*")
          .in("property_id", visiblePropertyIds)
          .lte("checkin_at", isoEnd(end))
          .gte("checkout_at", isoStart(start))
          .order("checkin_at", { ascending: true })
      : Promise.resolve({ data: [] as Row[], error: null }),
    visiblePropertyIds.length
      ? supabase
          .from("cleaning_requests")
          .select("*")
          .in("property_id", visiblePropertyIds)
          .gte("scheduled_start_at", isoStart(addDays(start, -2)))
          .lte("scheduled_start_at", isoEnd(addDays(end, 2)))
          .order("scheduled_start_at", { ascending: true })
      : Promise.resolve({ data: [] as Row[], error: null }),
    supabase
      .from("monthly_payment_requests")
      .select("*")
      .in("status", ["sent_to_owner", "overdue"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (reservationsResult.error) {
    throw new Error(`Impossible de charger les réservations : ${reservationsResult.error.message}`);
  }

  if (requestsResult.error) {
    throw new Error(`Impossible de charger les missions : ${requestsResult.error.message}`);
  }

  const reservations = (reservationsResult.data ?? []) as Row[];
  const requests = (requestsResult.data ?? []) as Row[];
  const openPayments = (paymentsResult.data ?? []) as Row[];

  const activeReservations = reservations.filter((reservation) => !isCancelled(reservation));
  const confirmedRevenue = activeReservations.reduce((sum, reservation) => sum + reservationRevenue(reservation), 0);

  const arrivals = activeReservations.filter((reservation) => {
    const key = reservation.checkin_at ? parisDateKey(new Date(reservation.checkin_at)) : "";
    return key >= today && key <= addDays(today, 7);
  });

  const departures = activeReservations.filter((reservation) => {
    const key = reservation.checkout_at ? parisDateKey(new Date(reservation.checkout_at)) : "";
    return key >= today && key <= addDays(today, 7);
  });

  const actionRequests = requests.filter((request) =>
    ["created", "sent", "refused", "problem_reported"].includes(String(request.status)) ||
    request.schedule_status === "planning_changed"
  );

  const completedReports = requests.filter((request) =>
    ["report_submitted", "problem_reported"].includes(String(request.status)),
  );

  const recentEvents = [
    ...reservations
      .slice(-8)
      .map((reservation) => ({
        key: `reservation-${reservation.id}`,
        tone: isCancelled(reservation) ? "red" : "sky",
        title: isCancelled(reservation) ? "Réservation annulée" : "Réservation",
        meta: `${compactDate(reservation.checkin_at)} → ${compactDate(reservation.checkout_at)}`,
        summary: `${propertyName(propertyById.get(String(reservation.property_id)))} · ${guestName(reservation)} · ${money(reservationRevenue(reservation))}`,
        href: `/owner/app/reservations?property=${reservation.property_id}&start=${start}&end=${end}`,
      })),
    ...requests
      .slice(-10)
      .map((request) => ({
        key: `request-${request.id}`,
        tone: request.status === "problem_reported" ? "red" : request.mission_type === "intervention" ? "violet" : "emerald",
        title: statusLabel(request),
        meta: compactDate(request.scheduled_start_at || request.ready_by_at),
        summary: `${propertyName(propertyById.get(String(request.property_id)))} · ${request.title || (request.mission_type === "intervention" ? "Intervention" : "Ménage")}`,
        href: requestHref(request),
      })),
  ]
    .sort((a, b) => String(b.meta).localeCompare(String(a.meta)))
    .slice(0, 10);

  const machineOk = actionRequests.length === 0 && openPayments.length === 0;

  return (
    <main className="min-h-screen bg-[#F6F3EF] pb-28 text-[#112532] md:pb-8">
      <OwnerAppNav active="cockpit" />

      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8"><span className="h-2 w-2 rounded-full bg-[#E0680E]" />Pilotys · opération</div>
        <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] bg-[#112532] p-5 text-white shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                Cockpit
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                {machineOk ? "Tout est sous contrôle" : "Quelques points à suivre"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/65">
                {activeReservations.length} réservation(s), {requests.length} mission(s), {visiblePropertyIds.length} logement(s) · {compactDate(start)} → {compactDate(end)}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-3xl bg-white p-4 text-[#112532]">
                <p className="text-[10px] font-black uppercase text-[#112532]/36">CA confirmé</p>
                <p className="mt-2 text-2xl font-black">{money(confirmedRevenue)}</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-[10px] font-black uppercase text-white/40">Actions</p>
                <p className="mt-2 text-2xl font-black">{actionRequests.length + openPayments.length}</p>
              </div>
            </div>
          </div>
        </section>

        <FilterBar
          properties={properties}
          selectedPropertyIds={selectedPropertyIds}
          start={start}
          end={end}
        />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <KpiCard label="Réservations" value={String(activeReservations.length)} detail={`${reservations.filter(isCancelled).length} annulée(s)`} tone="sky" />
          <KpiCard label="Arrivées 7j" value={String(arrivals.length)} detail={`${departures.length} départ(s)`} tone="emerald" />
          <KpiCard label="Missions" value={String(requests.length)} detail={`${completedReports.length} rapport(s)`} tone="violet" />
          <KpiCard label="À traiter" value={String(actionRequests.length)} detail="ops / problèmes" tone={actionRequests.length ? "amber" : "emerald"} />
          <KpiCard label="Paiements" value={String(openPayments.length)} detail="demandes ouvertes" tone={openPayments.length ? "amber" : "slate"} />
          <KpiCard label="Trafic direct" value="à brancher" detail="page views site direct" tone="slate" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#112532]/36">
                  Machine
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#112532]">
                  Le flux en cours
                </h2>
              </div>

              <Link
                href={`/owner/app/reservations?start=${start}&end=${end}${selectedPropertyIds.map((id) => `&property=${id}`).join("")}`}
                className="rounded-full bg-[#112532] px-4 py-2 text-xs font-black text-white"
              >
                Réservations
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {recentEvents.length === 0 ? (
                <p className="rounded-2xl bg-[#F6F3EF] p-4 text-sm font-bold text-[#112532]/48">
                  Aucun événement sur cette période.
                </p>
              ) : (
                recentEvents.map((event) => (
                  <Link
                    key={event.key}
                    href={event.href}
                    className="block rounded-2xl bg-[#F6F3EF] p-3 ring-1 ring-slate-100 transition hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 h-3 w-3 rounded-full ${
                          event.tone === "red"
                            ? "bg-red-500"
                            : event.tone === "violet"
                              ? "bg-violet-500"
                              : event.tone === "emerald"
                                ? "bg-[#ECFFF6]0"
                                : "bg-sky-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-black text-[#112532]">{event.title}</p>
                          <p className="shrink-0 text-xs font-black text-[#112532]/36">{event.meta}</p>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-[#112532]/48">{event.summary}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/10">
              <p className="text-xs font-black uppercase tracking-wide text-[#112532]/36">
                Accès rapide
              </p>
              <div className="mt-4 grid gap-2">
                <Link href="/admin/interventions" className="rounded-2xl bg-violet-50 p-4 text-sm font-black text-violet-950 ring-1 ring-violet-100">
                  + Créer une intervention
                </Link>
                <Link href="/owner/payments" className="rounded-2xl bg-[#FFF5DD] p-4 text-sm font-black text-amber-950 ring-1 ring-amber-100">
                  Demandes de paiement
                </Link>
                <Link href="/owner/cockpit" className="rounded-2xl bg-[#F6F3EF] p-4 text-sm font-black text-[#112532]/86 ring-1 ring-slate-100">
                  Ancien cockpit / planning
                </Link>
              </div>
            </section>

            <section id="revenus" className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/10">
              <p className="text-xs font-black uppercase tracking-wide text-[#112532]/36">
                Revenus
              </p>
              <h2 className="mt-1 text-xl font-black text-[#112532]">
                {money(confirmedRevenue)}
              </h2>
              <p className="mt-2 text-sm font-semibold text-[#112532]/48">
                Source simple : réservations actives sur la période. Les benchmarks, recommandations de prix et page views viendront ici comme signaux lisibles, pas comme tableau BI lourd.
              </p>
            </section>
          </aside>
        </section>
      </div>
          <OwnerBottomNav active="cockpit" />
</main>
  );
}
