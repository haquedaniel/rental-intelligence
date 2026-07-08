"use client";

import { useEffect, useState, type ReactNode } from "react";

type Tone = "navy" | "blue" | "orange" | "mustard" | "green";
type MetricId = "realised" | "gross" | "net";
type Scope = "all" | "peskerezh" | "apt4" | "apt5" | "apt2";
type Horizon = "72h" | "7j" | "saison";
type EventFilter = "all" | "stay" | "intervention" | "reservation" | "payment" | "alert";

type Listing = {
  id: Exclude<Scope, "all">;
  name: string;
  image: string;
  tone: Tone;
  status: string;
  revenue: number;
  occupancy: number;
};

type CompactEvent = {
  id: string;
  listingId: Scope;
  category: Exclude<EventFilter, "all">;
  when: string;
  title: string;
  line: string;
  amount?: string;
  status?: string;
  tone: Tone;
  horizon: Horizon[];
};

const listings: Listing[] = [
  { id: "peskerezh", name: "La Peskerezh", image: "/pilotys-assets/property-peskerezh.svg", tone: "blue", status: "Tout est à jour", revenue: 12540, occupancy: 72 },
  { id: "apt4", name: "Apt 4 · Balcon", image: "/pilotys-assets/property-balcon.svg", tone: "blue", status: "2 demandes en attente", revenue: 9210, occupancy: 66 },
  { id: "apt5", name: "Apt 5 · Sous les toits", image: "/pilotys-assets/property-attic.svg", tone: "mustard", status: "Planning à optimiser", revenue: 7860, occupancy: 64 },
  { id: "apt2", name: "Apt 2 · Jardin", image: "/pilotys-assets/property-garden.svg", tone: "orange", status: "Baisse d’occupation détectée", revenue: 6980, occupancy: 58 },
];

const monthlyRevenue = [
  { month: "Jan", realised: 820, future: 0 },
  { month: "Fév", realised: 2460, future: 0 },
  { month: "Mar", realised: 3180, future: 0 },
  { month: "Avr", realised: 3720, future: 0 },
  { month: "Mai", realised: 3520, future: 0 },
  { month: "Juin", realised: 4620, future: 0 },
  { month: "Juil", realised: 2686, future: 2380, live: true },
  { month: "Août", realised: 0, future: 4920 },
  { month: "Sept", realised: 0, future: 3580 },
  { month: "Oct", realised: 0, future: 4620 },
  { month: "Nov", realised: 0, future: 4080 },
  { month: "Déc", realised: 0, future: 3660 },
];

const planningDays = Array.from({ length: 46 }, (_, index) => {
  const julDays = 11; // 21-31 July
  const augDays = 31;
  if (index < julDays) {
    const day = 21 + index;
    return { key: `juil-${day}`, month: "Juillet", label: `${day}\n${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][index % 7]}`, monthStart: index === 0 };
  }
  if (index < julDays + augDays) {
    const day = index - julDays + 1;
    return { key: `aout-${day}`, month: "Août", label: `${String(day).padStart(2, "0")}\n${["Ven", "Sam", "Dim", "Lun", "Mar", "Mer", "Jeu"][(index - julDays) % 7]}`, monthStart: index === julDays };
  }
  const day = index - julDays - augDays + 1;
  return { key: `sept-${day}`, month: "Septembre", label: `${String(day).padStart(2, "0")}\n${["Mar", "Mer", "Jeu", "Ven"][(index - julDays - augDays) % 7]}`, monthStart: index === julDays + augDays };
});

const monthBands = [
  { label: "Juillet", start: 1, span: 11 },
  { label: "Août", start: 12, span: 31 },
  { label: "Septembre", start: 43, span: 4 },
];

const planningReservations = [
  { id: "stay-pesk-1", listingId: "peskerezh" as const, guest: "Durand", detail: "4 nuits", start: 2, span: 4 },
  { id: "stay-pesk-2", listingId: "peskerezh" as const, guest: "Mercier", detail: "7 nuits", start: 19, span: 7 },
  { id: "stay-apt4-1", listingId: "apt4" as const, guest: "Leroy", detail: "5 nuits", start: 4, span: 5 },
  { id: "stay-apt4-2", listingId: "apt4" as const, guest: "Mathis", detail: "3 nuits", start: 14, span: 3 },
  { id: "stay-apt4-3", listingId: "apt4" as const, guest: "Clara", detail: "6 nuits", start: 34, span: 6 },
  { id: "stay-apt5-1", listingId: "apt5" as const, guest: "Petit", detail: "trou à remplir", start: 3, span: 3 },
  { id: "stay-apt5-2", listingId: "apt5" as const, guest: "Bernard", detail: "6 nuits", start: 12, span: 6 },
  { id: "stay-apt5-3", listingId: "apt5" as const, guest: "Nguyen", detail: "5 nuits", start: 41, span: 5 },
  { id: "stay-apt2-1", listingId: "apt2" as const, guest: "Roux", detail: "4 nuits", start: 2, span: 4 },
  { id: "stay-apt2-2", listingId: "apt2" as const, guest: "Dupont", detail: "4 nuits", start: 18, span: 4 },
  { id: "stay-apt2-3", listingId: "apt2" as const, guest: "Martin", detail: "8 nuits", start: 29, span: 8 },
];

const planningMarkers = [
  { id: "clean-pesk", listingId: "peskerezh" as const, day: 6, icon: "✦", tone: "mustard" as Tone, label: "ménage" },
  { id: "clean-apt4", listingId: "apt4" as const, day: 10, icon: "✦", tone: "mustard" as Tone, label: "ménage" },
  { id: "interv-apt4", listingId: "apt4" as const, day: 17, icon: "↗", tone: "orange" as Tone, label: "intervention" },
  { id: "alert-apt5", listingId: "apt5" as const, day: 7, icon: "!", tone: "orange" as Tone, label: "alerte" },
  { id: "clean-apt2", listingId: "apt2" as const, day: 22, icon: "✦", tone: "mustard" as Tone, label: "ménage" },
  { id: "clean-apt2-2", listingId: "apt2" as const, day: 37, icon: "✦", tone: "mustard" as Tone, label: "ménage" },
];

const events: CompactEvent[] = [
  { id: "payment-sandrine", listingId: "all", category: "payment", when: "Aujourd’hui", title: "Paiement à valider", line: "Sandrine · ménage Apt 2 · rapport OK", amount: "54 €", status: "à valider", tone: "orange", horizon: ["72h", "7j", "saison"] },
  { id: "res-new-apt4", listingId: "apt4", category: "reservation", when: "Maintenant", title: "Nouvelle réservation", line: "Apt 4 · Claire Martin · 23–27 juillet", amount: "+684 €", status: "nouveau", tone: "blue", horizon: ["72h", "7j", "saison"] },
  { id: "report-apt5", listingId: "apt5", category: "intervention", when: "10:30", title: "Rapport ménage", line: "Apt 5 · 6 photos · aucun problème", status: "photos", tone: "blue", horizon: ["72h", "7j", "saison"] },
  { id: "checkout-pesk", listingId: "peskerezh", category: "stay", when: "11:00", title: "Départ", line: "La Peskerezh · Famille Leroy", status: "rotation", tone: "mustard", horizon: ["72h", "7j", "saison"] },
  { id: "arrival-apt2", listingId: "apt2", category: "stay", when: "16:00", title: "Arrivée", line: "Apt 2 · Thomas Roux", status: "prévu", tone: "blue", horizon: ["72h", "7j", "saison"] },
  { id: "paint-apt5", listingId: "apt5", category: "intervention", when: "Demain", title: "Intervention peinture", line: "Apt 5 · intervenant à confirmer", status: "à confirmer", tone: "orange", horizon: ["7j", "saison"] },
];

const opportunities = [
  { id: "gap-apt2", title: "Remplir un trou", listing: "Apt 2 · Jardin", period: "15–20 juillet · 5 nuits", potential: 620, action: "Agir maintenant", tone: "orange" as Tone },
  { id: "raise-apt5", title: "Derniers jours d’août", listing: "Apt 5 · Sous les toits", period: "27–31 août · 4 nuits", potential: 540, action: "Voir les tarifs", tone: "mustard" as Tone },
  { id: "ops-apt4", title: "Rotation serrée", listing: "Apt 4 · Balcon", period: "2 août · départ / arrivée", potential: 0, action: "Optimiser", tone: "blue" as Tone },
];

function formatMoney(value: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
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
  const classes: Record<Tone, string> = { navy: "bg-[#112532]", blue: "bg-[#80A5B7]", orange: "bg-[#E0680E]", mustard: "bg-[#F4B044]", green: "bg-emerald-500" };
  return classes[tone];
}

function ShellCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.65rem] bg-white shadow-[0_10px_30px_rgba(17,37,50,0.06)] ring-1 ring-[#112532]/8 ${className}`}>{children}</section>;
}

function PilotysMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/pilotys-assets/pilotys-logo-mark-v4.svg" alt="Pilotys" className="h-11 w-11 rounded-[1.05rem] shadow-sm" />
      {!compact && <span className="text-xl font-black tracking-[0.28em] text-[#112532]">PILOTYS</span>}
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#112532]/8 bg-white/94 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <PilotysMark />
        <nav className="hidden items-center gap-1 md:flex">
          {["Cockpit", "Réservations", "Paiements", "Logements", "Paramètres"].map((item) => (
            <button key={item} className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${item === "Cockpit" ? "bg-[#E0680E]/10 text-[#E0680E] ring-1 ring-[#E0680E]/20" : "text-[#112532]/65 hover:bg-[#F4F8FA] hover:text-[#112532]"}`}>{item}</button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#F4F8FA] text-[#112532] ring-1 ring-[#112532]/8">
            <span className="text-lg">◴</span>
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#E0680E] px-1 text-xs font-black text-white">2</span>
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-black text-[#112532] ring-1 ring-[#112532]/10">≡</button>
        </div>
      </div>
    </header>
  );
}

function MoneyDeck() {
  const [elapsed, setElapsed] = useState(0);
  const [metric, setMetric] = useState<MetricId>("realised");
  useEffect(() => {
    const started = Date.now();
    const interval = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 700);
    return () => window.clearInterval(interval);
  }, []);

  const realised = 8426.37 + elapsed * 0.0074;
  const gross = 24860;
  const net = 18420;

  return (
    <section className="space-y-4">
      <button onClick={() => setMetric("realised")} className={`relative w-full overflow-hidden rounded-[1.85rem] bg-white p-5 text-left shadow-[0_12px_34px_rgba(17,37,50,0.07)] ring-1 transition sm:p-6 ${metric === "realised" ? "ring-[#E0680E]/38" : "ring-[#112532]/8"}`}>
        <img src="/pilotys-assets/pattern-routes.svg" alt="" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover opacity-80 sm:block" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#E0680E]">CA réalisé</p>
            <p className="mt-3 text-6xl font-black tracking-tight text-[#112532] sm:text-7xl">{formatMoney(realised, 2)}</p>
          </div>
          <span className={`mt-1 h-3 w-3 rounded-full ${metric === "realised" ? "bg-[#E0680E]" : "bg-[#112532]/15"}`} />
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <MetricKpiCard active={metric === "gross"} onClick={() => setMetric("gross")} tone="blue" label="CA brut annuel" value={formatMoney(gross)} delta="↑ 12 %" icon="▮▮▮" />
        <MetricKpiCard active={metric === "net"} onClick={() => setMetric("net")} tone="mustard" label="Après variables" value={formatMoney(net)} delta="↑ 9 %" icon="€" />
      </div>

      <MetricPanel metric={metric} />
    </section>
  );
}

function MetricKpiCard({ active, onClick, tone, label, value, delta, icon }: { active: boolean; onClick: () => void; tone: Tone; label: string; value: string; delta: string; icon: string }) {
  const wave = tone === "mustard" ? "#F4B044" : "#80A5B7";
  return (
    <button onClick={onClick} className={`relative min-h-[11.25rem] overflow-hidden rounded-[1.55rem] bg-white p-4 text-left shadow-[0_10px_28px_rgba(17,37,50,0.05)] ring-1 transition sm:p-5 ${active ? "ring-[#E0680E]/38 shadow-[0_14px_34px_rgba(224,104,14,0.08)]" : "ring-[#112532]/8"}`}>
      <svg viewBox="0 0 320 90" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-14 w-full opacity-25"><path d="M0 48 C58 82 104 38 164 55 C222 72 262 25 320 45 V90 H0 Z" fill={wave} /></svg>
      <div className="relative flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ring-1 ${toneSoft(tone)}`}>{icon}</span>
        <span className="text-[0.72rem] font-black uppercase leading-4 tracking-[0.05em] text-[#112532] sm:text-sm">{label}</span>
      </div>
      <p className="relative mt-6 text-3xl font-black tracking-tight text-[#112532] sm:text-4xl">{value}</p>
      <p className="relative mt-5 text-sm font-black text-emerald-500">vs N-1 · {delta}</p>
    </button>
  );
}

function MetricPanel({ metric }: { metric: MetricId }) {
  if (metric === "gross") return <GrossBreakdown />;
  if (metric === "net") return <NetBreakdown />;
  return <RevenueYearChart />;
}

function RevenueYearChart() {
  const max = Math.max(...monthlyRevenue.map((row) => row.realised + row.future));
  return (
    <ShellCard className="overflow-hidden p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-[#112532]">Revenus mensuels</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-black text-[#112532]/62">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-7 rounded-full bg-[#E0680E]" />Réalisé</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-7 rounded-full bg-[#80A5B7]" />À venir</span>
            <span className="inline-flex items-center gap-2"><span className="h-0.5 w-7 border-t-2 border-dashed border-[#F4B044]" />Objectif</span>
          </div>
        </div>
      </div>
      <div className="-mx-2 mt-4 overflow-x-auto px-2 pb-1">
        <div className="relative min-w-[720px]">
          <div className="absolute left-0 right-0 top-[43%] border-t-2 border-dashed border-[#F4B044]" />
          <div className="grid grid-cols-12 items-end gap-4">
            {monthlyRevenue.map((row) => {
              const total = row.realised + row.future;
              const height = Math.max(32, (total / max) * 215);
              const realisedPct = total ? (row.realised / total) * 100 : 0;
              const futurePct = total ? (row.future / total) * 100 : 0;
              return (
                <div key={row.month} className="flex min-w-0 flex-col items-center gap-3">
                  <div className="flex h-[230px] w-full items-end justify-center">
                    <div className={`relative w-8 overflow-hidden rounded-t-[1rem] bg-[#E0680E] shadow-sm sm:w-9 ${row.live ? "ring-2 ring-[#E0680E]/25" : ""}`} style={{ height: `${height}px` }}>
                      {row.realised > 0 && <div className="absolute bottom-0 left-0 right-0 bg-[#E0680E]" style={{ height: `${realisedPct}%` }} />}
                      {row.future > 0 && <div className="absolute left-0 right-0 bg-[#80A5B7]" style={{ bottom: `${realisedPct}%`, height: `${futurePct}%` }} />}
                    </div>
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.03em] text-[#477084]">{row.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ShellCard>
  );
}

function GrossBreakdown() {
  const rows = [
    { label: "La Peskerezh", value: 10480, width: 84, tone: "blue" as Tone },
    { label: "Apt 4 · Balcon", value: 6480, width: 52, tone: "blue" as Tone },
    { label: "Apt 5 · Sous les toits", value: 4320, width: 35, tone: "mustard" as Tone },
    { label: "Apt 2 · Jardin", value: 3580, width: 29, tone: "orange" as Tone },
  ];
  return (
    <ShellCard className="p-5 sm:p-6">
      <h2 className="text-3xl font-black tracking-tight text-[#112532]">CA brut par logement</h2>
      <div className="mt-6 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-3 text-sm font-black sm:grid-cols-[12rem_1fr_7rem]">
            <span className="truncate text-[#112532]/70">{row.label}</span>
            <div className="h-4 overflow-hidden rounded-full bg-[#F4F8FA] ring-1 ring-[#112532]/6"><div className={`h-full rounded-full ${toneSolid(row.tone)}`} style={{ width: `${row.width}%` }} /></div>
            <span className="text-right text-[#112532]">{formatMoney(row.value)}</span>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}

function NetBreakdown() {
  const rows = [
    { label: "CA brut", value: 24860, width: 100, tone: "blue" as Tone, sign: "" },
    { label: "Ménage", value: 3240, width: 56, tone: "mustard" as Tone, sign: "-" },
    { label: "Commissions", value: 1120, width: 22, tone: "blue" as Tone, sign: "-" },
    { label: "Interventions", value: 430, width: 12, tone: "orange" as Tone, sign: "-" },
    { label: "Après variables", value: 18420, width: 74, tone: "orange" as Tone, sign: "" },
  ];
  return (
    <ShellCard className="p-5 sm:p-6">
      <h2 className="text-3xl font-black tracking-tight text-[#112532]">Après variables</h2>
      <div className="mt-6 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-3 text-sm font-black sm:grid-cols-[12rem_1fr_7rem]">
            <span className="truncate text-[#112532]/70">{row.label}</span>
            <div className="h-4 overflow-hidden rounded-full bg-[#F4F8FA] ring-1 ring-[#112532]/6"><div className={`h-full rounded-full ${toneSolid(row.tone)}`} style={{ width: `${row.width}%` }} /></div>
            <span className="text-right text-[#112532]">{row.sign}{formatMoney(row.value)}</span>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}

function SmartBrief() {
  return (
    <ShellCard className="overflow-hidden p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-[#FFF6EF] text-xl text-[#E0680E] ring-1 ring-[#E0680E]/14">✦</span>
        <p className="text-lg font-black leading-8 text-[#112532] sm:text-xl">
          <span className="text-[#E0680E]">Valider le paiement de Sandrine</span> aujourd’hui. Apt 2 est lent du 15 au 20 juillet : <span className="text-[#E0680E]">baisse modérée pertinente</span>.
        </p>
      </div>
    </ShellCard>
  );
}

function ListingCarousel({ scope, setScope }: { scope: Scope; setScope: (scope: Scope) => void }) {
  return (
    <section className="space-y-3">
      <SectionHeader title="Logements" action="Voir tous" />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex snap-x gap-4">
          {listings.map((listing) => (
            <button key={listing.id} onClick={() => setScope(listing.id)} className={`min-w-[84%] snap-start overflow-hidden rounded-[1.6rem] bg-white text-left shadow-[0_10px_28px_rgba(17,37,50,0.05)] ring-1 transition sm:min-w-[320px] ${scope === listing.id ? "ring-[#E0680E]/28" : "ring-[#112532]/8"}`}>
              <div className="relative h-36 overflow-hidden bg-[#F4F8FA]"><img src={listing.image} alt="" className="h-full w-full object-cover" /><span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-sm font-black ring-1 ${toneSoft(listing.tone)}`}>{listing.occupancy}%</span></div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xl font-black text-[#112532]">{listing.name}</p><p className="mt-1 text-sm font-bold text-[#112532]/55">Taux d’occupation</p></div><div className="text-right"><p className="text-xl font-black text-[#112532]">{formatMoney(listing.revenue)}</p><p className="text-sm font-bold text-[#112532]/55">CA réalisé</p></div></div>
                <div className="mt-4 flex items-center gap-2 border-t border-[#112532]/8 pt-3"><span className={`h-3 w-3 rounded-full ${toneSolid(listing.tone)}`} /><span className="truncate text-sm font-bold text-[#112532]/65">{listing.status}</span></div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black tracking-tight text-[#112532]">{title}</h2>{action && <button className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#477084] shadow-sm ring-1 ring-[#112532]/8">{action} →</button>}</div>;
}

function MiniPlanning({ scope, setScope }: { scope: Scope; setScope: (scope: Scope) => void }) {
  const visibleListings = scope === "all" ? listings : listings.filter((listing) => listing.id === scope);
  const dayWidth = "3.15rem";
  return (
    <ShellCard className="overflow-hidden">
      <div className="border-b border-[#112532]/8 p-5">
        <SectionHeader title="Planning" />
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-black text-[#112532]/62"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#80A5B7]" />Réservations</span><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#F4B044]" />Ménage</span><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#E0680E]" />Intervention</span></div>
      </div>
      <div className="w-full overflow-x-auto p-4">
        <div className="min-w-[1560px]">
          <div className="grid grid-cols-[124px_1fr] gap-2">
            <div />
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>{monthBands.map((band) => <div key={band.label} className="rounded-full bg-[#F4F8FA] px-4 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#477084] ring-1 ring-[#112532]/5" style={{ gridColumn: `${band.start} / span ${band.span}` }}>{band.label}</div>)}</div>
          </div>
          <div className="mt-2 grid grid-cols-[124px_1fr] gap-2">
            <div />
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>{planningDays.map((day) => <div key={day.key} className="whitespace-pre-line rounded-2xl bg-[#F4F8FA] px-1.5 py-1.5 text-center text-[10px] font-black leading-4 text-[#112532]/58 ring-1 ring-[#112532]/5">{day.label}</div>)}</div>
          </div>
          {visibleListings.map((listing) => {
            const rowReservations = planningReservations.filter((reservation) => reservation.listingId === listing.id);
            const rowMarkers = planningMarkers.filter((marker) => marker.listingId === listing.id);
            return (
              <div key={listing.id} className="mt-2 grid grid-cols-[124px_1fr] gap-2">
                <button onClick={() => setScope(listing.id)} className="flex min-h-[66px] items-center gap-2 rounded-2xl bg-[#F4F8FA] px-3 py-2 text-left"><span className={`h-3 w-3 shrink-0 rounded-full ${toneSolid(listing.tone)}`} /><span className="whitespace-normal text-xs font-black leading-4 text-[#112532]">{listing.name}</span></button>
                <div className="relative h-[66px] rounded-2xl bg-[#F4F8FA]/70">
                  <div className="absolute inset-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>{planningDays.map((day) => <div key={`${listing.id}-${day.key}`} className="rounded-xl bg-white/90" />)}</div>
                  <div className="absolute inset-x-2 top-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>{rowReservations.map((reservation) => <div key={reservation.id} className="h-10 rounded-2xl bg-[#80A5B7] px-3 py-1 text-left text-white shadow-sm ring-1 ring-white/55" style={{ gridColumn: `${reservation.start} / span ${reservation.span}` }}><p className="truncate text-xs font-black">{reservation.guest}</p><p className="truncate text-[10px] font-bold text-white/75">{reservation.detail}</p></div>)}</div>
                  <div className="absolute inset-x-2 bottom-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>{rowMarkers.map((marker) => <div key={marker.id} className={`flex h-7 w-7 items-center justify-center justify-self-center rounded-full text-[11px] font-black text-white shadow-md ring-4 ring-white ${toneSolid(marker.tone)}`} style={{ gridColumn: `${marker.day} / span 1` }}>{marker.icon}</div>)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ShellCard>
  );
}

function CompactEventFeed({ scope, horizon, setHorizon }: { scope: Scope; horizon: Horizon; setHorizon: (horizon: Horizon) => void }) {
  const [filter, setFilter] = useState<EventFilter>("all");
  const visibleEvents = events.filter((event) => (scope === "all" || event.listingId === scope || event.listingId === "all") && (filter === "all" || event.category === filter) && event.horizon.includes(horizon));
  return (
    <ShellCard className="overflow-hidden p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black tracking-tight text-[#112532]">Activité</h2><div className="flex gap-1 rounded-full bg-[#F4F8FA] p-1 text-xs font-black text-[#112532]/55">{(["72h", "7j", "saison"] as Horizon[]).map((item) => <button key={item} onClick={() => setHorizon(item)} className={horizon === item ? "rounded-full bg-white px-3 py-1.5 text-[#112532] shadow-sm" : "px-3 py-1.5"}>{item}</button>)}</div></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{([{ key: "all", label: "Tous" }, { key: "reservation", label: "Réservations" }, { key: "intervention", label: "Missions" }, { key: "stay", label: "Séjours" }, { key: "payment", label: "Paiements" }] as { key: EventFilter; label: string }[]).map((item) => <button key={item.key} onClick={() => setFilter(item.key)} className={filter === item.key ? "shrink-0 rounded-full bg-[#112532] px-4 py-2 text-xs font-black text-white" : "shrink-0 rounded-full bg-[#F4F8FA] px-4 py-2 text-xs font-black text-[#112532]/65"}>{item.label}</button>)}</div>
      <div className="relative mt-5 pl-5"><div className="absolute bottom-4 left-[1.15rem] top-4 w-0.5 rounded-full bg-[#80A5B7]/28" />
        <div className="space-y-3">{visibleEvents.map((event) => <div key={event.id} className="relative grid grid-cols-[2.5rem_1fr_auto] items-start gap-3 rounded-2xl bg-[#F4F8FA]/72 px-3 py-3 ring-1 ring-[#112532]/5"><span className={`z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white ring-4 ring-white ${toneSolid(event.tone)}`}>{event.category === "payment" ? "€" : event.category === "reservation" ? "+" : event.category === "stay" ? "→" : "✓"}</span><div className="min-w-0"><p className="truncate text-sm font-black text-[#112532]">{event.title}</p><p className="mt-0.5 truncate text-sm font-bold text-[#112532]/58">{event.line}</p></div><div className="text-right">{event.amount && <p className="text-sm font-black text-[#112532]">{event.amount}</p>}<p className="mt-0.5 text-xs font-bold text-[#112532]/55">{event.when}</p></div></div>)}</div>
      </div>
    </ShellCard>
  );
}

function Opportunities() {
  return (
    <ShellCard className="overflow-hidden p-5">
      <SectionHeader title="Opportunités" action="Voir toutes" />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{opportunities.map((item) => <div key={item.id} className="rounded-[1.45rem] bg-white p-4 shadow-[0_8px_22px_rgba(17,37,50,0.04)] ring-1 ring-[#112532]/8"><div className="flex items-center gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${toneSoft(item.tone)}`}>{item.potential > 0 ? "↗" : "↔"}</span><p className="text-lg font-black text-[#112532]">{item.title}</p></div><p className="mt-3 text-sm font-black text-[#112532]">{item.listing}</p><p className="mt-1 text-sm font-bold text-[#112532]/58">{item.period}</p>{item.potential > 0 ? <div className="mt-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#112532]/45">Potentiel estimé</p><p className="mt-1 text-3xl font-black tracking-tight text-[#E0680E]">{formatMoney(item.potential)}</p></div> : <p className="mt-4 text-sm font-bold text-[#112532]/58">Départ / Arrivée le même jour</p>}<button className={`mt-5 w-full rounded-full px-4 py-3 text-sm font-black ${item.tone === "orange" ? "bg-[#E0680E] text-white" : item.tone === "mustard" ? "border border-[#F4B044] bg-white text-[#D58908]" : "border border-[#80A5B7] bg-white text-[#477084]"}`}>{item.action}</button></div>)}</div>
    </ShellCard>
  );
}

function BottomNav() {
  const items = [{ label: "Cockpit", icon: "⌖", active: true }, { label: "Réservations", icon: "▦" }, { label: "Paiements", icon: "€" }, { label: "Logements", icon: "⌂" }, { label: "Paramètres", icon: "⚙" }];
  return <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#112532]/10 bg-white/96 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur xl:hidden"><div className="grid grid-cols-5 gap-2">{items.map((item) => <button key={item.label} className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black ${item.active ? "text-[#E0680E]" : "text-[#112532]/65"}`}><span className="text-xl">{item.icon}</span><span>{item.label}</span></button>)}</div></div>;
}

export function OwnerDemoCockpit() {
  const [scope, setScope] = useState<Scope>("all");
  const [horizon, setHorizon] = useState<Horizon>("72h");
  return (
    <main className="min-h-screen bg-[#F5FAFC] pb-28 text-[#112532] xl:pb-10">
      <TopNav />
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <MoneyDeck />
        <SmartBrief />
        <ListingCarousel scope={scope} setScope={setScope} />
        <MiniPlanning scope={scope} setScope={setScope} />
        <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]"><CompactEventFeed scope={scope} horizon={horizon} setHorizon={setHorizon} /><Opportunities /></section>
      </div>
      <BottomNav />
    </main>
  );
}

export default OwnerDemoCockpit;
