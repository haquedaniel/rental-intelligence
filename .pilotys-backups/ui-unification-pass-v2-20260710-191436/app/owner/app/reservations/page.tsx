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
  status?: string;
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

function dateLabel(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
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

function reservationStatus(row: Row): string {
  if (isCancelled(row)) return "Annulée";
  return row.status || row.booking_status || row.reservation_status || "Active";
}

function sourceLabel(row: Row): string {
  return row.channel || row.source || row.platform || row.booking_source || "—";
}

function guestName(row: Row): string {
  return row.guest_name || row.guest_full_name || row.source_booking_id || "Voyageur";
}

function nights(row: Row): number {
  if (!row.checkin_at || !row.checkout_at) return 0;
  const start = new Date(row.checkin_at);
  const end = new Date(row.checkout_at);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function matchesStatus(row: Row, status: string): boolean {
  if (status === "all") return true;
  if (status === "active") return !isCancelled(row);
  if (status === "cancelled") return isCancelled(row);

  const today = parisDateKey();
  const checkin = row.checkin_at ? parisDateKey(new Date(row.checkin_at)) : "";
  const checkout = row.checkout_at ? parisDateKey(new Date(row.checkout_at)) : "";

  if (status === "current") return !isCancelled(row) && checkin <= today && checkout >= today;
  if (status === "future") return !isCancelled(row) && checkin >= today;
  if (status === "past") return !isCancelled(row) && checkout < today;

  return true;
}

function statusClass(row: Row): string {
  if (isCancelled(row)) return "bg-red-100 text-red-800 ring-red-200";
  return "bg-emerald-100 text-emerald-800 ring-emerald-200";
}

function buildHref({
  path,
  start,
  end,
  selectedPropertyIds,
  status,
}: {
  path: string;
  start: string;
  end: string;
  selectedPropertyIds: string[];
  status?: string;
}) {
  const params = new URLSearchParams();
  params.set("start", start);
  params.set("end", end);
  if (status) params.set("status", status);
  selectedPropertyIds.forEach((id) => params.append("property", id));
  return `${path}?${params.toString()}`;
}

function FilterForm({
  properties,
  selectedPropertyIds,
  start,
  end,
  status,
}: {
  properties: Row[];
  selectedPropertyIds: string[];
  start: string;
  end: string;
  status: string;
}) {
  return (
    <form className="rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-[#112532]/10">
      <input type="hidden" name="status" value={status} />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
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
          <Link href={buildHref({ path: "/owner/app/reservations", start: parisDateKey(), end: addDays(parisDateKey(), 29), selectedPropertyIds, status })} className="rounded-full bg-[#112532]/6 px-3 py-2 text-[#112532]/60">
            30 jours
          </Link>
          <Link href={buildHref({ path: "/owner/app/reservations", start: parisDateKey(), end: addDays(parisDateKey(), 89), selectedPropertyIds, status })} className="rounded-full bg-[#112532]/6 px-3 py-2 text-[#112532]/60">
            90 jours
          </Link>
          <Link href={buildHref({ path: "/owner/app/reservations", start: `${parisDateKey().slice(0, 4)}-01-01`, end: `${parisDateKey().slice(0, 4)}-12-31`, selectedPropertyIds, status })} className="rounded-full bg-[#112532]/6 px-3 py-2 text-[#112532]/60">
            Année
          </Link>
        </div>

        <button className="rounded-full bg-[#112532] px-5 py-2 text-sm font-black text-white">
          Appliquer
        </button>
      </div>
    </form>
  );
}

export default async function OwnerReservationsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const today = parisDateKey();
  const start = isDateKey(params?.start) ? params.start : `${today.slice(0, 4)}-01-01`;
  const rawEnd = isDateKey(params?.end) ? params.end : `${today.slice(0, 4)}-12-31`;
  const end = rawEnd < start ? addDays(start, 364) : rawEnd;
  const status = params?.status || "active";

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

  const { data, error } = visiblePropertyIds.length
    ? await supabase
        .from("reservations")
        .select("*")
        .in("property_id", visiblePropertyIds)
        .lte("checkin_at", isoEnd(end))
        .gte("checkout_at", isoStart(start))
        .order("checkin_at", { ascending: true })
    : { data: [], error: null };

  if (error) {
    throw new Error(`Impossible de charger les réservations : ${error.message}`);
  }

  const allRows = ((data ?? []) as Row[]);
  const visibleRows = allRows.filter((row) => matchesStatus(row, status));

  const activeRows = allRows.filter((row) => !isCancelled(row));
  const cancelledRows = allRows.filter(isCancelled);
  const totalRevenue = visibleRows.filter((row) => !isCancelled(row)).reduce((sum, row) => sum + reservationRevenue(row), 0);
  const totalNights = visibleRows.filter((row) => !isCancelled(row)).reduce((sum, row) => sum + nights(row), 0);

  const grouped = properties
    .filter((property) => visiblePropertyIds.includes(String(property.id)))
    .map((property) => {
      const rows = visibleRows.filter((row) => String(row.property_id) === String(property.id));
      const revenue = rows.filter((row) => !isCancelled(row)).reduce((sum, row) => sum + reservationRevenue(row), 0);

      return {
        property,
        rows,
        revenue,
      };
    })
    .filter((group) => group.rows.length > 0);

  return (
    <main className="min-h-screen bg-[#F6F3EF] pb-28 text-[#112532] md:pb-8">
      <OwnerAppNav active="reservations" />

      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5 lg:px-8">
        <header className="rounded-[2rem] bg-[#112532] p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
            Source de vérité
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">
            Réservations
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/65">
            Liste simple et vérifiable des réservations prises en compte, avec filtres par logement et période.
          </p>
        </header>

        <FilterForm
          properties={properties}
          selectedPropertyIds={selectedPropertyIds}
          start={start}
          end={end}
          status={status}
        />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-[1.35rem] bg-white p-4 shadow-sm ring-1 ring-[#112532]/10">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">Affichées</p>
            <p className="mt-2 text-2xl font-black">{visibleRows.length}</p>
          </div>

          <div className="rounded-[1.35rem] bg-emerald-50 p-4 text-emerald-950 shadow-sm ring-1 ring-emerald-100">
            <p className="text-[10px] font-black uppercase tracking-wide opacity-60">Actives</p>
            <p className="mt-2 text-2xl font-black">{activeRows.length}</p>
          </div>

          <div className="rounded-[1.35rem] bg-red-50 p-4 text-red-950 shadow-sm ring-1 ring-red-100">
            <p className="text-[10px] font-black uppercase tracking-wide opacity-60">Annulées</p>
            <p className="mt-2 text-2xl font-black">{cancelledRows.length}</p>
          </div>

          <div className="rounded-[1.35rem] bg-sky-50 p-4 text-sky-950 shadow-sm ring-1 ring-sky-100">
            <p className="text-[10px] font-black uppercase tracking-wide opacity-60">Nuits</p>
            <p className="mt-2 text-2xl font-black">{totalNights}</p>
          </div>

          <div className="rounded-[1.35rem] bg-violet-50 p-4 text-violet-950 shadow-sm ring-1 ring-violet-100">
            <p className="text-[10px] font-black uppercase tracking-wide opacity-60">CA affiché</p>
            <p className="mt-2 text-2xl font-black">{money(totalRevenue)}</p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {[
            ["active", "Actives"],
            ["current", "En cours"],
            ["future", "À venir"],
            ["past", "Passées"],
            ["cancelled", "Annulées"],
            ["all", "Toutes"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={buildHref({ path: "/owner/app/reservations", start, end, selectedPropertyIds, status: key })}
              className={
                status === key
                  ? "rounded-full bg-[#112532] px-4 py-2 text-sm font-black text-white"
                  : "rounded-full bg-white px-4 py-2 text-sm font-black text-[#112532]/76 ring-1 ring-[#112532]/10"
              }
            >
              {label}
            </Link>
          ))}
        </div>

        {grouped.length === 0 ? (
          <section className="rounded-[2rem] bg-white p-6 text-sm font-bold text-[#112532]/48 shadow-sm ring-1 ring-[#112532]/10">
            Aucune réservation pour ces filtres.
          </section>
        ) : (
          grouped.map((group) => (
            <section key={group.property.id} className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-[#112532]/10">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                <div>
                  <h2 className="text-xl font-black text-[#112532]">
                    {group.property.name}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#112532]/48">
                    {group.rows.length} réservation(s) · {money(group.revenue)}
                  </p>
                </div>

                <Link
                  href={`/owner/cockpit?start=${start}&end=${end}&property=${group.property.id}`}
                  className="rounded-full bg-[#112532]/6 px-3 py-2 text-xs font-black text-[#112532]/60"
                >
                  Voir planning
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[920px] w-full text-left text-sm">
                  <thead className="bg-[#F6F3EF] text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
                    <tr>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Voyageur</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Nuits</th>
                      <th className="px-4 py-3 text-right">Revenu</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Référence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((reservation) => (
                      <tr key={reservation.id} className="align-top">
                        <td className="px-4 py-3 font-black text-[#112532]">
                          {dateLabel(reservation.checkin_at)} → {dateLabel(reservation.checkout_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#112532]/76">
                          {guestName(reservation)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#112532]/48">
                          {sourceLabel(reservation)}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-[#112532]">
                          {nights(reservation)}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-[#112532]">
                          {isCancelled(reservation) ? "—" : money(reservationRevenue(reservation))}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${statusClass(reservation)}`}>
                            {reservationStatus(reservation)}
                          </span>
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-xs font-semibold text-[#112532]/36">
                          {reservation.source_booking_id || reservation.external_id || reservation.id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
          <OwnerBottomNav active="reservations" />
</main>
  );
}
