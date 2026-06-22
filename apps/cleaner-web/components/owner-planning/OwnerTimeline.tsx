import Link from "next/link";
import {
  buildTimelineUnits,
  compactDateLabel,
  dateInUnit,
  fullName,
  initials,
  manualActionNeeded,
  manualMissionHref,
  requestIssueHref,
  marketTensionScore,
  missingIssueHref,
  missionTypeIcon,
  missionTypeLabel,
  modeLabel,
  parisDateKey,
  reportHref,
  requestStatusClass,
  requestStatusLabel,
  reservationTitle,
  reservationHref,
  spanForRange,
  tensionClass,
  tensionLabel,
  timeLabel,
  type Row,
} from "./timelineUtils";

function CleanerAvatar({ cleaner, size = "h-6 w-6" }: { cleaner?: Row | null; size?: string }) {
  if (!cleaner) {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-red-50 text-[10px] font-black text-red-700 ring-1 ring-red-100`}>
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
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-700 ring-1 ring-slate-200`}>
      {initials(cleaner)}
    </div>
  );
}

function numberValue(row: Row, fields: string[]): number {
  for (const field of fields) {
    const raw = row?.[field];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function money(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function reservationRevenue(row: Row): number {
  return numberValue(row, [
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
}

function cleaningCost(row: Row): number {
  return numberValue(row, [
    "total_cost_eur",
    "cleaning_cost_eur",
    "amount_eur",
  ]);
}

function requestTimelineDateKey(request: Row): string | null {
  // Once the cleaner has chosen a ready day, the calendar should show the
  // mission on that chosen day, not on the original generated checkout slot.
  if (request.ready_by_at) return parisDateKey(request.ready_by_at);

  if (
    typeof request.ready_by_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(request.ready_by_date)
  ) {
    return request.ready_by_date;
  }

  if (request.scheduled_start_at) return parisDateKey(request.scheduled_start_at);

  return null;
}

function requestTimelineTimeLabel(request: Row): string {
  if (request.ready_by_at) return timeLabel(request.ready_by_at);
  if (request.ready_by_date) return "16h";
  return timeLabel(request.scheduled_start_at);
}

function hasUnresolvedFailedSms(messages: Row[]): boolean {
  const smsMessages = messages
    .filter((message) => message.channel === "sms" || String(message.message_type ?? "").includes("mission"))
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));

  if (smsMessages.length === 0) return false;

  const latest = smsMessages[smsMessages.length - 1];

  return latest.status === "failed";
}


function MarketRail({
  units,
  gridTemplateColumns,
}: {
  units: ReturnType<typeof buildTimelineUnits>;
  gridTemplateColumns: string;
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns }}>
      {units.map((unit) => {
        const score = marketTensionScore(unit.start);
        return (
          <div
            key={`${unit.key}-market`}
            title={`Marché ${tensionLabel(score)} · ${score}/100`}
            className={`h-1.5 rounded-full ${tensionClass(score)}`}
          />
        );
      })}
    </div>
  );
}

function PropertyTimelineCard({
  property,
  reservations,
  requests,
  cleanersById,
  outboundByRequestId,
  start,
  end,
  singleMode,
}: {
  property: Row;
  reservations: Row[];
  requests: Row[];
  cleanersById: Record<string, Row>;
  outboundByRequestId: Record<string, Row[]>;
  start: string;
  end: string;
  singleMode: boolean;
}) {
  const units = buildTimelineUnits(start, end);

  // Denser than v1. The whole point is to make this usable on mobile.
  const columnMin =
    units[0]?.mode === "daily"
      ? 32
      : units[0]?.mode === "weekly"
        ? 38
        : 44;

  const gridTemplateColumns = `repeat(${units.length}, ${columnMin}px)`;

  const redRequests = requests.filter(manualActionNeeded);
  const pendingRequests = requests.filter((request) => ["created", "sent"].includes(request.status) && !manualActionNeeded(request));
  const acceptedRequests = requests.filter((request) => request.status === "accepted");
  const propertyRevenue = reservations.reduce((sum, reservation) => sum + reservationRevenue(reservation), 0);
  const propertyCleaningCost = requests.reduce((sum, request) => sum + cleaningCost(request), 0);

  const missingCheckoutReservations = reservations.filter((reservation) => {
    if (!reservation.checkout_at) return false;
    const checkout = parisDateKey(reservation.checkout_at);
    if (checkout < start || checkout > end) return false;

    const hasActiveRequest = requests.some(
      (item) => item.reservation_id === reservation.id && item.status !== "cancelled",
    );
    return !hasActiveRequest;
  });

  return (
    <article className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-100 p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              {singleMode ? "Planning du logement" : "Logement"}
            </p>
            <h3 className="mt-0.5 truncate text-base font-black text-slate-950 sm:text-lg">{property.name}</h3>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
              CA {money(propertyRevenue)} · ménage {money(propertyCleaningCost)}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
              {modeLabel(units[0]?.mode ?? "daily")}
            </span>
            <Link
              href={manualMissionHref(property.id, start)}
              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-700 ring-1 ring-slate-200"
            >
              + Mission
            </Link>
          </div>
        </div>

        <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
          {redRequests.length > 0 && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black text-red-800">
              {redRequests.length} action
            </span>
          )}
          {missingCheckoutReservations.length > 0 && (
            <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white">
              {missingCheckoutReservations.length} manquant
            </span>
          )}
          {pendingRequests.length > 0 && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-900">
              {pendingRequests.length} attente
            </span>
          )}
          {acceptedRequests.length > 0 && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-800">
              {acceptedRequests.length} ok
            </span>
          )}
          {reservations.length > 0 && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">
              {reservations.length} séjour(s)
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-2 text-[9px] font-bold text-slate-400">
          <span>Marché</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-5 rounded-full bg-slate-100" /> faible
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-5 rounded-full bg-sky-100" /> normal
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-5 rounded-full bg-amber-200/70" /> fort
          </span>
        </div>
      </div>

      <div className="overflow-x-auto p-2 sm:p-3">
        <div className="min-w-max space-y-1.5">
          <div className="grid gap-1" style={{ gridTemplateColumns }}>
            {units.map((unit) => {
              const score = marketTensionScore(unit.start);
              return (
                <div
                  key={unit.key}
                  title={`Tension marché ${tensionLabel(score)} · ${score}/100`}
                  className="rounded-xl bg-white px-1.5 py-1 text-center ring-1 ring-slate-100"
                >
                  <p className="text-[8px] font-black uppercase leading-none text-slate-500">
                    {unit.mode === "daily" ? unit.label.slice(0, 3) : unit.label.slice(0, 4)}
                  </p>
                  <p className="mt-0.5 text-[9px] font-black leading-none text-slate-900">
                    {unit.mode === "daily" ? unit.start.slice(8, 10) : unit.subLabel}
                  </p>
                </div>
              );
            })}
          </div>

          <MarketRail units={units} gridTemplateColumns={gridTemplateColumns} />

          <div className="relative rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-100">
            <div className="absolute inset-1.5 grid gap-1" style={{ gridTemplateColumns }}>
              {units.map((unit) => {
                const score = marketTensionScore(unit.start);
                return (
                  <div
                    key={`${unit.key}-bg`}
                    className="rounded-xl bg-white/60"
                  />
                );
              })}
            </div>

            <div className="relative grid min-h-[34px] gap-1" style={{ gridTemplateColumns }}>
              {reservations.map((reservation) => {
                if (!reservation.checkin_at || !reservation.checkout_at) return null;

                const checkin = parisDateKey(reservation.checkin_at);
                const checkout = parisDateKey(reservation.checkout_at);
                const span = spanForRange(units, checkin, checkout);

                if (!span) return null;

                return (
                  <Link
                    key={reservation.id}
                    href={reservationHref(reservation)}
                    title={`${reservationTitle(reservation)}\nArrivée ${compactDateLabel(checkin)} · Départ ${compactDateLabel(checkout)}`}
                    className="z-10 min-h-8 rounded-lg bg-gradient-to-br from-slate-950 to-slate-700 px-1.5 py-1 text-white shadow-sm transition hover:scale-[1.01] hover:shadow-md"
                    style={{ gridColumn: `${span.start} / span ${span.span}` }}
                  >
                    <p className="truncate text-[10px] font-black">{reservationTitle(reservation)}</p>
                    <p className="mt-0.5 truncate text-[8px] font-bold text-white/70">
                      Détail séjour
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="grid gap-1 rounded-2xl bg-slate-50 p-1.5" style={{ gridTemplateColumns }}>
            {units.map((unit) => {
              const unitRequests = requests.filter((request) => {
                const dateKey = requestTimelineDateKey(request);
                if (!dateKey) return false;
                return dateInUnit(dateKey, unit);
              });

              const unitMissing = reservations.filter((reservation) => {
                if (!reservation.checkout_at) return false;
                if (!dateInUnit(parisDateKey(reservation.checkout_at), unit)) return false;
                const hasActiveRequest = requests.some(
                  (item) => item.reservation_id === reservation.id && item.status !== "cancelled",
                );
                return !hasActiveRequest;
              });

              const hasSomething = unitRequests.length > 0 || unitMissing.length > 0;

              return (
                <div
                  key={`${unit.key}-actions`}
                  className={`flex min-h-7 flex-col items-center justify-center gap-1 rounded-xl ${
                    hasSomething ? "bg-white/70 p-1 ring-1 ring-white" : "bg-transparent"
                  }`}
                >
                  {unitMissing.map((reservation) => (
                    <Link
                      key={`${reservation.id}-missing`}
                      href={missingIssueHref(reservation)}
                      className="w-full rounded-lg bg-red-600 px-1 py-0.5 text-center text-[9px] font-black leading-tight text-white"
                    >
                      Manquant
                    </Link>
                  ))}

                  {unitRequests.map((request) => {
                    const cleaner = cleanersById[request.assigned_cleaner_id];
                    const href = reportHref(request) ?? requestIssueHref(request);
                    const failedSms = hasUnresolvedFailedSms(outboundByRequestId[request.id] ?? []);
                    const label = failedSms ? "SMS échoué" : requestStatusLabel(request);
                    const statusClass = failedSms ? "bg-red-100 text-red-800 ring-red-200" : requestStatusClass(request);

                    const body = (
                      <div
                        title={[
                          missionTypeLabel(request),
                          fullName(cleaner),
                          `Statut: ${label}`,
                          request.schedule_status ? `Planning: ${request.schedule_status}` : "",
                          request.ready_by_at || request.ready_by_date
                            ? `Prêt avant: ${requestTimelineTimeLabel(request)}`
                            : `Heure: ${requestTimelineTimeLabel(request)}`,
                        ]
                          .filter(Boolean)
                          .join("\n")}
                        className="flex w-full items-center justify-center gap-1"
                      >
                        <span className={`flex min-w-0 items-center gap-1 rounded-full px-1 py-0.5 text-[8px] font-black leading-none ring-1 ${statusClass}`}>
                          <span>{missionTypeIcon(request.service_type)}</span>
                          <span className="truncate">{label}</span>
                        </span>
                        <CleanerAvatar cleaner={cleaner} />
                      </div>
                    );

                    return href ? (
                      <Link key={request.id} href={href} className="block w-full">
                        {body}
                      </Link>
                    ) : (
                      <div key={request.id} className="w-full">
                        {body}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

export function OwnerTimeline({
  properties,
  reservations,
  requests,
  cleanersById,
  outboundByRequestId,
  start,
  end,
  selectedPropertyId,
}: {
  properties: Row[];
  reservations: Row[];
  requests: Row[];
  cleanersById: Record<string, Row>;
  outboundByRequestId: Record<string, Row[]>;
  start: string;
  end: string;
  selectedPropertyId?: string;
}) {
  const visibleProperties = selectedPropertyId
    ? properties.filter((property) => property.id === selectedPropertyId)
    : properties;

  const singleMode = visibleProperties.length === 1;

  return (
    <section className="space-y-3">
      {visibleProperties.map((property) => (
        <PropertyTimelineCard
          key={property.id}
          property={property}
          reservations={reservations.filter((reservation) => reservation.property_id === property.id)}
          requests={requests.filter((request) => request.property_id === property.id)}
          cleanersById={cleanersById}
          outboundByRequestId={outboundByRequestId}
          start={start}
          end={end}
          singleMode={singleMode}
        />
      ))}
    </section>
  );
}
