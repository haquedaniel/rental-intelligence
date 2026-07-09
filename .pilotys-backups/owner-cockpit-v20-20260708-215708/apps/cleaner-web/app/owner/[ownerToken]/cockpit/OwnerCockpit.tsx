"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  DailyPrice,
  MetricId,
  OwnerCockpitData,
  OwnerCockpitListing,
  PlanningMarker,
  PlanningReservation,
  Tone,
  TimelineEvent,
} from "./types";

const MONTH_TARGET_FALLBACK = 4000;

function formatMoney(value: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

function toneSoft(tone: Tone) {
  const classes: Record<Tone, string> = {
    navy: "bg-[#112532]/6 text-[#112532] ring-[#112532]/10",
    blue: "bg-[#80A5B7]/16 text-[#315b6f] ring-[#80A5B7]/25",
    orange: "bg-[#E0680E]/12 text-[#B6520A] ring-[#E0680E]/18",
    mustard: "bg-[#F4B044]/18 text-[#8F6208] ring-[#F4B044]/28",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return classes[tone];
}

function toneSolid(tone: Tone) {
  const classes: Record<Tone, string> = {
    navy: "bg-[#112532]",
    blue: "bg-[#80A5B7]",
    orange: "bg-[#E0680E]",
    mustard: "bg-[#F4B044]",
    green: "bg-emerald-500",
  };
  return classes[tone];
}

function tensionColor(value: number) {
  if (value > 0.72) return "bg-[#E0680E]";
  if (value > 0.52) return "bg-[#F4B044]";
  return "bg-[#80A5B7]";
}

function listingById(listings: OwnerCockpitListing[], id: string) {
  return listings.find((listing) => listing.id === id);
}

function ShellCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.7rem] bg-white shadow-[0_10px_30px_rgba(17,37,50,0.06)] ring-1 ring-[#112532]/8 ${className}`}>{children}</section>;
}

function PilotysMark() {
  return (
    <div className="flex items-center gap-3">
      <img src="/pilotys-assets/logo-mark-p.svg" alt="Pilotys" className="h-12 w-12 rounded-[1.1rem] shadow-sm" />
      <span className="text-xl font-black tracking-[0.28em] text-[#112532]">PILOTYS</span>
    </div>
  );
}

function TopNav({ notificationCount }: { notificationCount: number }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#112532]/8 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <PilotysMark />
        <div className="flex items-center gap-2">
          <button className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F8FA] text-[#112532] ring-1 ring-[#112532]/8">
            ◴
            {notificationCount > 0 ? (
              <span className="absolute -right-0.5 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#E0680E] px-1 text-xs font-black text-white">
                {Math.min(9, notificationCount)}
              </span>
            ) : null}
          </button>
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-black text-[#112532] ring-1 ring-[#112532]/10">≡</button>
        </div>
      </div>
    </header>
  );
}

function MoneyHero({ data }: { data: OwnerCockpitData }) {
  const [elapsed, setElapsed] = useState(0);
  const [metric, setMetric] = useState<MetricId>("realised");

  useEffect(() => {
    const started = Date.now();
    const interval = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 700);
    return () => window.clearInterval(interval);
  }, []);

  const realised = data.financial.realisedRevenue + elapsed * 0.0074;
  const gross = data.financial.grossAnnualRevenue;
  const net = data.financial.afterVariables;

  return (
    <section className="space-y-4">
      <button
        onClick={() => setMetric("realised")}
        className={`relative w-full overflow-hidden rounded-[1.8rem] bg-white p-5 text-left shadow-[0_12px_32px_rgba(17,37,50,0.06)] ring-1 transition sm:p-6 ${
          metric === "realised" ? "ring-[#E0680E]/35" : "ring-[#112532]/8"
        }`}
      >
        <img src="/pilotys-assets/pattern-routes.svg" alt="" className="absolute right-0 top-0 hidden h-full w-72 opacity-70 sm:block" />
        <div className="relative">
          <p className="text-sm font-black uppercase tracking-[0.17em] text-[#E0680E]">CA réalisé</p>
          <p className="mt-2 text-6xl font-black tracking-tight text-[#112532] sm:text-7xl">{formatMoney(realised, 2)}</p>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <MetricButton active={metric === "gross"} onClick={() => setMetric("gross")} label="CA brut annuel" value={formatMoney(gross)} delta={data.financial.grossDeltaPct} tone="blue" />
        <MetricButton active={metric === "net"} onClick={() => setMetric("net")} label="Après variables" value={formatMoney(net)} delta={data.financial.afterVariablesDeltaPct} tone="mustard" />
      </div>

      <MetricPanel data={data} metric={metric} />
    </section>
  );
}

function MetricButton({ active, onClick, label, value, delta, tone }: { active: boolean; onClick: () => void; label: string; value: string; delta?: number | null; tone: Tone }) {
  const wave = tone === "mustard" ? "#F4B044" : "#80A5B7";
  const icon = tone === "mustard" ? "€" : "▮▮▮";

  return (
    <button
      onClick={onClick}
      className={`relative min-h-[11.5rem] overflow-hidden rounded-[1.6rem] bg-white p-4 text-left shadow-[0_10px_28px_rgba(17,37,50,0.05)] ring-1 transition sm:min-h-[12rem] sm:p-5 ${
        active ? "ring-[#E0680E]/36 shadow-[0_14px_34px_rgba(224,104,14,0.09)]" : "ring-[#112532]/8 hover:ring-[#112532]/15"
      }`}
    >
      <svg viewBox="0 0 320 90" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-14 w-full opacity-25">
        <path d="M0 48 C58 82 104 38 164 55 C222 72 262 25 320 45 V90 H0 Z" fill={wave} />
      </svg>
      <div className="relative flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ring-1 sm:h-12 sm:w-12 ${toneSoft(tone)}`}>{icon}</span>
        <span className="text-[0.7rem] font-black uppercase leading-4 tracking-[0.05em] text-[#112532] sm:text-sm">{label}</span>
      </div>
      <p className="relative mt-6 text-3xl font-black tracking-tight text-[#112532] sm:text-4xl">{value}</p>
      {typeof delta === "number" ? <p className="relative mt-5 text-sm font-black text-emerald-500">vs N-1 · ↑ {Math.round(delta)} %</p> : null}
    </button>
  );
}

function MetricPanel({ data, metric }: { data: OwnerCockpitData; metric: MetricId }) {
  if (metric === "gross") {
    const total = Math.max(1, data.listings.reduce((sum, listing) => sum + listing.revenue, 0));

    return (
      <ShellCard className="overflow-hidden p-5 sm:p-6">
        <h2 className="text-3xl font-black tracking-tight text-[#112532]">CA brut par logement</h2>
        <div className="mt-5 space-y-4">
          {data.listings.map((listing) => (
            <div key={listing.id} className="grid grid-cols-[8rem_1fr_5.5rem] items-center gap-3 text-sm font-black sm:grid-cols-[12rem_1fr_7rem]">
              <span className="truncate text-[#112532]/70">{listing.name}</span>
              <div className="h-4 overflow-hidden rounded-full bg-[#F4F8FA] ring-1 ring-[#112532]/6">
                <div className="h-full rounded-full" style={{ width: `${Math.max(8, (listing.revenue / total) * 100)}%`, backgroundColor: listing.dot }} />
              </div>
              <span className="text-right text-[#112532]">{formatMoney(listing.revenue)}</span>
            </div>
          ))}
        </div>
      </ShellCard>
    );
  }

  if (metric === "net") {
    const gross = data.financial.grossAnnualRevenue;
    const net = data.financial.afterVariables;
    const variableCosts = data.financial.variableCosts ?? Math.max(0, gross - net);
    const expenseItems = data.financial.expenseBreakdownItems ?? [];

    const rows = [
      { label: "CA brut", value: gross, width: 100, tone: "blue" as Tone, sign: "" },
      { label: "Coûts variables", value: variableCosts, width: gross ? (variableCosts / gross) * 100 : 0, tone: "mustard" as Tone, sign: "-" },
      { label: "Après variables", value: net, width: gross ? (net / gross) * 100 : 0, tone: "orange" as Tone, sign: "" },
    ];

    return (
      <ShellCard className="overflow-hidden p-5 sm:p-6">
        <h2 className="text-3xl font-black tracking-tight text-[#112532]">Après variables</h2>
        <div className="mt-5 space-y-4">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[8rem_1fr_5.5rem] items-center gap-3 text-sm font-black sm:grid-cols-[12rem_1fr_7rem]">
              <span className="truncate text-[#112532]/70">{row.label}</span>
              <div className="h-4 overflow-hidden rounded-full bg-[#F4F8FA] ring-1 ring-[#112532]/6">
                <div className={`h-full rounded-full ${toneSolid(row.tone)}`} style={{ width: `${Math.max(4, row.width)}%` }} />
              </div>
              <span className="text-right text-[#112532]">{row.sign}{formatMoney(row.value)}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[1.35rem] bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-[#80A5B7]">Détail des coûts variables</p>
            <p className="text-sm font-black text-[#112532]">{formatMoney(variableCosts)}</p>
          </div>

          {expenseItems.length === 0 ? (
            <p className="mt-3 text-sm font-bold text-[#112532]/55">
              Aucun détail de ligne détecté. Si le total existe, il vient probablement de lignes mensuelles sans catégorie reconnue.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {expenseItems.map((item) => {
                const pct = variableCosts ? Math.round((item.amount / variableCosts) * 100) : 0;
                return (
                  <div key={item.label} className="rounded-2xl bg-white p-3 ring-1 ring-[#112532]/6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#112532]">{item.label}</p>
                        <p className="mt-0.5 text-[11px] font-bold text-[#112532]/45">{item.count} ligne{item.count > 1 ? "s" : ""} · {pct}% des coûts</p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-[#112532]">{formatMoney(item.amount)}</p>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#F4F8FA] ring-1 ring-[#112532]/6">
                      <div className="h-full rounded-full bg-[#F4B044]" style={{ width: `${Math.max(4, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ShellCard>
    );
  }

  return <MonthlyRevenueChart data={data} />;
}

function MonthlyRevenueChart({ data }: { data: OwnerCockpitData }) {
  const max = Math.max(1, ...data.monthlyRevenue.map((row) => row.realised + row.future, MONTH_TARGET_FALLBACK));
  return (
    <ShellCard className="overflow-hidden p-5 sm:p-6">
      <h2 className="text-3xl font-black tracking-tight text-[#112532]">Revenus mensuels</h2>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-black text-[#112532]/65">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-7 rounded-full bg-[#E0680E]" />Réalisé</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-7 rounded-full bg-[#80A5B7]" />À venir</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-7 border-t-2 border-dashed border-[#F4B044]" />Objectif</span>
      </div>
      <div className="relative mt-5">
        <div className="absolute left-0 right-0 top-[43%] border-t-2 border-dashed border-[#F4B044]" />
        <div className="grid grid-cols-12 items-end gap-1.5 sm:gap-3">
          {data.monthlyRevenue.map((row) => {
            const total = row.realised + row.future;
            const totalHeight = Math.max(28, (total / max) * 184);
            const realisedPct = total ? (row.realised / total) * 100 : 0;
            const futurePct = total ? (row.future / total) * 100 : 0;
            return (
              <div key={row.month} className="relative flex min-w-0 flex-col items-center gap-3">
                <div className="relative flex h-[196px] w-full items-end justify-center">
                  <div className={`flex w-full max-w-[2.05rem] flex-col-reverse overflow-hidden rounded-t-[1rem] shadow-sm ${row.live ? "ring-2 ring-[#E0680E]/25" : ""}`} style={{ height: `${totalHeight}px` }}>
                    {row.realised > 0 ? <div className="w-full bg-[#E0680E]" style={{ height: `${realisedPct}%` }} /> : null}
                    {row.future > 0 ? <div className="w-full bg-[#80A5B7]" style={{ height: `${futurePct}%` }} /> : null}
                  </div>
                </div>
                <span className="text-[0.65rem] font-black uppercase tracking-[-0.02em] text-[#477084] sm:text-xs">{row.month}</span>
              </div>
            );
          })}
        </div>
      </div>
    </ShellCard>
  );
}

function SmartBrief({ data }: { data: OwnerCockpitData }) {
  const payment = data.timelineEvents.find((event) => event.title.toLowerCase().includes("paiement"));
  const firstUrgent = data.timelineEvents.find((event) => event.tone === "orange") ?? data.timelineEvents[0];

  return (
    <ShellCard className="overflow-hidden p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF6EF] text-xl text-[#E0680E] ring-1 ring-[#E0680E]/14">✦</span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">À retenir</p>
          <p className="mt-2 text-xl font-black leading-8 text-[#112532] sm:text-2xl">
            {payment ? "Paiement à traiter." : firstUrgent ? firstUrgent.title : "Tout est à jour."}
            {firstUrgent ? <span className="text-[#E0680E]"> {firstUrgent.detail}</span> : null}
          </p>
        </div>
      </div>
    </ShellCard>
  );
}

function PropertySelector({ data, selected, setSelected }: { data: OwnerCockpitData; selected: string[]; setSelected: (next: string[]) => void }) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      if (selected.length > 1) setSelected(selected.filter((item) => item !== id));
      return;
    }
    setSelected([...selected, id]);
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">Logements</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-[#112532]">Sélection</h2>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex gap-3">
          {data.listings.map((listing) => {
            const active = selected.includes(listing.id);
            return (
              <button
                key={listing.id}
                onClick={() => toggle(listing.id)}
                className={`flex min-w-[13rem] items-center gap-3 rounded-[1.35rem] bg-white p-2 pr-4 text-left shadow-[0_8px_24px_rgba(17,37,50,0.05)] ring-1 transition ${
                  active ? "ring-[#E0680E]/35" : "opacity-55 ring-[#112532]/8"
                }`}
              >
                <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#F4F8FA]">
                  {listing.image ? <img src={listing.image} alt="" className="h-full w-full object-cover" /> : null}
                  <span className="absolute left-2 top-2 h-3 w-3 rounded-full ring-2 ring-white" style={{ backgroundColor: listing.dot }} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#112532]">{listing.name}</p>
                  <p className="mt-1 text-xs font-bold text-[#112532]/50">{listing.occupancy}% · {formatMoney(listing.revenue)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}


function AutoScrollPlanningRail({
  children,
  dayWidthPx,
  todayOffset,
}: {
  children: React.ReactNode;
  dayWidthPx: number;
  todayOffset: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;

    const targetLeft = Math.max(0, todayOffset * dayWidthPx - rail.clientWidth * 0.35);
    rail.scrollTo({ left: targetLeft, behavior: "instant" as ScrollBehavior });
  }, [dayWidthPx, todayOffset]);

  return (
    <div ref={ref} className="w-full overflow-x-auto bg-white">
      {children}
    </div>
  );
}

function Planning({ data, selected }: { data: OwnerCockpitData; selected: string[] }) {
  const selectedListings = data.listings.filter((listing) => selected.includes(listing.id));
  const dayWidthPx = 76;
  const dayWidth = `${dayWidthPx}px`;
  const todayOffset = Math.max(0, data.planningDays.findIndex((day) => day.key === data.today));
  const gridTemplateColumns = `repeat(${data.planningDays.length}, ${dayWidth})`;

  const reservationsByListing = useMemo(() => {
    const map = new Map<string, PlanningReservation[]>();
    for (const listing of data.listings) map.set(listing.id, []);
    for (const reservation of data.planningReservations) {
      const list = map.get(reservation.listingId) ?? [];
      list.push(reservation);
      map.set(reservation.listingId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start - b.start);
    return map;
  }, [data.listings, data.planningReservations]);

  const coveredDaysByListing = useMemo(() => {
    const covered = new Map<string, Set<number>>();
    for (const listing of data.listings) covered.set(listing.id, new Set<number>());
    for (const reservation of data.planningReservations) {
      const set = covered.get(reservation.listingId);
      if (!set) continue;
      for (let day = reservation.start; day < reservation.start + reservation.span; day++) set.add(day);
    }
    return covered;
  }, [data.listings, data.planningReservations]);

  const dailyPriceByKey = useMemo(() => {
    const map = new Map<string, DailyPrice>();
    for (const price of data.dailyPrices) map.set(`${price.listingId}:${price.day}`, price);
    return map;
  }, [data.dailyPrices]);

  const markerGroups = useMemo(() => {
    const map = new Map<string, PlanningMarker[]>();
    for (const marker of data.planningMarkers) {
      const key = `${marker.listingId}:${marker.day}`;
      const list = map.get(key) ?? [];
      list.push(marker);
      map.set(key, list);
    }
    return map;
  }, [data.planningMarkers]);

  return (
    <ShellCard className="overflow-hidden">
      <div className="border-b border-[#112532]/8 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">Planning</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-[#112532]">Réservations & missions</h2>
          </div>
          <p className="max-w-xl text-sm font-bold text-[#112532]/55">
            Une ligne par logement : séjour en haut, missions en bas, prix indicatifs dans les jours libres.
          </p>
        </div>
      </div>

      <AutoScrollPlanningRail dayWidthPx={dayWidthPx} todayOffset={todayOffset}>
        <div className="min-w-max p-3">
          <div className="grid grid-cols-[13.5rem_auto] gap-3">
            <div className="sticky left-0 z-40 rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#80A5B7] shadow-sm ring-1 ring-[#112532]/8">
              Logement
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns }}>
              {data.monthSpans.map((span) => (
                <div key={`${span.month}-${span.start}`} className="rounded-2xl bg-[#F4F8FA] px-4 py-2 text-sm font-black text-[#477084]" style={{ gridColumn: `${span.start} / span ${span.span}` }}>
                  {span.month}
                </div>
              ))}
            </div>

            <div className="sticky left-0 z-40 rounded-2xl bg-white px-4 py-3 text-xs font-black text-[#112532]/45 shadow-sm ring-1 ring-[#112532]/8">
              Date
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns }}>
              {data.planningDays.map((day) => (
                <div key={day.key} className="whitespace-pre-line rounded-2xl bg-[#F4F8FA] px-2 py-2 text-center text-[11px] font-black leading-4 text-[#112532]/60 ring-1 ring-[#112532]/5">
                  {day.label}
                </div>
              ))}
            </div>

            <div className="sticky left-0 z-40 rounded-2xl bg-white px-4 py-2 text-xs font-black text-[#112532]/45 shadow-sm ring-1 ring-[#112532]/8">
              Marché
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns }}>
              {data.planningDays.map((day) => (
                <div key={`tension-${day.key}`} className={`h-3 rounded-full ${tensionColor(day.tension)}`} style={{ opacity: 0.18 + day.tension * 0.38 }} />
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {selectedListings.map((listing) => {
              const rowReservations = reservationsByListing.get(listing.id) ?? [];
              const coveredDays = coveredDaysByListing.get(listing.id) ?? new Set<number>();

              return (
                <div key={listing.id} className="grid grid-cols-[13.5rem_auto] gap-3">
                  <div className="sticky left-0 z-30 flex h-[7.75rem] items-center gap-3 rounded-[1.35rem] bg-white p-4 shadow-sm ring-1 ring-[#112532]/8">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: listing.dot }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#112532]" title={listing.name}>{listing.name}</p>
                      <p className="mt-1 text-xs font-bold text-[#112532]/50">{listing.occupancy}% · {formatMoney(listing.revenue)}</p>
                    </div>
                  </div>

                  <div className="h-[7.75rem] rounded-[1.35rem] bg-[#F4F8FA]/72 p-2 ring-1 ring-[#112532]/5">
                    <div className="relative h-full overflow-hidden rounded-[1rem]">
                      <div className="absolute inset-0 grid gap-1" style={{ gridTemplateColumns }}>
                        {data.planningDays.map((_, index) => {
                          const day = index + 1;
                          const covered = coveredDays.has(day);
                          const price = dailyPriceByKey.get(`${listing.id}:${day}`);
                          return (
                            <div key={`${listing.id}-cell-${day}`} className="rounded-xl bg-white/88 ring-1 ring-white/70">
                              {!covered && price ? <div className="flex h-full items-end justify-center pb-1 text-[10px] font-black text-[#112532]/30">{Math.round(price.price)}€</div> : null}
                            </div>
                          );
                        })}
                      </div>

                      <div className="absolute left-0 right-0 top-0 grid h-[3.6rem] gap-1" style={{ gridTemplateColumns }}>
                        {rowReservations.map((reservation) => (
                          <div
                            key={reservation.id}
                            className="relative z-10 mt-1 h-[2.8rem] overflow-hidden rounded-2xl px-3 py-1 text-white shadow-sm ring-1 ring-white/70"
                            style={{ gridColumn: `${reservation.start} / span ${reservation.span}`, backgroundColor: listing.dot }}
                            title={`${reservation.guest} · ${formatMoney(reservation.price)} · ${reservation.span} nuits`}
                          >
                            <p className="truncate text-xs font-black leading-5">{reservation.guest} · {formatMoney(reservation.price)}</p>
                            <p className="truncate text-[10px] font-bold text-white/75">{reservation.span} nuits · {reservation.nightly}€/nuit</p>
                          </div>
                        ))}
                      </div>

                      <div className="absolute bottom-1 left-0 right-0 grid h-[2.35rem] gap-1" style={{ gridTemplateColumns }}>
                        {data.planningDays.map((_, index) => {
                          const day = index + 1;
                          const markers = markerGroups.get(`${listing.id}:${day}`) ?? [];
                          if (markers.length === 0) return <div key={`${listing.id}-mission-empty-${day}`} />;
                          const first = markers[0];
                          const label = markers.length > 1 ? `${markers.length} missions` : first.label;
                          return (
                            <div key={`${listing.id}-mission-${day}`} className="flex items-center justify-center">
                              <div
                                title={label}
                                className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[10px] font-black text-white shadow-sm ring-3 ring-white ${toneSolid(first.tone)}`}
                              >
                                {markers.length > 1 ? markers.length : first.icon}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AutoScrollPlanningRail>
    </ShellCard>
  );
}

function TimelineBrowser({ data }: { data: OwnerCockpitData }) {
  const past = data.timelineEvents.filter((event) => event.side === "past");
  const future = data.timelineEvents.filter((event) => event.side === "future");

  return (
    <ShellCard className="overflow-hidden p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">Activité</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-[#112532]">Timeline</h2>
      </div>

      <div className="relative mt-5 max-h-[34rem] overflow-y-auto pr-1">
        <div className="absolute bottom-0 left-[1.18rem] top-0 w-0.5 rounded-full bg-[#D8E6EC]" />

        <div className="space-y-3 pb-4">
          {past.map((event) => <TimelineRow key={event.id} event={event} listings={data.listings} muted />)}
        </div>

        <div className="relative my-4 flex items-center gap-3">
          <span className="z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#112532] text-xs font-black text-white ring-4 ring-white">auj.</span>
          <div className="h-px flex-1 bg-[#112532]/12" />
          <span className="rounded-full bg-[#112532]/6 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#112532]/55">Aujourd’hui</span>
        </div>

        <div className="space-y-3 pt-1">
          {future.map((event) => <TimelineRow key={event.id} event={event} listings={data.listings} />)}
        </div>
      </div>
    </ShellCard>
  );
}

function TimelineRow({ event, listings, muted = false }: { event: TimelineEvent; listings: OwnerCockpitListing[]; muted?: boolean }) {
  const listing = listingById(listings, event.listingId);
  const icon = event.kind === "arrival" ? "→" : event.kind === "departure" ? "↗" : event.kind === "cleaning" ? "✦" : "◆";
  const row = (
    <span className={`relative grid w-full grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl px-0 py-2 text-left transition hover:bg-[#F4F8FA] ${muted ? "opacity-72" : ""}`}>
      <span className={`z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white shadow-sm ring-4 ring-white ${toneSolid(event.tone)}`}>{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: listing?.dot ?? "#112532" }} />
          <span className="truncate text-base font-black text-[#112532]">{event.title}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold text-[#112532]/55">{listing?.name ?? "Logement"} · {event.detail}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs font-bold text-[#112532]/50">{event.time}</span>
        {event.status ? <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${toneSoft(event.tone)}`}>{event.status}</span> : null}
      </span>
    </span>
  );

  return event.href ? <a href={event.href}>{row}</a> : <button>{row}</button>;
}

function Opportunities({ data }: { data: OwnerCockpitData }) {
  return (
    <ShellCard className="overflow-hidden p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">Opportunités</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-[#112532]">À tester</h2>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.opportunities.map((item) => (
          <div key={item.id} className="rounded-[1.45rem] bg-white p-4 shadow-[0_8px_22px_rgba(17,37,50,0.04)] ring-1 ring-[#112532]/8">
            <div className="flex items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${toneSoft(item.tone)}`}>↗</span>
              <p className="text-lg font-black text-[#112532]">{item.title}</p>
            </div>
            <p className="mt-3 text-sm font-black text-[#112532]">{item.listing}</p>
            <p className="mt-1 text-sm font-bold text-[#112532]/58">{item.period}</p>
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#112532]/45">Potentiel estimé</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-[#E0680E]">{formatMoney(item.potential)}</p>
            </div>
            <button className={`mt-5 w-full rounded-full px-4 py-3 text-sm font-black ${item.tone === "orange" ? "bg-[#E0680E] text-white" : item.tone === "mustard" ? "border border-[#F4B044] bg-white text-[#D58908]" : "border border-[#80A5B7] bg-white text-[#477084]"}`}>
              {item.action}
            </button>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}

function BottomNav() {
  const items = [
    { label: "Cockpit", icon: "⌖", active: true },
    { label: "Réservations", icon: "▦" },
    { label: "Paiements", icon: "€" },
    { label: "Logements", icon: "⌂" },
    { label: "Paramètres", icon: "⚙" },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#112532]/10 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur xl:hidden">
      <div className="grid grid-cols-5 gap-2">
        {items.map((item) => (
          <button key={item.label} className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black ${item.active ? "text-[#E0680E]" : "text-[#112532]/65"}`}>
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function OwnerCockpit({ data }: { data: OwnerCockpitData }) {
  const [selected, setSelected] = useState<string[]>(data.selectedListingIds);

  useEffect(() => {
    setSelected(data.selectedListingIds);
  }, [data.selectedListingIds]);

  if (data.listings.length === 0) {
    return (
      <main className="min-h-screen bg-[#F4F8FA] pb-28 text-[#112532] xl:pb-10">
        <TopNav notificationCount={0} />
        <div className="mx-auto max-w-3xl px-4 py-10">
          <ShellCard className="p-6">
            <h1 className="text-3xl font-black">Aucun logement lié</h1>
            <p className="mt-2 font-bold text-[#112532]/55">
              Ce lien propriétaire est actif, mais aucun bien n’est encore associé.
            </p>
          </ShellCard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F8FA] pb-28 text-[#112532] xl:pb-10">
      <TopNav notificationCount={data.timelineEvents.filter((event) => event.tone === "orange").length} />

      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <MoneyHero data={data} />
        <SmartBrief data={data} />
        <PropertySelector data={data} selected={selected} setSelected={setSelected} />
        <Planning data={data} selected={selected} />

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <TimelineBrowser data={data} />
          <Opportunities data={data} />
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
