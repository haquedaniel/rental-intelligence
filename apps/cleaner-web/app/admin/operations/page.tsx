import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const PARIS_TZ = "Europe/Paris";
const DAYS_TO_SHOW = 14;

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

function compactDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "short",
  })
    .format(dateAtNoonUtc(dateKey))
    .replace(".", "");
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

function initials(cleaner?: Row | null): string {
  if (!cleaner) return "?";
  const first = cleaner.first_name?.[0] ?? "";
  const last = cleaner.last_name?.[0] ?? "";
  return `${first}${last}` || "?";
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
    return { label: "SMS échoué", className: "bg-red-100 text-red-800" };
  }

  if (messages.some((message) => message.status === "pending")) {
    return { label: "SMS en attente", className: "bg-amber-100 text-amber-900" };
  }

  if (messages.some((message) => message.status === "sent")) {
    return { label: "SMS envoyé", className: "bg-emerald-100 text-emerald-800" };
  }

  return { label: "Pas de SMS", className: "bg-slate-100 text-slate-600" };
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

function reservationTouchesRange(reservation: Row, rangeStart: string, rangeEnd: string): boolean {
  if (!reservation.checkin_at || !reservation.checkout_at) return false;

  const checkin = parisDateKey(reservation.checkin_at);
  const checkout = parisDateKey(reservation.checkout_at);

  return checkin <= rangeEnd && checkout >= rangeStart;
}

function reservationGridSpan(reservation: Row, rangeDays: string[]) {
  if (!reservation.checkin_at || !reservation.checkout_at) return null;

  const checkin = parisDateKey(reservation.checkin_at);
  const checkout = parisDateKey(reservation.checkout_at);

  const firstDay = rangeDays[0];
  const lastDay = rangeDays[rangeDays.length - 1];
  const endExclusive = addDays(lastDay, 1);

  const visibleStart = checkin < firstDay ? firstDay : checkin;
  const visibleEndExclusive = checkout > endExclusive ? endExclusive : checkout;

  let startIndex = rangeDays.indexOf(visibleStart);
  if (startIndex < 0) startIndex = 0;

  let endIndexExclusive = rangeDays.indexOf(visibleEndExclusive);
  if (endIndexExclusive < 0) {
    endIndexExclusive = visibleEndExclusive > lastDay ? rangeDays.length : startIndex + 1;
  }

  const span = Math.max(1, endIndexExclusive - startIndex);

  return {
    start: startIndex + 1,
    span,
    clippedStart: checkin < firstDay,
    clippedEnd: checkout > endExclusive,
  };
}

function cleanerPhoto(cleaner?: Row | null, size = "h-10 w-10") {
  if (!cleaner) {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-700 ring-1 ring-red-100`}>
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
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700 ring-1 ring-slate-200`}>
      {initials(cleaner)}
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
  return role === "primary" ? "Principale" : "Renfort";
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

function rangeLabel(start: string, end: string): string {
  return `${compactDateLabel(start)} → ${compactDateLabel(end)}`;
}

export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ start?: string; property?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const rangeStart = isDateKey(params?.start) ? params.start : todayParisDateKey();
  const rangeDays = Array.from({ length: DAYS_TO_SHOW }, (_, index) =>
    addDays(rangeStart, index),
  );
  const rangeEnd = rangeDays[rangeDays.length - 1];

  const selectedPropertyId = params?.property ?? "";
  const previousRange = addDays(rangeStart, -DAYS_TO_SHOW);
  const nextRange = addDays(rangeStart, DAYS_TO_SHOW);

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
    .lte("checkin_at", toIsoEnd(addDays(rangeEnd, 2)))
    .gte("checkout_at", toIsoStart(addDays(rangeStart, -2)))
    .order("checkin_at", { ascending: true });

  if (reservationsError) {
    throw new Error(`Impossible de charger les réservations : ${reservationsError.message}`);
  }

  const { data: requestsData, error: requestsError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .gte("scheduled_start_at", toIsoStart(addDays(rangeStart, -2)))
    .lte("scheduled_start_at", toIsoEnd(addDays(rangeEnd, 2)))
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
    if (!reservationTouchesRange(reservation, rangeStart, rangeEnd)) continue;

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

  const assignmentsByCleaner: Record<string, Row[]> = {};
  for (const assignment of assignments) {
    const cleanerId = String(assignment.cleaner_id);
    assignmentsByCleaner[cleanerId] = assignmentsByCleaner[cleanerId] ?? [];
    assignmentsByCleaner[cleanerId].push(assignment);
  }

  const departuresInRange = reservations.filter((reservation) =>
    rangeDays.includes(parisDateKey(reservation.checkout_at)),
  );

  const acceptedInRange = requests.filter((request) => request.status === "accepted").length;
  const reportsInRange = requests.filter((request) =>
    ["report_submitted", "completed"].includes(request.status),
  ).length;
  const proposedInRange = requests.filter((request) =>
    ["created", "sent"].includes(request.status),
  ).length;

  const alerts: { level: "red" | "orange" | "blue"; title: string; detail: string; href?: string }[] = [];

  for (const reservation of departuresInRange) {
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

  const primaryCount = assignments.filter((assignment) => assignment.role === "primary").length;
  const backupCount = assignments.filter((assignment) => assignment.role === "backup").length;

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

            <div className="flex flex-wrap gap-2">
              <Link
                href={propertyFilterHref(previousRange, selectedPropertyId)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
              >
                ← Précédent
              </Link>

              <Link
                href={propertyFilterHref(todayParisDateKey(), selectedPropertyId)}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                Aujourd’hui
              </Link>

              <Link
                href={propertyFilterHref(nextRange, selectedPropertyId)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
              >
                Suivant →
              </Link>
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {longDateLabel(rangeStart)} → {longDateLabel(rangeEnd)}
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm text-slate-300">Départs</p>
            <p className="mt-2 text-4xl font-bold">{departuresInRange.length}</p>
            <p className="mt-1 text-sm text-slate-300">{rangeLabel(rangeStart, rangeEnd)}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Missions acceptées</p>
            <p className="mt-2 text-4xl font-bold text-emerald-700">{acceptedInRange}</p>
            <p className="mt-1 text-sm text-slate-500">intervenante confirmée</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">À confirmer</p>
            <p className="mt-2 text-4xl font-bold text-sky-700">{proposedInRange}</p>
            <p className="mt-1 text-sm text-slate-500">proposées ou à envoyer</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Alertes</p>
            <p className={`mt-2 text-4xl font-bold ${alerts.length ? "text-orange-700" : "text-emerald-700"}`}>
              {alerts.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {alerts.length ? "à surveiller" : "tout roule"}
            </p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            <Link
              href={propertyFilterHref(rangeStart)}
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
                href={propertyFilterHref(rangeStart, property.id)}
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

        <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
          <section className="space-y-5">
            {alerts.length > 0 && (
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-xl font-bold text-slate-950">
                  À surveiller
                </h2>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
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

            {visibleProperties.map((property) => {
              const propertyReservations = reservationsByProperty[property.id] ?? [];
              const propertyRequests = requestsByProperty[property.id] ?? [];

              return (
                <article
                  key={property.id}
                  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"
                >
                  <div className="border-b border-slate-100 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-slate-950">
                          {property.name}
                        </h2>
                        {property.address && (
                          <p className="mt-1 text-sm text-slate-500">
                            {property.address}
                          </p>
                        )}
                      </div>

                      <p className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                        {rangeLabel(rangeStart, rangeEnd)}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto p-4">
                    <div className="min-w-[1180px] space-y-3">
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${rangeDays.length}, minmax(74px, 1fr))`,
                        }}
                      >
                        {rangeDays.map((dayKey) => {
                          const isToday = dayKey === todayParisDateKey();

                          return (
                            <div
                              key={dayKey}
                              className={`rounded-2xl p-3 text-center ${
                                isToday
                                  ? "bg-slate-950 text-white"
                                  : "bg-slate-50 text-slate-600"
                              }`}
                            >
                              <p className="text-xs font-bold uppercase opacity-70">
                                {shortDayName(dayKey)}
                              </p>
                              <p className="mt-1 text-lg font-black">
                                {Number(dayKey.slice(8, 10))}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div
                        className="grid gap-2 rounded-3xl bg-slate-50 p-3"
                        style={{
                          gridTemplateColumns: `repeat(${rangeDays.length}, minmax(74px, 1fr))`,
                        }}
                      >
                        {propertyReservations
                          .filter((reservation) => reservationGridSpan(reservation, rangeDays))
                          .map((reservation) => {
                            const span = reservationGridSpan(reservation, rangeDays);
                            if (!span) return null;

                            return (
                              <div
                                key={reservation.id}
                                className="rounded-2xl bg-gradient-to-br from-slate-950 to-slate-700 p-4 text-white shadow-sm"
                                style={{
                                  gridColumn: `${span.start} / span ${span.span}`,
                                }}
                              >
                                <p className="text-xs font-semibold text-slate-300">
                                  Séjour
                                </p>

                                <p className="mt-1 truncate text-lg font-black">
                                  {span.clippedStart ? "… " : ""}
                                  {reservationTitle(reservation)}
                                  {span.clippedEnd ? " …" : ""}
                                </p>

                                <p className="mt-1 text-sm text-slate-300">
                                  {compactDateLabel(parisDateKey(reservation.checkin_at))} · {timeLabel(reservation.checkin_at)}
                                  {" → "}
                                  {compactDateLabel(parisDateKey(reservation.checkout_at))} · {timeLabel(reservation.checkout_at)}
                                </p>
                              </div>
                            );
                          })}
                      </div>

                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${rangeDays.length}, minmax(74px, 1fr))`,
                        }}
                      >
                        {rangeDays.map((dayKey) => {
                          const checkouts = propertyReservations.filter((reservation) =>
                            reservationChecksOutOn(reservation, dayKey),
                          );
                          const checkins = propertyReservations.filter((reservation) =>
                            reservationChecksInOn(reservation, dayKey),
                          );
                          const cleanings = propertyRequests.filter((request) =>
                            requestScheduledOn(request, dayKey),
                          );

                          const hasActivity =
                            checkouts.length > 0 || checkins.length > 0 || cleanings.length > 0;

                          return (
                            <div
                              key={`${property.id}-${dayKey}-turnover`}
                              className={`min-h-40 rounded-3xl border p-3 ${
                                hasActivity
                                  ? "border-slate-200 bg-white shadow-sm"
                                  : "border-slate-100 bg-slate-50"
                              }`}
                            >
                              {!hasActivity ? (
                                <p className="pt-10 text-center text-xs text-slate-300">
                                  —
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {checkouts.map((reservation) => {
                                    const request = requestByReservationId[reservation.id];

                                    return (
                                      <div key={`${reservation.id}-out`}>
                                        <div
                                          className={`rounded-2xl p-3 ${
                                            request
                                              ? "bg-amber-50 text-amber-950 ring-1 ring-amber-100"
                                              : "bg-red-50 text-red-900 ring-2 ring-red-200"
                                          }`}
                                        >
                                          <div className="flex items-start gap-2">
                                            <span className="text-lg">↗</span>
                                            <div className="min-w-0">
                                              <p className="text-xs font-bold uppercase opacity-70">
                                                Départ {timeLabel(reservation.checkout_at)}
                                              </p>
                                              <p className="truncate text-sm font-black">
                                                {reservationTitle(reservation)}
                                              </p>
                                            </div>
                                          </div>

                                          {!request && (
                                            <p className="mt-2 rounded-xl bg-red-100 px-2 py-1 text-xs font-black text-red-800">
                                              Ménage manquant
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}

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
                                            <p className="truncate text-sm font-black text-slate-950">
                                              {fullName(cleaner)}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                              🧹 {timeLabel(request.scheduled_start_at)}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-1">
                                          <span
                                            className={`rounded-full px-2 py-1 text-[11px] font-bold ${requestStatusClasses(
                                              request.status,
                                            )}`}
                                          >
                                            {requestStatusLabel(request.status)}
                                          </span>
                                          <span
                                            className={`rounded-full px-2 py-1 text-[11px] font-bold ${sms.className}`}
                                          >
                                            {sms.label}
                                          </span>
                                          {reports.length > 0 && (
                                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-bold text-violet-800">
                                              Rapport
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-2">
                                          <p className="text-sm font-black text-slate-950">
                                            {euro(request.total_cost_eur)}
                                          </p>
                                          <Link
                                            href={missionHref(request)}
                                            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                                          >
                                            Ouvrir
                                          </Link>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {checkins.map((reservation) => (
                                    <div
                                      key={`${reservation.id}-in`}
                                      className="rounded-2xl bg-emerald-50 p-3 text-emerald-950 ring-1 ring-emerald-100"
                                    >
                                      <div className="flex items-start gap-2">
                                        <span className="text-lg">↘</span>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold uppercase opacity-70">
                                            Arrivée {timeLabel(reservation.checkin_at)}
                                          </p>
                                          <p className="truncate text-sm font-black">
                                            {reservationTitle(reservation)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
                  {uniqueCleanerIds.length} personne(s) de confiance
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {primaryCount} affectation(s) principale(s) · {backupCount} renfort(s)
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

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-bold text-slate-950">
                Équipe disponible
              </h3>

              <div className="mt-4 space-y-3">
                {uniqueCleanerIds.length === 0 && (
                  <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800">
                    Aucune intervenante affectée.
                  </p>
                )}

                {uniqueCleanerIds.map((cleanerId) => {
                  const cleaner = cleanerById[cleanerId];
                  const cleanerAssignments = assignmentsByCleaner[cleanerId] ?? [];
                  const primaryAssignments = cleanerAssignments.filter(
                    (assignment) => assignment.role === "primary",
                  ).length;
                  const backupAssignments = cleanerAssignments.filter(
                    (assignment) => assignment.role === "backup",
                  ).length;

                  return (
                    <div
                      key={cleanerId}
                      className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"
                    >
                      {cleanerPhoto(cleaner, "h-12 w-12")}

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-slate-950">
                          {fullName(cleaner)}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cleanerStatusClass(
                              cleaner,
                            )}`}
                          >
                            {cleanerStatusLabel(cleaner)}
                          </span>

                          {primaryAssignments > 0 && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${roleClass("primary")}`}>
                              {primaryAssignments} principale
                            </span>
                          )}

                          {backupAssignments > 0 && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${roleClass("backup")}`}>
                              {backupAssignments} renfort
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {cleaner.phone || "Téléphone non renseigné"}
                        </p>
                      </div>

                      {cleaner?.public_token && (
                        <Link
                          href={`/cleaner/${cleaner.public_token}`}
                          className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"
                        >
                          Planning
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
