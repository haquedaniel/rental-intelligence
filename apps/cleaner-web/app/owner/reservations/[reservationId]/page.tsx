import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Row = Record<string, any>;

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

function euro(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
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

function dateOnly(value: string | null | undefined): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function nightsBetween(checkin?: string | null, checkout?: string | null): number | null {
  if (!checkin || !checkout) return null;

  const start = new Date(checkin);
  const end = new Date(checkout);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);

  return Number.isFinite(nights) && nights > 0 ? nights : null;
}

function requestStatusLabel(request: Row): string {
  switch (request.status) {
    case "created":
      return "Créée";
    case "sent":
      return "Proposée";
    case "accepted":
      return "Confirmée";
    case "refused":
      return "Refusée";
    case "cancelled":
      return "Annulée";
    case "report_submitted":
    case "completed":
      return "Terminée";
    case "problem_reported":
      return "Problème";
    default:
      return request.status || "—";
  }
}

function requestStatusClass(request: Row): string {
  switch (request.status) {
    case "accepted":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "created":
    case "sent":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "completed":
    case "report_submitted":
      return "bg-slate-950 text-white ring-slate-950";
    case "cancelled":
    case "refused":
      return "bg-red-100 text-red-800 ring-red-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function cleanerName(cleaner?: Row | null): string {
  if (!cleaner) return "Non affectée";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || "Intervenante";
}

function usefulFinancialRows(reservation: Row): Array<[string, string]> {
  const labels: Record<string, string> = {
    accommodation_revenue_eur: "Hébergement",
    accommodation_revenue: "Hébergement",
    host_payout_eur: "Reversement hôte",
    host_payout: "Reversement hôte",
    revenue_eur: "Revenu",
    total_revenue_eur: "Revenu total",
    amount_eur: "Montant",
    total_eur: "Total",
    price_eur: "Prix",
    total_price: "Prix total",
    cleaning_fee_eur: "Frais de ménage facturés",
    commission_eur: "Commission",
    platform_fee_eur: "Frais plateforme",
    tourist_tax_eur: "Taxe de séjour",
    taxes_eur: "Taxes",
    net_revenue_eur: "Net",
  };

  return Object.entries(labels)
    .filter(([field]) => reservation[field] !== null && reservation[field] !== undefined && reservation[field] !== "")
    .map(([field, label]) => [label, euro(Number(reservation[field]))]);
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

  const [
    propertyResult,
    cleaningRequestsResult,
  ] = await Promise.all([
    reservation.property_id
      ? supabase.from("properties").select("*").eq("id", reservation.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("cleaning_requests")
      .select("*")
      .eq("reservation_id", reservation.id)
      .order("created_at", { ascending: true }),
  ]);

  const property = propertyResult.data as Row | null;
  const cleaningRequests = (cleaningRequestsResult.data ?? []) as Row[];

  const cleanerIds = cleaningRequests
    .map((request) => request.assigned_cleaner_id)
    .filter(Boolean);

  const requestIds = cleaningRequests.map((request) => request.id).filter(Boolean);

  const [cleanersResult, reportsResult, outboundResult] = await Promise.all([
    cleanerIds.length
      ? supabase.from("cleaners").select("*").in("id", cleanerIds)
      : Promise.resolve({ data: [] }),
    requestIds.length
      ? supabase.from("cleaning_reports").select("*").in("cleaning_request_id", requestIds)
      : Promise.resolve({ data: [] }),
    requestIds.length
      ? supabase
          .from("outbound_messages")
          .select("*")
          .in("cleaning_request_id", requestIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const cleanersById = Object.fromEntries(
    ((cleanersResult.data ?? []) as Row[]).map((cleaner) => [String(cleaner.id), cleaner]),
  );

  const reportsByRequestId: Record<string, Row[]> = {};
  for (const report of (reportsResult.data ?? []) as Row[]) {
    const key = String(report.cleaning_request_id);
    reportsByRequestId[key] = reportsByRequestId[key] ?? [];
    reportsByRequestId[key].push(report);
  }

  const outboundByRequestId: Record<string, Row[]> = {};
  for (const message of (outboundResult.data ?? []) as Row[]) {
    const key = String(message.cleaning_request_id);
    outboundByRequestId[key] = outboundByRequestId[key] ?? [];
    outboundByRequestId[key].push(message);
  }

  const nights = nightsBetween(reservation.checkin_at, reservation.checkout_at);
  const guestCount = numberValue(reservation, ["number_of_guests", "guest_count", "guests", "adults"]);
  const revenue = numberValue(reservation, [
    "accommodation_revenue_eur",
    "accommodation_revenue",
    "host_payout_eur",
    "host_payout",
    "revenue_eur",
    "total_revenue_eur",
    "amount_eur",
    "total_eur",
    "price_eur",
    "total_price",
  ]);

  const cleaningCost = cleaningRequests.reduce((sum, request) => {
    const value = numberValue(request, ["total_cost_eur", "cleaning_cost_eur", "amount_eur"]) ?? 0;
    return sum + value;
  }, 0);

  const adr = revenue !== null && nights ? revenue / nights : null;
  const netAfterCleaning = revenue !== null ? revenue - cleaningCost : null;
  const financialRows = usefulFinancialRows(reservation);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/owner/cockpit" className="text-xs font-black uppercase tracking-wide text-slate-400">
              ← Retour cockpit
            </Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {textValue(reservation, ["guest_name", "source_booking_id"], "Séjour")}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {property?.name ?? "Logement"} · {textValue(reservation, ["source", "channel", "platform"], "Source inconnue")}
            </p>
          </div>

          <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200">
            {textValue(reservation, ["status", "reservation_status", "booking_status"], "Réservation")}
          </span>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Arrivée</p>
            <p className="mt-2 text-sm font-black">{dateTime(reservation.checkin_at)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Départ</p>
            <p className="mt-2 text-sm font-black">{dateTime(reservation.checkout_at)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Nuits</p>
            <p className="mt-2 text-2xl font-black">{nights ?? "—"}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Voyageurs</p>
            <p className="mt-2 text-2xl font-black">{guestCount ?? "—"}</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <article className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-black">Financier</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Revenu réservation</p>
                <p className="mt-1 text-2xl font-black">{euro(revenue)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">ADR</p>
                <p className="mt-1 text-2xl font-black">{euro(adr)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Coût ménage prévu</p>
                <p className="mt-1 text-2xl font-black">{euro(cleaningCost)}</p>
              </div>
              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs font-black uppercase tracking-wide text-white/50">Net après ménage</p>
                <p className="mt-1 text-2xl font-black">{euro(netAfterCleaning)}</p>
              </div>
            </div>

            {financialRows.length > 0 && (
              <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100">
                {financialRows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-4 py-2 text-sm">
                    <span className="font-semibold text-slate-500">{label}</span>
                    <span className="font-black text-slate-950">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-black">Détails séjour</h2>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-black text-slate-400">Nom client</dt>
                <dd className="mt-1 font-bold">{textValue(reservation, ["guest_name", "guest_full_name"])}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-400">Référence</dt>
                <dd className="mt-1 font-bold">{textValue(reservation, ["source_booking_id", "booking_id", "external_id"])}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-400">Source</dt>
                <dd className="mt-1 font-bold">{textValue(reservation, ["source", "channel", "platform"])}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-400">Téléphone</dt>
                <dd className="mt-1 font-bold">{textValue(reservation, ["guest_phone", "phone"])}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-400">Email</dt>
                <dd className="mt-1 font-bold">{textValue(reservation, ["guest_email", "email"])}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-400">Créée le</dt>
                <dd className="mt-1 font-bold">{dateOnly(reservation.created_at)}</dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Ménage prévu</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Missions liées à ce séjour.
              </p>
            </div>
            {cleaningRequests.length === 0 && (
              <Link
                href={`/owner/issues/missing/${reservation.id}`}
                className="rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white"
              >
                Créer / résoudre
              </Link>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {cleaningRequests.length === 0 ? (
              <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800 ring-1 ring-red-100">
                Aucun ménage actif lié à cette réservation.
              </div>
            ) : (
              cleaningRequests.map((request) => {
                const cleaner = cleanersById[String(request.assigned_cleaner_id)];
                const reports = reportsByRequestId[String(request.id)] ?? [];
                const messages = outboundByRequestId[String(request.id)] ?? [];

                return (
                  <div key={request.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${requestStatusClass(request)}`}>
                          {requestStatusLabel(request)}
                        </span>
                        <h3 className="mt-3 text-base font-black">
                          {request.title || "Ménage"}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {cleanerName(cleaner)} · {euro(numberValue(request, ["total_cost_eur", "cleaning_cost_eur", "amount_eur"]))}
                        </p>
                      </div>

                      <Link
                        href={`/owner/issues/request/${request.id}`}
                        className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
                      >
                        Voir mission
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase text-slate-400">Fenêtre</p>
                        <p className="mt-1 font-bold">{dateTime(request.work_window_start_at || request.scheduled_start_at)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase text-slate-400">Prêt avant</p>
                        <p className="mt-1 font-bold">
                          {dateTime(request.ready_by_at || request.completion_deadline_at || request.work_window_end_at || request.scheduled_end_at)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase text-slate-400">Validation</p>
                        <p className="mt-1 font-bold">{reports.length > 0 ? "Rapport reçu" : "Aucun rapport"}</p>
                      </div>
                    </div>

                    {messages.length > 0 && (
                      <p className="mt-3 text-xs font-bold text-slate-400">
                        Dernier SMS : {messages[0]?.status ?? "—"} · {messages[0]?.message_type ?? "—"}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
