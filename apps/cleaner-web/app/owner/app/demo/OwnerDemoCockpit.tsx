"use client";

import { useEffect, useState, type ReactNode } from "react";

type Tone = "navy" | "blue" | "orange" | "mustard" | "green";
type MetricId = "realised" | "gross" | "net";
type Scope = "all" | "peskerezh" | "apt4" | "apt5" | "apt2";
type Horizon = "72h" | "7j" | "saison";
type EventFilter = "all" | "stay" | "intervention" | "reservation" | "payment";

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
  {
    id: "peskerezh",
    name: "La Peskerezh",
    image: "/pilotys-assets/property-peskerezh.svg",
    tone: "blue",
    status: "Tout est à jour",
    revenue: 12540,
    occupancy: 72,
  },
  {
    id: "apt4",
    name: "Apt 4 · Balcon",
    image: "/pilotys-assets/property-balcon.svg",
    tone: "blue",
    status: "2 demandes en attente",
    revenue: 9210,
    occupancy: 66,
  },
  {
    id: "apt5",
    name: "Apt 5 · Sous les toits",
    image: "/pilotys-assets/property-attic.svg",
    tone: "mustard",
    status: "Planning à optimiser",
    revenue: 7860,
    occupancy: 64,
  },
  {
    id: "apt2",
    name: "Apt 2 · Jardin",
    image: "/pilotys-assets/property-garden.svg",
    tone: "orange",
    status: "Baisse d’occupation détectée",
    revenue: 6980,
    occupancy: 58,
  },
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

const planningDays = [
  "21\nLun", "22\nMar", "23\nMer", "24\nJeu", "25\nVen", "26\nSam", "27\nDim", "28\nLun",
  "29\nMar", "30\nMer", "31\nJeu", "01\nVen", "02\nSam", "03\nDim", "04\nLun", "05\nMar",
];

const planningReservations = [
  { id: "stay-pesk-1", listingId: "peskerezh" as const, guest: "Durand", start: 2, span: 4 },
  { id: "stay-apt4-1", listingId: "apt4" as const, guest: "Leroy", start: 3, span: 5 },
  { id: "stay-apt4-2", listingId: "apt4" as const, guest: "Mathis", start: 9, span: 3 },
  { id: "stay-apt5-1", listingId: "apt5" as const, guest: "Petit", start: 3, span: 3 },
  { id: "stay-apt5-2", listingId: "apt5" as const, guest: "Bernard", start: 8, span: 6 },
  { id: "stay-apt2-1", listingId: "apt2" as const, guest: "Roux", start: 2, span: 4 },
  { id: "stay-apt2-2", listingId: "apt2" as const, guest: "Dupont", start: 11, span: 4 },
];

const planningMarkers = [
  { id: "clean-pesk", listingId: "peskerezh" as const, day: 5, icon: "✦", tone: "mustard" as Tone },
  { id: "clean-apt4", listingId: "apt4" as const, day: 8, icon: "✦", tone: "mustard" as Tone },
  { id: "interv-apt4", listingId: "apt4" as const, day: 14, icon: "↗", tone: "orange" as Tone },
  { id: "alert-apt5", listingId: "apt5" as const, day: 6, icon: "!", tone: "orange" as Tone },
  { id: "clean-apt2", listingId: "apt2" as const, day: 7, icon: "✦", tone: "mustard" as Tone },
];

const events: CompactEvent[] = [
  {
    id: "res-new-apt4",
    listingId: "apt4",
    category: "reservation",
    when: "Maintenant",
    title: "Nouvelle réservation",
    line: "Apt 4 · Claire Martin · 23–27 juillet",
    amount: "+684 €",
    status: "nouveau",
    tone: "blue",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "payment-sandrine",
    listingId: "all",
    category: "payment",
    when: "Aujourd’hui",
    title: "Paiement à valider",
    line: "Sandrine · ménage Apt 2 · rapport OK",
    amount: "54 €",
    status: "à valider",
    tone: "orange",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "report-apt5",
    listingId: "apt5",
    category: "intervention",
    when: "Aujourd’hui, 10:30",
    title: "Rapport ménage",
    line: "Apt 5 · 6 photos · aucun problème",
    status: "photos",
    tone: "blue",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "checkout-pesk",
    listingId: "peskerezh",
    category: "stay",
    when: "Aujourd’hui, 11:00",
    title: "Départ",
    line: "La Peskerezh · Famille Leroy",
    status: "rotation",
    tone: "mustard",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "arrival-apt2",
    listingId: "apt2",
    category: "stay",
    when: "Aujourd’hui, 16:00",
    title: "Arrivée",
    line: "Apt 2 · Thomas Roux",
    status: "prévu",
    tone: "blue",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "paint-apt5",
    listingId: "apt5",
    category: "intervention",
    when: "Demain, 09:00",
    title: "Intervention peinture",
    line: "Apt 5 · intervenant à confirmer",
    status: "à confirmer",
    tone: "orange",
    horizon: ["7j", "saison"],
  },
];

const opportunities = [
  { id: "gap-apt2", title: "Remplir un trou", listing: "Apt 2 · Jardin", period: "15–20 juillet · 5 nuits", potential: 620, action: "Agir maintenant", tone: "orange" as Tone },
  { id: "raise-apt5", title: "Derniers jours d’août", listing: "Apt 5 · Sous les toits", period: "27–31 août · 4 nuits", potential: 540, action: "Voir les tarifs", tone: "mustard" as Tone },
  { id: "ops-apt4", title: "Rotation serrée", listing: "Apt 4 · Balcon", period: "2 août · départ / arrivée", potential: 0, action: "Optimiser", tone: "blue" as Tone },
];

function formatMoney(value: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
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

function statusColor(text: string) {
  if (text.includes("jour")) return "bg-emerald-500";
  if (text.includes("attente")) return "bg-[#F4B044]";
  return "bg-[#E0680E]";
}

function ShellCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.7rem] bg-white shadow-[0_10px_30px_rgba(17,37,50,0.06)] ring-1 ring-[#112532]/8 ${className}`}>{children}</section>;
}

function PilotysMark() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/pilotys-assets/pilotys-logo-mark.svg" alt="Pilotys" className="h-9 w-9" />
      <span className="text-lg font-black tracking-[0.28em] text-[#112532]">PILOTYS</span>
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#112532]/8 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <PilotysMark />
        <nav className="hidden items-center gap-1 md:flex">
          {["Cockpit", "Réservations", "Paiements", "Logements", "Paramètres"].map((item) => (
            <button
              key={item}
              className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${
                item === "Cockpit"
                  ? "bg-[#E0680E]/10 text-[#E0680E] ring-1 ring-[#E0680E]/20"
                  : "text-[#112532]/65 hover:bg-[#F4F8FA] hover:text-[#112532]"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button className="rounded-full border border-[#E0680E]/20 bg-[#FFF6EF] px-4 py-2 text-sm font-black text-[#E0680E]">◉ live</button>
          <button className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#F4F8FA] text-[#112532] ring-1 ring-[#112532]/8 sm:flex">◴</button>
          <button className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#F4F8FA] text-[#112532] ring-1 ring-[#112532]/8 sm:flex">◌</button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl font-black text-[#112532] ring-1 ring-[#112532]/10 md:hidden">≡</button>
        </div>
      </div>
    </header>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E0680E]">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-[#112532] sm:text-2xl">{title}</h2>
      </div>
      {action ? <button className="text-sm font-black text-[#477084]">{action} →</button> : null}
    </div>
  );
}

function MoneyHero() {
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
      <SectionHeading eyebrow="Argent qui rentre" title="Lecture simple de vos revenus" />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <ShellCard className="overflow-hidden p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-3xl font-black tracking-tight text-[#112532] sm:text-5xl">CA réalisé live</p>
              <p className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-[#112532]/45">Mis à jour à 10:42</p>
            </div>
            <div className="hidden rounded-full border border-[#E0680E]/20 bg-[#FFF6EF] px-3 py-1.5 text-sm font-black text-[#E0680E] sm:block">◉ live</div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_230px] lg:items-center">
            <div>
              <p className="text-5xl font-black tracking-tight text-[#112532] sm:text-7xl">{formatMoney(realised, 2)}</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#E0680E]/18 bg-[#FFF6EF] px-4 py-2 text-sm font-black text-[#E0680E]">
                <span>↗</span>
                <span>avance pendant les séjours en cours</span>
              </div>
            </div>

            <div className="relative hidden h-44 overflow-hidden rounded-[1.35rem] bg-[#F4F8FA] lg:block">
              <div className="absolute right-8 top-8 h-12 w-12 rounded-full bg-[#E0680E]/10" />
              <svg viewBox="0 0 200 140" className="absolute inset-0 h-full w-full">
                <path d="M0 115 C40 96, 88 124, 130 110 S180 104, 200 116" fill="none" stroke="#D8E6EC" strokeWidth="2" />
                <path d="M0 125 C35 110, 82 137, 126 123 S179 118, 200 128" fill="none" stroke="#E7F0F4" strokeWidth="2" />
                <circle cx="134" cy="96" r="2.5" fill="#80A5B7" />
                <path d="M134 36 L134 96" stroke="#C9D8E0" strokeWidth="2" />
                <path d="M134 40 L168 90 L134 90 Z" fill="#FFFFFF" stroke="#D6E2E8" strokeWidth="2" />
                <path d="M134 48 L102 90 L134 90 Z" fill="#F7FBFD" stroke="#D6E2E8" strokeWidth="2" />
                <path d="M112 96 L158 96" stroke="#C9D8E0" strokeWidth="2" />
                <path d="M102 82 C107 78, 110 78, 114 82" fill="none" stroke="#C8D7DE" strokeWidth="1.5" />
                <path d="M92 76 C96 72, 99 72, 103 76" fill="none" stroke="#C8D7DE" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </ShellCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <MetricSummaryCard
            active={metric === "gross"}
            onClick={() => setMetric("gross")}
            tone="blue"
            label="CA brut annuel"
            value={formatMoney(gross)}
            delta="vs N-1 ↑ 12 %"
            icon="▮▮▮"
          />
          <MetricSummaryCard
            active={metric === "net"}
            onClick={() => setMetric("net")}
            tone="mustard"
            label="Après variables"
            value={formatMoney(net)}
            delta="vs N-1 ↑ 9 %"
            icon="€"
          />
        </div>
      </div>

      <MetricBreakdown metric={metric} setMetric={setMetric} />
    </section>
  );
}

function MetricSummaryCard({
  active,
  onClick,
  tone,
  label,
  value,
  delta,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  tone: Tone;
  label: string;
  value: string;
  delta: string;
  icon: string;
}) {
  const accent = tone === "mustard" ? "#F4B044" : "#80A5B7";
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-[1.6rem] bg-white p-5 text-left shadow-[0_10px_28px_rgba(17,37,50,0.05)] ring-1 transition ${
        active ? "ring-[#E0680E]/30" : "ring-[#112532]/8 hover:ring-[#112532]/15"
      }`}
    >
      <div className="absolute inset-x-0 bottom-0 h-8 opacity-30" style={{ background: `linear-gradient(180deg, transparent, ${accent})` }} />
      <div className="relative flex items-center gap-3">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full ring-1 ${toneSoft(tone)}`}>{icon}</span>
        <span className="text-base font-black uppercase tracking-[0.03em] text-[#112532]">{label}</span>
      </div>
      <p className="relative mt-5 text-4xl font-black tracking-tight text-[#112532]">{value}</p>
      <div className="relative mt-5 flex items-center justify-between gap-3">
        <span className="text-sm font-black text-emerald-500">{delta}</span>
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ring-1 ${toneSoft(tone)}`}>›</span>
      </div>
    </button>
  );
}

function MetricBreakdown({ metric, setMetric }: { metric: MetricId; setMetric: (metric: MetricId) => void }) {
  const max = Math.max(...monthlyRevenue.map((row) => row.realised + row.future));
  const chartBars = monthlyRevenue.map((row) => {
    const total = row.realised + row.future;
    return {
      ...row,
      totalHeight: Math.max(14, (total / max) * 180),
      realisedHeight: total ? (row.realised / total) * 100 : 0,
    };
  });

  return (
    <ShellCard className="overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black text-[#112532]">Revenus mensuels</h3>
          <p className="mt-2 text-base font-bold text-[#112532]/55">Bleu = réalisé. Orange = déjà réservé à venir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMetric("realised")} className={`rounded-full px-4 py-2 text-sm font-black ${metric === "realised" ? "bg-[#112532] text-white" : "bg-[#F4F8FA] text-[#112532]"}`}>réalisé</button>
          <button onClick={() => setMetric("gross")} className={`rounded-full px-4 py-2 text-sm font-black ${metric === "gross" ? "bg-[#80A5B7] text-white" : "bg-[#F4F8FA] text-[#112532]"}`}>brut</button>
          <button onClick={() => setMetric("net")} className={`rounded-full px-4 py-2 text-sm font-black ${metric === "net" ? "bg-[#F4B044] text-[#112532]" : "bg-[#F4F8FA] text-[#112532]"}`}>net</button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-sm font-black text-[#112532]/65">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-7 rounded-full bg-[#80A5B7]" />Réalisé</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-7 rounded-full bg-[#E0680E]" />À venir</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-7 border-t-2 border-dashed border-[#F4B044]" />Objectif</span>
      </div>

      <div className="mt-5 grid grid-cols-12 items-end gap-3">
        {chartBars.map((row, index) => {
          const objective = 28 + Math.sin(index / 2.8) * 5 + index * 1.6;
          return (
            <div key={row.month} className="flex min-w-0 flex-col items-center justify-end gap-3">
              <div className="relative flex h-[210px] w-full items-end justify-center overflow-visible">
                <div className="absolute left-0 right-0 top-0 h-full">
                  <div className="absolute left-0 right-0 border-t border-[#112532]/6" style={{ top: `${100 - objective}%` }} />
                </div>
                <div className="relative flex w-full items-end justify-center gap-[3px] rounded-t-[1rem]">
                  {row.realised > 0 ? (
                    <div className={`w-1/2 rounded-t-[0.9rem] ${row.live ? "shadow-[0_0_18px_rgba(128,165,183,0.45)]" : ""} bg-[#80A5B7]`} style={{ height: `${Math.max(26, row.totalHeight * (row.realisedHeight / 100))}px` }} />
                  ) : null}
                  {row.future > 0 ? (
                    <div className={`w-1/2 rounded-t-[0.9rem] ${row.live ? "shadow-[0_0_18px_rgba(224,104,14,0.35)]" : ""} bg-[#E0680E]`} style={{ height: `${Math.max(26, row.totalHeight * ((100 - row.realisedHeight) / 100))}px` }} />
                  ) : null}
                  {row.future === 0 && row.realised > 0 ? null : null}
                </div>
                <div className="absolute left-0 right-0 border-t-2 border-dashed border-[#F4B044]" style={{ bottom: `${objective}%` }} />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.03em] text-[#477084]">{row.month}</span>
            </div>
          );
        })}
      </div>
    </ShellCard>
  );
}

function SmartBrief() {
  return (
    <ShellCard className="overflow-hidden p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF6EF] text-xl text-[#E0680E] ring-1 ring-[#E0680E]/14">✦</span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E0680E]">À retenir maintenant</p>
          <p className="mt-2 text-base font-bold leading-7 text-[#112532] sm:text-lg">
            Vous devez <span className="font-black text-[#E0680E]">valider la demande de paiement de Sandrine</span> aujourd’hui.
            <span className="hidden sm:inline"> </span>
            Apt 2 est lent du 15 au 20 juillet : <span className="font-black text-[#E0680E]">une baisse de prix modérée</span> semble pertinente.
          </p>
        </div>
      </div>
    </ShellCard>
  );
}

function ListingCarousel({ scope, setScope }: { scope: Scope; setScope: (scope: Scope) => void }) {
  return (
    <section className="space-y-3">
      <SectionHeading eyebrow="Logements" title="Vue combinée" action="Voir tous les logements" />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex snap-x gap-4">
          {listings.map((listing) => (
            <button
              key={listing.id}
              onClick={() => setScope(listing.id)}
              className={`min-w-[84%] snap-start overflow-hidden rounded-[1.6rem] bg-white text-left shadow-[0_10px_28px_rgba(17,37,50,0.05)] ring-1 transition sm:min-w-[320px] ${scope === listing.id ? "ring-[#E0680E]/28" : "ring-[#112532]/8"}`}
            >
              <div className="relative h-36 overflow-hidden bg-[#F4F8FA]">
                <img src={listing.image} alt="" className="h-full w-full object-cover" />
                <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-sm font-black ring-1 ${toneSoft(listing.tone)}`}>{listing.occupancy}%</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-black tracking-tight text-[#112532]">{listing.name}</p>
                    <p className="mt-1 text-sm font-bold text-[#112532]/55">Taux d’occupation</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black tracking-tight text-[#112532]">{formatMoney(listing.revenue)}</p>
                    <p className="text-sm font-bold text-[#112532]/55">CA réalisé</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-[#112532]/8 pt-3">
                  <span className={`h-3 w-3 rounded-full ${statusColor(listing.status)}`} />
                  <span className="truncate text-sm font-bold text-[#112532]/65">{listing.status}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniPlanning({ scope, setScope }: { scope: Scope; setScope: (scope: Scope) => void }) {
  const visibleListings = scope === "all" ? listings : listings.filter((listing) => listing.id === scope);
  const dayWidth = "2.8rem";

  return (
    <ShellCard className="overflow-hidden">
      <div className="border-b border-[#112532]/8 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E0680E]">Planning</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-[#112532]">Réservations, ménages et interventions</h3>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-black text-[#112532]/65">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#80A5B7]" />Réservations</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#F4B044]" />Ménage</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#E0680E]" />Intervention</span>
          </div>
        </div>
      </div>
      <div className="w-full overflow-x-auto p-4">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <div />
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
              {planningDays.map((day) => (
                <div key={day} className="whitespace-pre-line rounded-2xl bg-[#F4F8FA] px-1.5 py-1.5 text-center text-[10px] font-black leading-4 text-[#112532]/58 ring-1 ring-[#112532]/5">{day}</div>
              ))}
            </div>
          </div>

          {visibleListings.map((listing) => {
            const rowReservations = planningReservations.filter((reservation) => reservation.listingId === listing.id);
            const rowMarkers = planningMarkers.filter((marker) => marker.listingId === listing.id);
            return (
              <div key={listing.id} className="mt-2 grid grid-cols-[120px_1fr] gap-2">
                <button onClick={() => setScope(listing.id)} className="flex min-h-[64px] items-center gap-2 rounded-2xl bg-[#F4F8FA] px-3 py-2 text-left">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${toneSolid(listing.tone)}`} />
                  <span className="whitespace-normal text-xs font-black leading-4 text-[#112532]">{listing.name}</span>
                </button>
                <div className="relative h-[64px] rounded-2xl bg-[#F4F8FA]/70">
                  <div className="absolute inset-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
                    {planningDays.map((day, index) => (
                      <div key={`${listing.id}-${day}-${index}`} className="rounded-xl bg-white/90" />
                    ))}
                  </div>
                  <div className="absolute inset-x-2 top-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
                    {rowReservations.map((reservation) => (
                      <div key={reservation.id} className="h-9 rounded-2xl bg-[#80A5B7] px-3 text-left text-white shadow-sm ring-1 ring-white/55" style={{ gridColumn: `${reservation.start} / span ${reservation.span}` }}>
                        <p className="truncate text-xs font-black">{reservation.guest}</p>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-x-2 bottom-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
                    {rowMarkers.map((marker) => (
                      <div key={marker.id} className={`flex h-7 w-7 items-center justify-center justify-self-center rounded-full text-[11px] font-black text-white shadow-md ring-4 ring-white ${toneSolid(marker.tone)}`} style={{ gridColumn: `${marker.day} / span 1` }}>{marker.icon}</div>
                    ))}
                  </div>
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
  const visibleEvents = events.filter((event) => {
    const scopeMatch = scope === "all" || event.listingId === scope || event.listingId === "all";
    const filterMatch = filter === "all" || event.category === filter;
    return scopeMatch && filterMatch && event.horizon.includes(horizon);
  });

  return (
    <ShellCard className="overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E0680E]">Prochains points</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#112532]">Ce qu’il faut traiter</h2>
        </div>
        <div className="flex gap-1 rounded-full bg-[#F4F8FA] p-1 text-xs font-black text-[#112532]/55">
          {(["72h", "7j", "saison"] as Horizon[]).map((item) => (
            <button key={item} onClick={() => setHorizon(item)} className={horizon === item ? "rounded-full bg-white px-3 py-1.5 text-[#112532] shadow-sm" : "px-3 py-1.5"}>{item}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {([
          { key: "all", label: "Tous" },
          { key: "reservation", label: "Réservations" },
          { key: "intervention", label: "Missions" },
          { key: "stay", label: "Séjours" },
          { key: "payment", label: "Paiements" },
        ] as { key: EventFilter; label: string }[]).map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={filter === item.key ? "shrink-0 rounded-full bg-[#112532] px-4 py-2 text-xs font-black text-white" : "shrink-0 rounded-full bg-[#F4F8FA] px-4 py-2 text-xs font-black text-[#112532]/65"}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {visibleEvents.map((event) => (
          <div key={event.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl bg-[#F4F8FA]/72 px-3 py-3 ring-1 ring-[#112532]/5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white ${toneSolid(event.tone)}`}>{event.category === "payment" ? "€" : event.category === "reservation" ? "+" : event.category === "stay" ? "→" : "✓"}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#112532]">{event.title}</p>
              <p className="mt-0.5 truncate text-sm font-bold text-[#112532]/58">{event.line}</p>
            </div>
            <div className="text-right">
              {event.amount ? <p className="text-sm font-black text-[#112532]">{event.amount}</p> : null}
              <p className="mt-0.5 text-xs font-bold text-[#112532]/55">{event.when}</p>
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}

function Opportunities() {
  return (
    <ShellCard className="overflow-hidden p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E0680E]">Opportunités</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#112532]">À tester maintenant</h2>
        </div>
        <button className="text-sm font-black text-[#477084]">Voir toutes →</button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {opportunities.map((item) => (
          <div key={item.id} className="rounded-[1.45rem] bg-white p-4 ring-1 ring-[#112532]/8 shadow-[0_8px_22px_rgba(17,37,50,0.04)]">
            <div className="flex items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${toneSoft(item.tone)}`}>{item.potential > 0 ? "↗" : "↔"}</span>
              <p className="text-lg font-black text-[#112532]">{item.title}</p>
            </div>
            <p className="mt-3 text-sm font-black text-[#112532]">{item.listing}</p>
            <p className="mt-1 text-sm font-bold text-[#112532]/58">{item.period}</p>
            {item.potential > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#112532]/45">Potentiel estimé</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-[#E0680E]">{formatMoney(item.potential)}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm font-bold text-[#112532]/58">Départ / Arrivée le même jour</p>
            )}
            <button className={`mt-5 w-full rounded-full px-4 py-3 text-sm font-black ${item.tone === "orange" ? "bg-[#E0680E] text-white" : item.tone === "mustard" ? "border border-[#F4B044] bg-white text-[#D58908]" : "border border-[#80A5B7] bg-white text-[#477084]"}`}>{item.action}</button>
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

export function OwnerDemoCockpit() {
  const [scope, setScope] = useState<Scope>("all");
  const [horizon, setHorizon] = useState<Horizon>("72h");

  return (
    <main className="min-h-screen bg-[#FCFDFE] pb-28 text-[#112532] xl:pb-10">
      <TopNav />

      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <MoneyHero />
        <SmartBrief />
        <ListingCarousel scope={scope} setScope={setScope} />
        <MiniPlanning scope={scope} setScope={setScope} />

        <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <CompactEventFeed scope={scope} horizon={horizon} setHorizon={setHorizon} />
          <Opportunities />
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

export default OwnerDemoCockpit;
