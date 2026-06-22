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

function shortDate(value: string | null | undefined): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
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

function statusLabel(value?: string | null): string {
  switch (value) {
    case "confirmed":
      return "Confirmée";
    case "cancelled":
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
    default:
      return value || "—";
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
    case "problem_reported":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function cleanerName(cleaner?: Row | null): string {
  if (!cleaner) return "Non affectée";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || "Intervenante";
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

function financialLine(label: string, value: string, emphasis = false) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/10 py-3 first:border-t-0">
      <span className={`text-sm font-bold ${emphasis ? "text-slate-950" : "text-slate-500"}`}>
        {label}
      </span>
      <span className={`text-right font-black ${emphasis ? "text-lg text-slate-950" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
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
    cleaningRequestsResult,
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
      .from("cleaning_requests")
      .select("*")
      .eq("reservation_id", reservation.id)
      .order("created_at", { ascending: true }),
  ]);

  const property = propertyResult.data as Row | null;
  const financial = financialResult.data as Row | null;
  const coverPhoto = coverPhotoResult.data as Row | null;
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

  const cleaners = (cleanersResult.data ?? []) as Row[];
  const cleanersById = Object.fromEntries(cleaners.map((cleaner) => [String(cleaner.id), cleaner]));

  const cleanerPhotoById: Record<string, string | null> = {};
  for (const cleaner of cleaners) {
    cleanerPhotoById[String(cleaner.id)] = await signedStorageUrl(
      supabase,
      cleaner.profile_photo_bucket,
      cleaner.profile_photo_path,
    );
  }

  const coverUrl = await signedStorageUrl(
    supabase,
    coverPhoto?.storage_bucket,
    coverPhoto?.storage_path,
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

  const nights =
    numberValue(financial, ["nights"]) ??
    numberValue(reservation, ["nights"]) ??
    nightsBetween(reservation.checkin_at, reservation.checkout_at);

  const guestCount =
    numberValue(financial, ["number_of_guests"]) ??
    numberValue(reservation, ["number_of_guests", "guest_count", "guests"]);

  const grossBooking = numberValue(financial, ["gross_booking_value_eur"]);
  const accommodation = numberValue(financial, ["accommodation_revenue_eur"]);
  const hostPayout = numberValue(financial, ["host_payout_eur"]);
  const cleaningFeeCharged = numberValue(financial, ["cleaning_fee_charged_eur"]);
  const adr = numberValue(financial, ["adr_eur"]) ?? (accommodation !== null && nights ? accommodation / nights : null);

  const cleanerCost = cleaningRequests.reduce((sum, request) => {
    const value = numberValue(request, ["total_cost_eur", "cleaning_cost_eur", "amount_eur"]) ?? 0;
    return sum + value;
  }, 0);

  const displayPropertyName = property?.name ?? financial?.property_name ?? "Logement";
  const displayListingName = financial?.listing_name ?? displayPropertyName;
  const displaySource = financial?.booking_channel ?? reservation.source_system ?? "Source inconnue";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-800 to-slate-700" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/20" />

        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-6 lg:px-8">
          <Link href="/owner/cockpit" className="text-xs font-black uppercase tracking-wide text-white/60">
            ← Retour cockpit
          </Link>

          <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-white/55">
                {displayListingName}
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">
                {textValue(reservation, ["guest_name", "source_booking_id"], "Séjour")}
              </h1>
              <p className="mt-3 text-base font-bold text-white/75">
                {dateTime(reservation.checkin_at)} → {dateTime(reservation.checkout_at)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950">
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
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
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

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200">
            <div className="bg-slate-950 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-wide text-white/45">Financier</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold text-white/45">Montant réservation</p>
                  <p className="mt-1 text-3xl font-black">{euro(grossBooking)}</p>
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

            <div className="divide-y divide-slate-100 p-5">
              {financialLine("Frais de ménage facturés au client", euro(cleaningFeeCharged), true)}
              {financialLine("Coût intervenante prévu", euro(cleanerCost), true)}
              {financialLine("Reversement hôte", euro(hostPayout))}
              {financialLine("Canal", displaySource)}
              {financialLine("Source système", sourceSystem || "—")}
            </div>
          </article>

          <article className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-black">Détails séjour</h2>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="font-black text-slate-400">Logement</dt>
                <dd className="mt-1 font-bold">{displayPropertyName}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="font-black text-slate-400">Référence</dt>
                <dd className="mt-1 font-bold">{sourceBookingId || "—"}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="font-black text-slate-400">Client</dt>
                <dd className="mt-1 font-bold">{textValue(reservation, ["guest_name", "guest_full_name"])}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="font-black text-slate-400">Créée</dt>
                <dd className="mt-1 font-bold">{shortDate(reservation.created_at)}</dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
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
                const cleanerPhoto = cleanerPhotoById[String(request.assigned_cleaner_id)];
                const reports = reportsByRequestId[String(request.id)] ?? [];
                const messages = outboundByRequestId[String(request.id)] ?? [];
                const requestCost = numberValue(request, ["total_cost_eur", "cleaning_cost_eur", "amount_eur"]);

                return (
                  <div key={request.id} className="rounded-[1.5rem] border border-slate-100 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {cleanerPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cleanerPhoto}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-500">
                            🧹
                          </div>
                        )}

                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${requestStatusClass(request)}`}>
                            {statusLabel(request.status)}
                          </span>
                          <h3 className="mt-2 truncate text-base font-black">
                            {request.title || "Ménage"}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {cleanerName(cleaner)} · {euro(requestCost)}
                          </p>
                        </div>
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
                        <p className="text-xs font-black uppercase text-slate-400">Fenêtre ouverte</p>
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
