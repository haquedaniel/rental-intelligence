import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const PARIS_TZ = "Europe/Paris";

type Row = Record<string, any>;

function isDateKey(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function dateAtNoonUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function dateKeyFromUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = dateAtNoonUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyFromUtcDate(date);
}

function startOfWeek(dateKey: string): string {
  const date = dateAtNoonUtc(dateKey);
  const day = date.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return dateKeyFromUtcDate(date);
}

function parisDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;

  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function todayParisDateKey(): string {
  return parisDateKey(new Date());
}

function toIsoStart(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

function toIsoEnd(dateKey: string): string {
  return `${dateKey}T23:59:59.999Z`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shortDayName(dateKey: string): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: PARIS_TZ,
      weekday: "short",
    })
      .format(dateAtNoonUtc(dateKey))
      .replace(".", ""),
  );
}

function longDateLabel(dateKey: string): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: PARIS_TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dateAtNoonUtc(dateKey)),
  );
}

function compactDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "short",
  })
    .format(dateAtNoonUtc(dateKey))
    .replace(".", "");
}

function timeLabel(iso?: string | null): string {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(":", "h");
}

function euro(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "—";

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "—";

  return `${numberValue.toFixed(2)} €`;
}

function fullName(cleaner?: Row | null): string {
  if (!cleaner) return "Non affecté";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || "Intervenante";
}

function reservationTitle(reservation?: Row | null): string {
  if (!reservation) return "Séjour";
  return reservation.guest_name || reservation.source_booking_id || "Séjour";
}

function requestStatusLabel(status?: string): string {
  switch (status) {
    case "created":
      return "À envoyer";
    case "sent":
      return "Proposée";
    case "accepted":
      return "Acceptée";
    case "refused":
      return "Refusée";
    case "cancelled":
      return "Annulée";
    case "report_submitted":
      return "Rapport reçu";
    case "completed":
      return "Terminée";
    case "problem_reported":
      return "Problème";
    default:
      return status || "À créer";
  }
}

function requestStatusClasses(status?: string): string {
  switch (status) {
    case "accepted":
      return "bg-emerald-100 text-emerald-800";
    case "sent":
    case "created":
      return "bg-sky-100 text-sky-800";
    case "report_submitted":
    case "completed":
      return "bg-slate-900 text-white";
    case "problem_reported":
      return "bg-orange-100 text-orange-900";
    case "refused":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function smsStatus(messages: Row[]): { label: string; className: string } {
  if (messages.some((message) => message.status === "failed")) {
    return {
      label: "SMS échoué",
      className: "bg-red-100 text-red-800",
    };
  }

  if (messages.some((message) => message.status === "pending")) {
    return {
      label: "SMS en attente",
      className: "bg-amber-100 text-amber-900",
    };
  }

  if (messages.some((message) => message.status === "sent")) {
    return {
      label: "SMS envoyé",
      className: "bg-emerald-100 text-emerald-800",
    };
  }

  return {
    label: "Pas de SMS",
    className: "bg-slate-100 text-slate-600",
  };
}

function reservationTouchesDay(reservation: Row, dayKey: string): boolean {
  if (!reservation.checkin_at || !reservation.checkout_at) return false;

  const checkin = parisDateKey(reservation.checkin_at);
  const checkout = parisDateKey(reservation.checkout_at);

  return dayKey >= checkin && dayKey < checkout;
}

function reservationChecksInOn(reservation: Row, dayKey: string): boolean {
  if (!reservation.checkin_at) return false;
  return parisDateKey(reservation.checkin_at) === dayKey;
}

function reservationChecksOutOn(reservation: Row, dayKey: string): boolean {
  if (!reservation.checkout_at) return false;
  return parisDateKey(reservation.checkout_at) === dayKey;
}

function requestScheduledOn(request: Row, dayKey: string): boolean {
  if (!request.scheduled_start_at) return false;
  return parisDateKey(request.scheduled_start_at) === dayKey;
}

function cleanerPhoto(cleaner?: Row | null, size = "h-10 w-10") {
  if (!cleaner) {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg ring-1 ring-slate-200`}>
        ?
      </div>
    );
  }

  if (cleaner.profilePhotoSignedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cleaner.profilePhotoSignedUrl}
        alt=""
        className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white`}
      />
    );
  }

  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg ring-1 ring-slate-200`}>
      👤
    </div>
  );
}

function cleanerStatusLabel(cleaner?: Row | null): string {
  if (!cleaner) return "Non affecté";
  if (cleaner.status === "temporarily_unavailable") return "Indisponible";
  if (cleaner.status === "inactive" || cleaner.active === false) return "Inactive";
  return "Active";
}

function cleanerStatusClass(cleaner?: Row | null): string {
  if (!cleaner) return "bg-red-100 text-red-800";
  if (cleaner.status === "active" && cleaner.active !== false) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (cleaner.status === "temporarily_unavailable") {
    return "bg-amber-100 text-amber-900";
  }
  return "bg-red-100 text-red-800";
}

function roleLabel(role?: string): string {
  return role === "primary" ? "Principale" : "Remplaçante";
}

function roleClass(role?: string): string {
  return role === "primary"
    ? "bg-slate-950 text-white"
    : "bg-slate-100 text-slate-700";
}

function alertClass(level: "red" | "orange" | "blue") {
  if (level === "red") return "border-red-200 bg-red-50 text-red-900";
  if (level === "orange") return "border-orange-200 bg-orange-50 text-orange-900";
  return "border-sky-200 bg-sky-50 text-sky-900";
}

function missionHref(request?: Row | null): string {
  if (!request?.public_token) return "#";
  return `/mission/${request.public_token}`;
}

function reportHref(request?: Row | null): string {
  if (!request?.public_token) return "#";
  return `/mission/${request.public_token}/report`;
}

function propertyFilterHref(start: string, propertyId?: string) {
  const params = new URLSearchParams();
  params.set("start", start);
  if (propertyId) params.set("property", propertyId);
  return `/admin/operations?${params.toString()}`;
}

export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ start?: string; property?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const weekStart = startOfWeek(
    isDateKey(params?.start) ? params.start : todayParisDateKey(),
  );
  const selectedPropertyId = params?.property ?? "";

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = addDays(weekStart, 6);
  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const supabase = getSupabaseAdmin();

  const { data: propertiesData, error: propertiesError } = await supabase
    .from("properties")
    .select("id,name,address,preferred_cleaner_id")
    .order("name", { ascending: true });

  if (propertiesError) {
    throw new Error(`Impossible de charger les logements : ${propertiesError.message}`);
  }

  const { data: reservationsData, error: reservationsError } = await supabase
    .from("reservations")
    .select("*")
    .neq("status", "cancelled")
    .lte("checkin_at", toIsoEnd(addDays(weekEnd, 2)))
    .gte("checkout_at", toIsoStart(addDays(weekStart, -2)))
    .order("checkin_at", { ascending: true });

  if (reservationsError) {
    throw new Error(`Impossible de charger les réservations : ${reservationsError.message}`);
  }

  const { data: requestsData, error: requestsError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .gte("scheduled_start_at", toIsoStart(addDays(weekStart, -2)))
    .lte("scheduled_start_at", toIsoEnd(addDays(weekEnd, 2)))
    .order("scheduled_start_at", { ascending: true });

  if (requestsError) {
    throw new Error(`Impossible de charger les ménages : ${requestsError.message}`);
  }

  const { data: cleanersData, error: cleanersError } = await supabase
    .from("cleaners")
    .select("*")
    .order("first_name", { ascending: true });

  if (cleanersError) {
    throw new Error(`Impossible de charger les intervenantes : ${cleanersError.message}`);
  }

  const { data: assignmentsData, error: assignmentsError } = await supabase
    .from("property_cleaner_assignments")
    .select("*")
    .eq("active", true)
    .order("role", { ascending: false })
    .order("priority", { ascending: true });

  if (assignmentsError) {
    throw new Error(`Impossible de charger l'équipe ménage : ${assignmentsError.message}`);
  }

  const requestIds = (requestsData ?? []).map((request) => request.id);

  let outboundRows: Row[] = [];
  let reportRows: Row[] = [];

  if (requestIds.length > 0) {
    const { data: outboundData } = await supabase
      .from("outbound_messages")
      .select("*")
      .in("cleaning_request_id", requestIds)
      .order("created_at", { ascending: false });

    outboundRows = outboundData ?? [];

    const { data: reportsData } = await supabase
      .from("cleaning_reports")
      .select("*")
      .in("cleaning_request_id", requestIds);

    reportRows = reportsData ?? [];
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

  const properties = propertiesData ?? [];
  const reservations = reservationsData ?? [];
  const requests = requestsData ?? [];
  const assignments = assignmentsData ?? [];

  const cleanerById = Object.fromEntries(cleaners.map((cleaner) => [cleaner.id, cleaner]));
  const propertyById = Object.fromEntries(properties.map((property) => [property.id, property]));
  const requestByReservationId = Object.fromEntries(
    requests
      .filter((request) => request.reservation_id)
      .map((request) => [request.reservation_id, request]),
  );

  const outboundByRequestId: Record<string, Row[]> = {};
  for (const message of outboundRows) {
    const key = String(message.cleaning_request_id);
    outboundByRequestId[key] = outboundByRequestId[key] ?? [];
    outboundByRequestId[key].push(message);
  }

  const reportsByRequestId: Record<string, Row[]> = {};
  for (const report of reportRows) {
    const key = String(report.cleaning_request_id);
    reportsByRequestId[key] = reportsByRequestId[key] ?? [];
    reportsByRequestId[key].push(report);
  }

  const visibleProperties = selectedPropertyId
    ? properties.filter((property) => property.id === selectedPropertyId)
    : properties;

  const reservationsByProperty: Record<string, Row[]> = {};
  for (const reservation of reservations) {
    const propertyId = String(reservation.property_id);
    reservationsByProperty[propertyId] = reservationsByProperty[propertyId] ?? [];
    reservationsByProperty[propertyId].push(reservation);
  }

  const requestsByProperty: Record<string, Row[]> = {};
  for (const request of requests) {
    const propertyId = String(request.property_id);
    requestsByProperty[propertyId] = requestsByProperty[propertyId] ?? [];
    requestsByProperty[propertyId].push(request);
  }

  const assignmentsByProperty: Record<string, Row[]> = {};
  for (const assignment of assignments) {
    const propertyId = String(assignment.property_id);
    assignmentsByProperty[propertyId] = assignmentsByProperty[propertyId] ?? [];
    assignmentsByProperty[propertyId].push(assignment);
  }

  const departuresThisWeek = reservations.filter((reservation) =>
    weekDays.includes(parisDateKey(reservation.checkout_at)),
  );

  const acceptedThisWeek = requests.filter((request) => request.status === "accepted").length;
  const reportsThisWeek = requests.filter((request) =>
    ["report_submitted", "completed"].includes(request.status),
  ).length;
  const proposedThisWeek = requests.filter((request) =>
    ["created", "sent"].includes(request.status),
  ).length;

  const alerts: { level: "red" | "orange" | "blue"; title: string; detail: string; href?: string }[] = [];

  for (const reservation of departuresThisWeek) {
    const request = requestByReservationId[reservation.id];
    const property = propertyById[reservation.property_id];

    if (!request) {
      alerts.push({
        level: "red",
        title: "Ménage manquant",
        detail: `${property?.name ?? "Logement"} · départ ${compactDateLabel(parisDateKey(reservation.checkout_at))}`,
      });
      continue;
    }

    const messages = outboundByRequestId[request.id] ?? [];

    if (messages.some((message) => message.status === "failed")) {
      alerts.push({
        level: "red",
        title: "SMS échoué",
        detail: `${property?.name ?? "Logement"} · ${fullName(cleanerById[request.assigned_cleaner_id])}`,
        href: missionHref(request),
      });
    }

    if (request.status === "refused") {
      alerts.push({
        level: "red",
        title: "Mission refusée",
        detail: `${property?.name ?? "Logement"} · ${fullName(cleanerById[request.assigned_cleaner_id])}`,
        href: missionHref(request),
      });
    }

    if (["created", "sent"].includes(request.status)) {
      alerts.push({
        level: "orange",
        title: "À confirmer",
        detail: `${property?.name ?? "Logement"} · ${compactDateLabel(parisDateKey(request.scheduled_start_at))} · ${fullName(cleanerById[request.assigned_cleaner_id])}`,
        href: missionHref(request),
      });
    }

    if (request.status === "problem_reported") {
      alerts.push({
        level: "orange",
        title: "Problème signalé",
        detail: `${property?.name ?? "Logement"} · rapport ménage`,
        href: reportHref(request),
      });
    }

    const scheduledEnd = request.scheduled_end_at ? new Date(request.scheduled_end_at) : null;
    if (
      scheduledEnd &&
      scheduledEnd.getTime() < Date.now() &&
      !["report_submitted", "completed", "problem_reported", "cancelled"].includes(request.status)
    ) {
      alerts.push({
        level: "orange",
        title: "Rapport attendu",
        detail: `${property?.name ?? "Logement"} · ménage terminé en théorie`,
        href: reportHref(request),
      });
    }
  }

  const uniqueCleanerIds = Array.from(
    new Set(assignments.map((assignment) => assignment.cleaner_id).filter(Boolean)),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Planning des séjours & ménages
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">
                Vue propriétaire
              </h1>
            </div>

            <div className="flex gap-2">
              <Link
                href={propertyFilterHref(previousWeek, selectedPropertyId)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
              >
                ← Semaine précédente
              </Link>
              <Link
                href={propertyFilterHref(nextWeek, selectedPropertyId)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
              >
                Semaine suivante →
              </Link>
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {longDateLabel(weekStart)} → {longDateLabel(weekEnd)}
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm text-slate-300">Départs</p>
            <p className="mt-2 text-4xl font-bold">{departuresThisWeek.length}</p>
            <p className="mt-1 text-sm text-slate-300">cette semaine</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Missions acceptées</p>
            <p className="mt-2 text-4xl font-bold text-emerald-700">{acceptedThisWeek}</p>
            <p className="mt-1 text-sm text-slate-500">intervenante confirmée</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">À confirmer</p>
            <p className="mt-2 text-4xl font-bold text-sky-700">{proposedThisWeek}</p>
            <p className="mt-1 text-sm text-slate-500">proposées ou à envoyer</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Rapports reçus</p>
            <p className="mt-2 text-4xl font-bold text-slate-950">{reportsThisWeek}</p>
            <p className="mt-1 text-sm text-slate-500">photos / checklist</p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            <Link
              href={propertyFilterHref(weekStart)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                selectedPropertyId
                  ? "bg-slate-100 text-slate-700"
                  : "bg-slate-950 text-white"
              }`}
            >
              Tous les logements
            </Link>

            {properties.map((property) => (
              <Link
                key={property.id}
                href={propertyFilterHref(weekStart, property.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  selectedPropertyId === property.id
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {property.name}
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-5">
            {alerts.length > 0 && (
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-xl font-bold text-slate-950">
                  À surveiller
                </h2>

                <div className="mt-4 space-y-3">
                  {alerts.slice(0, 8).map((alert, index) => {
                    const content = (
                      <div className={`rounded-2xl border p-4 ${alertClass(alert.level)}`}>
                        <p className="font-bold">{alert.title}</p>
                        <p className="mt-1 text-sm opacity-80">{alert.detail}</p>
                      </div>
                    );

                    return alert.href && alert.href !== "#" ? (
                      <Link key={`${alert.title}-${index}`} href={alert.href}>
                        {content}
                      </Link>
                    ) : (
                      <div key={`${alert.title}-${index}`}>{content}</div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((dayKey) => (
                  <div
                    key={dayKey}
                    className={`rounded-2xl p-3 text-center ${
                      dayKey === todayParisDateKey()
                        ? "bg-slate-950 text-white"
                        : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    <p className="text-xs font-semibold opacity-70">
                      {shortDayName(dayKey)}
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {Number(dayKey.slice(8, 10))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {visibleProperties.map((property) => {
              const propertyReservations = reservationsByProperty[property.id] ?? [];
              const propertyRequests = requestsByProperty[property.id] ?? [];

              return (
                <article
                  key={property.id}
                  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"
                >
                  <div className="border-b border-slate-100 p-5">
                    <h2 className="text-xl font-bold text-slate-950">
                      {property.name}
                    </h2>
                    {property.address && (
                      <p className="mt-1 text-sm text-slate-500">
                        {property.address}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-7">
                    {weekDays.map((dayKey) => {
                      const stays = propertyReservations.filter((reservation) =>
                        reservationTouchesDay(reservation, dayKey),
                      );
                      const checkins = propertyReservations.filter((reservation) =>
                        reservationChecksInOn(reservation, dayKey),
                      );
                      const checkouts = propertyReservations.filter((reservation) =>
                        reservationChecksOutOn(reservation, dayKey),
                      );
                      const cleanings = propertyRequests.filter((request) =>
                        requestScheduledOn(request, dayKey),
                      );

                      return (
                        <div
                          key={dayKey}
                          className="min-h-44 rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
                        >
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                            {compactDateLabel(dayKey)}
                          </p>

                          <div className="space-y-2">
                            {stays.map((reservation) => (
                              <div
                                key={reservation.id}
                                className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 p-3 text-white"
                              >
                                <p className="text-xs text-slate-300">Séjour</p>
                                <p className="mt-1 truncate text-sm font-bold">
                                  {reservationTitle(reservation)}
                                </p>
                                <p className="mt-1 text-xs text-slate-300">
                                  {timeLabel(reservation.checkin_at)} → {timeLabel(reservation.checkout_at)}
                                </p>
                              </div>
                            ))}

                            {checkouts.map((reservation) => (
                              <div
                                key={`${reservation.id}-checkout`}
                                className="rounded-xl border border-amber-200 bg-amber-50 p-3"
                              >
                                <p className="text-xs font-semibold text-amber-900">
                                  Départ {timeLabel(reservation.checkout_at)}
                                </p>
                                <p className="mt-1 truncate text-sm font-bold text-amber-950">
                                  {reservationTitle(reservation)}
                                </p>
                              </div>
                            ))}

                            {cleanings.map((request) => {
                              const cleaner = cleanerById[request.assigned_cleaner_id];
                              const messages = outboundByRequestId[request.id] ?? [];
                              const sms = smsStatus(messages);
                              const reports = reportsByRequestId[request.id] ?? [];

                              return (
                                <div
                                  key={request.id}
                                  className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    {cleanerPhoto(cleaner, "h-9 w-9")}
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-bold text-slate-950">
                                        {fullName(cleaner)}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        Ménage {timeLabel(request.scheduled_start_at)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-1">
                                    <span
                                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${requestStatusClasses(
                                        request.status,
                                      )}`}
                                    >
                                      {requestStatusLabel(request.status)}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${sms.className}`}
                                    >
                                      {sms.label}
                                    </span>
                                    {reports.length > 0 && (
                                      <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-800">
                                        Rapport
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-3 flex items-center justify-between">
                                    <p className="text-sm font-bold text-slate-950">
                                      {euro(request.total_cost_eur)}
                                    </p>
                                    <Link
                                      href={missionHref(request)}
                                      className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                    >
                                      Ouvrir
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}

                            {checkins.map((reservation) => (
                              <div
                                key={`${reservation.id}-checkin`}
                                className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"
                              >
                                <p className="text-xs font-semibold text-emerald-900">
                                  Arrivée {timeLabel(reservation.checkin_at)}
                                </p>
                                <p className="mt-1 truncate text-sm font-bold text-emerald-950">
                                  {reservationTitle(reservation)}
                                </p>
                              </div>
                            ))}

                            {stays.length === 0 &&
                              checkouts.length === 0 &&
                              cleanings.length === 0 &&
                              checkins.length === 0 && (
                                <p className="rounded-xl bg-white p-3 text-center text-xs text-slate-400">
                                  Rien prévu
                                </p>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">
              <div className="p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Mon équipe ménage
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {uniqueCleanerIds.length} intervenante(s)
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  Principales et remplaçantes par logement.
                </p>
              </div>

              <div className="border-t border-white/10 p-4">
                <div className="flex -space-x-3">
                  {uniqueCleanerIds.slice(0, 8).map((cleanerId) => (
                    <div key={cleanerId}>
                      {cleanerPhoto(cleanerById[cleanerId], "h-12 w-12")}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {properties.map((property) => {
              const propertyAssignments = assignmentsByProperty[property.id] ?? [];

              if (propertyAssignments.length === 0) {
                return (
                  <section
                    key={property.id}
                    className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                  >
                    <h3 className="font-bold text-slate-950">{property.name}</h3>
                    <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                      Aucune intervenante affectée
                    </p>
                  </section>
                );
              }

              return (
                <section
                  key={property.id}
                  className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                >
                  <h3 className="font-bold text-slate-950">{property.name}</h3>

                  <div className="mt-4 space-y-3">
                    {propertyAssignments.map((assignment) => {
                      const cleaner = cleanerById[assignment.cleaner_id];

                      return (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"
                        >
                          {cleanerPhoto(cleaner, "h-12 w-12")}

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-950">
                              {fullName(cleaner)}
                            </p>

                            <div className="mt-1 flex flex-wrap gap-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleClass(
                                  assignment.role,
                                )}`}
                              >
                                {roleLabel(assignment.role)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cleanerStatusClass(
                                  cleaner,
                                )}`}
                              >
                                {cleanerStatusLabel(cleaner)}
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              Priorité {assignment.priority}
                              {assignment.familiar ? " · connaît le logement" : ""}
                              {assignment.travel_distance_km !== null &&
                              assignment.travel_distance_km !== undefined
                                ? ` · ${assignment.travel_distance_km} km`
                                : ""}
                            </p>
                          </div>

                          {cleaner?.public_token && (
                            <Link
                              href={`/cleaner/${cleaner.public_token}`}
                              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
                            >
                              Planning
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </aside>
        </div>
      </div>
    </main>
  );
}
