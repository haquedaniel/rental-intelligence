"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Tone = "navy" | "blue" | "orange" | "mustard" | "green";
type MetricId = "realised" | "gross" | "net";
type Scope = "all" | "peskerezh" | "apt4" | "apt5" | "apt2";
type Horizon = "72h" | "7j" | "saison";
type EventFilter = "all" | "stay" | "intervention" | "reservation" | "payment" | "alert";

type Listing = {
  id: Exclude<Scope, "all">;
  name: string;
  short: string;
  image: string;
  tone: Tone;
  status: string;
  revenue: number;
  occupancy: number;
  next: string;
};

type CompactEvent = {
  id: string;
  listingId: Scope;
  category: Exclude<EventFilter, "all">;
  when: string;
  icon: string;
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
    short: "P",
    image: "/pilotys-assets/property-peskerezh.svg",
    tone: "blue",
    status: "Tout est à jour",
    revenue: 12540,
    occupancy: 72,
    next: "Ménage couvert",
  },
  {
    id: "apt4",
    name: "Apt 4 · Balcon",
    short: "4",
    image: "/pilotys-assets/property-balcon.svg",
    tone: "blue",
    status: "2 demandes en attente",
    revenue: 9210,
    occupancy: 66,
    next: "Départ 10h · arrivée 17h",
  },
  {
    id: "apt5",
    name: "Apt 5 · Sous les toits",
    short: "5",
    image: "/pilotys-assets/property-attic.svg",
    tone: "mustard",
    status: "Planning à optimiser",
    revenue: 7860,
    occupancy: 64,
    next: "Prix à revoir 15–20 juillet",
  },
  {
    id: "apt2",
    name: "Apt 2 · Jardin",
    short: "2",
    image: "/pilotys-assets/property-garden.svg",
    tone: "orange",
    status: "Baisse d’occupation détectée",
    revenue: 6980,
    occupancy: 58,
    next: "Photos disponibles",
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
  { label: "21\nLun" }, { label: "22\nMar" }, { label: "23\nMer" }, { label: "24\nJeu" },
  { label: "25\nVen" }, { label: "26\nSam" }, { label: "27\nDim" }, { label: "28\nLun" },
  { label: "29\nMar" }, { label: "30\nMer" }, { label: "31\nJeu" }, { label: "01\nVen" },
  { label: "02\nSam" }, { label: "03\nDim" }, { label: "04\nLun" }, { label: "05\nMar" },
];

const planningReservations = [
  { id: "stay-pesk-1", listingId: "peskerezh" as const, guest: "Durand", detail: "4 nuits", start: 2, span: 4 },
  { id: "stay-apt4-1", listingId: "apt4" as const, guest: "Leroy", detail: "5 nuits", start: 3, span: 5 },
  { id: "stay-apt4-2", listingId: "apt4" as const, guest: "Martin", detail: "3 nuits", start: 10, span: 3 },
  { id: "stay-apt5-1", listingId: "apt5" as const, guest: "Petit", detail: "trou à remplir", start: 3, span: 3 },
  { id: "stay-apt5-2", listingId: "apt5" as const, guest: "Bernard", detail: "6 nuits", start: 8, span: 6 },
  { id: "stay-apt2-1", listingId: "apt2" as const, guest: "Roux", detail: "4 nuits", start: 2, span: 5 },
  { id: "stay-apt2-2", listingId: "apt2" as const, guest: "Dupont", detail: "4 nuits", start: 12, span: 4 },
];

const planningMarkers = [
  { id: "clean-pesk", listingId: "peskerezh" as const, day: 5, icon: "✦", tone: "mustard" as Tone, label: "ménage" },
  { id: "clean-apt4", listingId: "apt4" as const, day: 8, icon: "✦", tone: "mustard" as Tone, label: "ménage" },
  { id: "interv-apt4", listingId: "apt4" as const, day: 14, icon: "↗", tone: "orange" as Tone, label: "intervention" },
  { id: "alert-apt5", listingId: "apt5" as const, day: 6, icon: "!", tone: "orange" as Tone, label: "alerte" },
  { id: "clean-apt2", listingId: "apt2" as const, day: 7, icon: "✦", tone: "mustard" as Tone, label: "ménage" },
];

const events: CompactEvent[] = [
  {
    id: "res-new-apt4",
    listingId: "apt4",
    category: "reservation",
    when: "Maintenant",
    icon: "+",
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
    icon: "€",
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
    when: "Aujourd’hui 10:15",
    icon: "✓",
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
    when: "Aujourd’hui 11:00",
    icon: "↗",
    title: "Départ",
    line: "La Peskerezh · Famille Leroy",
    status: "rotation",
    tone: "navy",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "arrival-apt2",
    listingId: "apt2",
    category: "stay",
    when: "Aujourd’hui 16:00",
    icon: "→",
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
    when: "Demain 09:00",
    icon: "◆",
    title: "Intervention peinture",
    line: "Apt 5 · intervenant à confirmer",
    status: "à confirmer",
    tone: "mustard",
    horizon: ["7j", "saison"],
  },
];

const opportunities = [
  {
    id: "gap-apt2",
    title: "Remplir un trou",
    listing: "Apt 2 · Jardin",
    period: "15–20 juillet · 5 nuits",
    potential: 620,
    action: "Agir maintenant",
    tone: "orange" as Tone,
  },
  {
    id: "raise-apt5",
    title: "Derniers jours d’août",
    listing: "Apt 5 · Sous les toits",
    period: "27–31 août · 4 nuits",
    potential: 540,
    action: "Voir les tarifs",
    tone: "mustard" as Tone,
  },
  {
    id: "ops-apt4",
    title: "Rotation serrée",
    listing: "Apt 4 · Balcon",
    period: "2 août · départ / arrivée",
    potential: 0,
    action: "Optimiser",
    tone: "orange" as Tone,
  },
];

function formatMoney(value: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
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

function toneText(tone: Tone) {
  const classes: Record<Tone, string> = {
    navy: "text-[#112532]",
    blue: "text-[#477084]",
    orange: "text-[#E0680E]",
    mustard: "text-[#A66D09]",
    green: "text-emerald-600",
  };
  return classes[tone];
}

function toneSoft(tone: Tone) {
  const classes: Record<Tone, string> = {
    navy: "bg-[#112532]/8 text-[#112532] ring-[#112532]/10",
    blue: "bg-[#80A5B7]/15 text-[#315b6f] ring-[#80A5B7]/25",
    orange: "bg-[#E0680E]/10 text-[#B34D08] ring-[#E0680E]/20",
    mustard: "bg-[#F4B044]/18 text-[#8D5A06] ring-[#F4B044]/30",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return classes[tone];
}

function ShellCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[1.7rem] bg-white shadow-[0_12px_35px_rgba(17,37,50,0.07)] ring-1 ring-[#112532]/8 ${className}`}>
      {children}
    </section>
  );
}

function PilotysMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-11 w-11 items-center justify-center rounded-[1.05rem] bg-[#112532] shadow-sm">
        <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
          <path d="M12 34C18.5 29.8 26.8 28 37 29.6" fill="none" stroke="#80A5B7" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M14 37C21 34.6 28 34.1 35 35.2" fill="none" stroke="#80A5B7" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
          <path d="M16 30V12L30 27H16Z" fill="white" />
          <path d="M18 12C25.6 15.4 31.5 20.8 36 28.4L30 27L18 12Z" fill="#E0680E" />
          <path d="M16 30H31" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-[#E0680E]" />
      </span>
      {!compact && <span className="text-xl font-black tracking-[0.28em] text-[#112532]">PILOTYS</span>}
    </div>
  );
}

function TopNav() {
  const items = ["Cockpit", "Réservations", "Paiements", "Logements", "Paramètres"];
  return (
    <header className="sticky top-0 z-50 border-b border-[#112532]/8 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <PilotysMark />
        <nav className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <button
              key={item}
              className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${
                item === "Cockpit" ? "bg-[#E0680E] text-white shadow-sm" : "text-[#112532]/70 hover:bg-[#F4F8FA] hover:text-[#112532]"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F8FA] text-[#112532] ring-1 ring-[#112532]/8">
            <span className="text-lg">◴</span>
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E0680E] px-1 text-[10px] font-black text-white">2</span>
          </button>
          <button className="hidden rounded-full bg-[#F4F8FA] px-3 py-2 text-xs font-black text-[#112532] ring-1 ring-[#112532]/8 sm:block">
            Alexandre · propriétaire
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl font-black text-[#112532] ring-1 ring-[#112532]/10 md:hidden">≡</button>
        </div>
      </div>
    </header>
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
      <SectionTitle eyebrow="Argent qui rentre" title="Lecture simple de vos revenus" />

      <ShellCard className="relative overflow-hidden p-5 sm:p-6">
        <div className="absolute right-0 top-0 hidden h-full w-[42%] overflow-hidden lg:block">
          <div className="absolute right-16 top-12 h-16 w-16 rounded-full bg-[#F4B044]/18" />
          <svg viewBox="0 0 260 240" className="absolute inset-0 h-full w-full">
            <path d="M0 178 C52 146, 112 192, 162 166 S226 152, 260 176" fill="none" stroke="#D8E6EC" strokeWidth="3" />
            <path d="M0 198 C44 174, 112 216, 162 194 S226 178, 260 202" fill="none" stroke="#E7F0F4" strokeWidth="3" />
            <path d="M178 64 L178 158" stroke="#C9D8E0" strokeWidth="3" />
            <path d="M178 68 L224 148 L178 148 Z" fill="#FFFFFF" stroke="#D6E2E8" strokeWidth="3" />
            <path d="M178 80 L132 148 L178 148 Z" fill="#F7FBFD" stroke="#D6E2E8" strokeWidth="3" />
            <path d="M146 158 L210 158" stroke="#C9D8E0" strokeWidth="3" />
            <path d="M118 126 C124 120, 130 120, 136 126" fill="none" stroke="#C8D7DE" strokeWidth="2" />
            <path d="M104 114 C110 108, 116 108, 122 114" fill="none" stroke="#C8D7DE" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-4xl font-black tracking-tight text-[#112532] sm:text-5xl">CA réalisé live</h2>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-[#112532]/42">Mis à jour à 10:42</p>
            </div>
            <span className="rounded-full border border-[#E0680E]/20 bg-[#FFF6EF] px-3 py-1.5 text-sm font-black text-[#E0680E] sm:hidden">◉ live</span>
          </div>

          <p className="mt-5 text-6xl font-black tracking-tight text-[#112532] sm:text-7xl">{formatMoney(realised, 2)}</p>

          <button
            onClick={() => setMetric("realised")}
            className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#E0680E]/18 bg-[#FFF6EF] px-4 py-2.5 text-left text-base font-black text-[#E0680E] shadow-sm"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E0680E]/16">↗</span>
            <span className="truncate">avance pendant les séjours en cours</span>
          </button>
        </div>
      </ShellCard>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <MetricButton active={metric === "gross"} onClick={() => setMetric("gross")} label="CA brut annuel" value={formatMoney(gross)} delta="↑ 12 %" tone="blue" />
        <MetricButton active={metric === "net"} onClick={() => setMetric("net")} label="Après variables" value={formatMoney(net)} delta="↑ 9 %" tone="mustard" />
      </div>

      <MetricBreakdown metric={metric} setMetric={setMetric} />
    </section>
  );
}

function MetricButton({ active, onClick, label, value, delta, tone }: { active: boolean; onClick: () => void; label: string; value: string; delta: string; tone: Tone }) {
  const wave = tone === "mustard" ? "#F4B044" : "#80A5B7";
  const icon = tone === "mustard" ? "€" : "▮▮▮";

  return (
    <button
      onClick={onClick}
      className={`relative min-h-[12rem] overflow-hidden rounded-[1.6rem] bg-white p-4 text-left shadow-[0_10px_28px_rgba(17,37,50,0.05)] ring-1 transition sm:p-5 ${
        active ? "ring-[#E0680E]/36 shadow-[0_14px_34px_rgba(224,104,14,0.09)]" : "ring-[#112532]/8 hover:ring-[#112532]/15"
      }`}
    >
      <svg viewBox="0 0 320 90" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-14 w-full opacity-25">
        <path d="M0 48 C58 82 104 38 164 55 C222 72 262 25 320 45 V90 H0 Z" fill={wave} />
      </svg>
      <div className="relative flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ring-1 sm:h-12 sm:w-12 ${toneSoft(tone)}`}>{icon}</span>
        <span className="text-[0.72rem] font-black uppercase leading-4 tracking-[0.05em] text-[#112532] sm:text-sm">{label}</span>
      </div>
      <p className="relative mt-6 text-3xl font-black tracking-tight text-[#112532] sm:text-4xl">{value}</p>
      <div className="relative mt-5 flex items-center justify-between gap-3">
        <span className="text-sm font-black text-emerald-500">vs N-1 · {delta}</span>
        <span className={`hidden h-10 w-10 items-center justify-center rounded-full ring-1 sm:flex ${toneSoft(tone)}`}>›</span>
      </div>
    </button>
  );
}

function MetricBreakdown({ metric, setMetric }: { metric: MetricId; setMetric: (metric: MetricId) => void }) {
  if (metric === "gross") {
    const rows = [
      { label: "La Peskerezh", value: 10480, width: 84, tone: "blue" as Tone },
      { label: "Apt 4 · Balcon", value: 6480, width: 52, tone: "blue" as Tone },
      { label: "Apt 5 · Sous les toits", value: 4320, width: 35, tone: "mustard" as Tone },
      { label: "Apt 2 · Jardin", value: 3580, width: 29, tone: "orange" as Tone },
    ];

    return (
      <ShellCard className="overflow-hidden p-5 sm:p-6">
        <MetricTabs metric={metric} setMetric={setMetric} title="CA brut par logement" subtitle="Cliquez sur les indicateurs pour changer de lecture." />
        <div className="mt-5 space-y-4">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[8rem_1fr_5.5rem] items-center gap-3 text-sm font-black sm:grid-cols-[12rem_1fr_7rem]">
              <span className="truncate text-[#112532]/70">{row.label}</span>
              <div className="h-4 overflow-hidden rounded-full bg-[#F4F8FA] ring-1 ring-[#112532]/6">
                <div className={`h-full rounded-full ${toneSolid(row.tone)}`} style={{ width: `${row.width}%` }} />
              </div>
              <span className="text-right text-[#112532]">{formatMoney(row.value)}</span>
            </div>
          ))}
        </div>
      </ShellCard>
    );
  }

  if (metric === "net") {
    const rows = [
      { label: "CA brut", value: 24860, width: 100, tone: "blue" as Tone, sign: "" },
      { label: "Ménage", value: 3240, width: 56, tone: "mustard" as Tone, sign: "-" },
      { label: "Commissions", value: 1120, width: 22, tone: "blue" as Tone, sign: "-" },
      { label: "Interventions", value: 430, width: 12, tone: "orange" as Tone, sign: "-" },
      { label: "Après variables", value: 18420, width: 74, tone: "orange" as Tone, sign: "" },
    ];

    return (
      <ShellCard className="overflow-hidden p-5 sm:p-6">
        <MetricTabs metric={metric} setMetric={setMetric} title="Après variables" subtitle="Une lecture simple de ce qui reste après les coûts suivis." />
        <div className="mt-5 space-y-4">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[8rem_1fr_5.5rem] items-center gap-3 text-sm font-black sm:grid-cols-[12rem_1fr_7rem]">
              <span className="truncate text-[#112532]/70">{row.label}</span>
              <div className="h-4 overflow-hidden rounded-full bg-[#F4F8FA] ring-1 ring-[#112532]/6">
                <div className={`h-full rounded-full ${toneSolid(row.tone)}`} style={{ width: `${row.width}%` }} />
              </div>
              <span className="text-right text-[#112532]">{row.sign}{formatMoney(row.value)}</span>
            </div>
          ))}
        </div>
      </ShellCard>
    );
  }

  const max = Math.max(...monthlyRevenue.map((row) => row.realised + row.future));

  return (
    <ShellCard className="overflow-hidden p-5 sm:p-6">
      <MetricTabs metric={metric} setMetric={setMetric} title="Revenus mensuels" subtitle="Orange = réalisé. Bleu = déjà réservé à venir." />

      <div className="mt-5 flex flex-wrap gap-4 text-sm font-black text-[#112532]/65">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-7 rounded-full bg-[#E0680E]" />Réalisé</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-7 rounded-full bg-[#80A5B7]" />À venir</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-7 border-t-2 border-dashed border-[#F4B044]" />Objectif</span>
      </div>

      <div className="-mx-2 mt-5 overflow-x-auto px-2 pb-1">
        <div className="relative min-w-[680px]">
          <div className="absolute left-0 right-0 top-[42%] border-t-2 border-dashed border-[#F4B044]" />
          <div className="grid grid-cols-12 items-end gap-4">
            {monthlyRevenue.map((row) => {
              const total = row.realised + row.future;
              const totalHeight = Math.max(30, (total / max) * 205);
              const realisedPct = total ? (row.realised / total) * 100 : 0;
              const futurePct = total ? (row.future / total) * 100 : 0;

              return (
                <div key={row.month} className="relative flex min-w-0 flex-col items-center gap-3">
                  <div className="relative flex h-[220px] w-full items-end justify-center">
                    <div
                      className={`flex w-7 flex-col-reverse overflow-hidden rounded-t-[1rem] bg-[#E0680E] shadow-sm sm:w-8 ${row.live ? "ring-2 ring-[#E0680E]/25" : ""}`}
                      style={{ height: `${totalHeight}px` }}
                    >
                      {row.realised > 0 ? (
                        <div className="w-full bg-[#E0680E]" style={{ height: `${realisedPct}%` }} />
                      ) : null}
                      {row.future > 0 ? (
                        <div className="w-full bg-[#80A5B7]" style={{ height: `${futurePct}%` }} />
                      ) : null}
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

function MetricTabs({
  metric,
  setMetric,
  title,
  subtitle,
}: {
  metric: MetricId;
  setMetric: (metric: MetricId) => void;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 className="text-3xl font-black tracking-tight text-[#112532]">{title}</h3>
        <p className="mt-2 text-base font-bold text-[#112532]/55">{subtitle}</p>
      </div>
      <div className="flex gap-2 rounded-full bg-[#F4F8FA] p-1 text-sm font-black text-[#112532]/65">
        <button onClick={() => setMetric("realised")} className={metric === "realised" ? "rounded-full bg-[#E0680E] px-4 py-2 text-white shadow-sm" : "px-4 py-2"}>réalisé</button>
        <button onClick={() => setMetric("gross")} className={metric === "gross" ? "rounded-full bg-[#80A5B7] px-4 py-2 text-white shadow-sm" : "px-4 py-2"}>brut</button>
        <button onClick={() => setMetric("net")} className={metric === "net" ? "rounded-full bg-[#F4B044] px-4 py-2 text-[#112532] shadow-sm" : "px-4 py-2"}>net</button>
      </div>
    </div>
  );
}

function SmartBrief() {
  return (
    <ShellCard className="overflow-hidden p-4 sm:p-5">
      <div className="flex gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E0680E]/10 text-2xl text-[#E0680E]">✦</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#80A5B7]">À retenir maintenant</p>
          <p className="mt-2 text-base font-bold leading-7 text-[#112532] sm:text-lg">
            Vous devez <span className="font-black text-[#E0680E]">valider la demande de paiement de Sandrine</span> aujourd’hui. Apt 2 est lent du 15 au 20 juillet : <span className="font-black text-[#E0680E]">une baisse de prix modérée</span> semble pertinente.
          </p>
        </div>
        <button className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4F8FA] text-[#112532] sm:flex">→</button>
      </div>
    </ShellCard>
  );
}

function ListingCarousel({ scope, setScope }: { scope: Scope; setScope: (scope: Scope) => void }) {
  const selected = scope === "all" ? null : listings.find((listing) => listing.id === scope);
  return (
    <section className="min-w-0 space-y-3">
      <SectionTitle eyebrow="Logements" title={selected ? selected.name : "Vue combinée"} action="Voir tous" />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex snap-x gap-3">
          <button onClick={() => setScope("all")} className={`min-w-[82%] snap-start rounded-[1.7rem] p-3 text-left shadow-sm ring-1 transition sm:min-w-[300px] ${scope === "all" ? "bg-[#112532] text-white ring-[#112532]" : "bg-white text-[#112532] ring-[#112532]/8"}`}>
            <div className="flex h-36 flex-col justify-between rounded-[1.25rem] bg-gradient-to-br from-[#112532] via-[#1a3a4d] to-[#80A5B7] p-4 text-white">
              <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-black">4 biens</span>
              <div>
                <p className="text-2xl font-black">Tous les logements</p>
                <p className="mt-1 text-sm font-bold text-white/65">revenus · opérations · alertes</p>
              </div>
            </div>
          </button>

          {listings.map((listing) => (
            <button key={listing.id} onClick={() => setScope(listing.id)} className={`min-w-[82%] snap-start overflow-hidden rounded-[1.7rem] bg-white text-left shadow-sm ring-1 transition sm:min-w-[300px] ${scope === listing.id ? "ring-4 ring-[#E0680E]" : "ring-[#112532]/8"}`}>
              <div className="relative h-32 overflow-hidden bg-[#F4F8FA]">
                <img src={listing.image} alt="" className="h-full w-full object-cover" />
                <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-black ring-1 ${toneSoft(listing.tone)}`}>{listing.occupancy}%</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-[#112532]">{listing.name}</p>
                    <p className="mt-1 text-xs font-bold text-[#112532]/55">Taux d’occupation</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-[#112532]">{formatMoney(listing.revenue)}</p>
                    <p className="text-xs font-bold text-[#112532]/55">CA réalisé</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-[#112532]/8 pt-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${toneSolid(listing.tone)}`} />
                  <span className="truncate text-xs font-bold text-[#112532]/65">{listing.status}</span>
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
    <ShellCard className="max-w-full overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#112532]/8 p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#80A5B7]">Planning</p>
          <h3 className="mt-1 text-xl font-black leading-6 text-[#112532]">Réservations, ménages et interventions</h3>
        </div>
        <div className="flex gap-3 text-[11px] font-black text-[#112532]/60">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#80A5B7]" />Réservations</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#F4B044]" />Ménage</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#E0680E]" />Intervention</span>
        </div>
      </div>
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <div className="min-w-[860px] p-3">
          <div className="grid grid-cols-[116px_1fr] gap-2">
            <div />
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
              {planningDays.map((day, index) => (
                <div key={`${day.label}-${index}`} className="whitespace-pre-line rounded-2xl bg-[#F4F8FA] px-1.5 py-1.5 text-center text-[10px] font-black leading-4 text-[#112532]/55 ring-1 ring-[#112532]/5">{day.label}</div>
              ))}
            </div>
          </div>
          {visibleListings.map((listing) => {
            const rowReservations = planningReservations.filter((reservation) => reservation.listingId === listing.id);
            const rowMarkers = planningMarkers.filter((marker) => marker.listingId === listing.id);
            return (
              <div key={listing.id} className="mt-2 grid grid-cols-[116px_1fr] gap-2">
                <button onClick={() => setScope(listing.id)} className="flex min-h-[62px] items-center gap-2 rounded-2xl bg-[#F4F8FA] px-3 py-2 text-left">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${toneSolid(listing.tone)}`} />
                  <span className="whitespace-normal text-xs font-black leading-4 text-[#112532]">{listing.name}</span>
                </button>
                <div className="relative h-[62px] rounded-2xl bg-[#F4F8FA]/70">
                  <div className="absolute inset-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
                    {planningDays.map((day, index) => <div key={`${listing.id}-${day.label}-${index}`} className="rounded-xl bg-white/80" />)}
                  </div>
                  <div className="absolute inset-x-2 top-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
                    {rowReservations.map((reservation) => (
                      <button key={reservation.id} className="h-9 rounded-2xl bg-[#80A5B7] px-3 text-left text-white shadow-sm ring-1 ring-white/50" style={{ gridColumn: `${reservation.start} / span ${reservation.span}` }}>
                        <p className="truncate text-xs font-black">{reservation.guest}</p>
                        <p className="truncate text-[10px] font-bold text-white/75">{reservation.detail}</p>
                      </button>
                    ))}
                  </div>
                  <div className="absolute inset-x-2 bottom-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
                    {rowMarkers.map((marker) => (
                      <button key={marker.id} title={marker.label} className={`flex h-7 w-7 items-center justify-center justify-self-center rounded-full text-[11px] font-black text-white shadow-md ring-4 ring-white ${toneSolid(marker.tone)}`} style={{ gridColumn: `${marker.day} / span 1` }}>{marker.icon}</button>
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
  const filters: { key: EventFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "reservation", label: "Réservations" },
    { key: "intervention", label: "Missions" },
    { key: "stay", label: "Séjours" },
    { key: "payment", label: "Paiements" },
  ];
  return (
    <ShellCard className="overflow-hidden p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#80A5B7]">Activité</p>
          <h2 className="mt-1 text-2xl font-black text-[#112532]">Prochains points</h2>
        </div>
        <div className="flex gap-1 rounded-full bg-[#F4F8FA] p-1 text-xs font-black text-[#112532]/55">
          {(["72h", "7j", "saison"] as Horizon[]).map((item) => (
            <button key={item} onClick={() => setHorizon(item)} className={horizon === item ? "rounded-full bg-white px-3 py-1.5 text-[#112532] shadow-sm" : "px-3 py-1.5"}>{item}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button key={item.key} onClick={() => setFilter(item.key)} className={filter === item.key ? "shrink-0 rounded-full bg-[#112532] px-4 py-2 text-xs font-black text-white" : "shrink-0 rounded-full bg-[#F4F8FA] px-4 py-2 text-xs font-black text-[#112532]/62"}>{item.label}</button>
        ))}
      </div>
      <div className="mt-4 divide-y divide-[#112532]/8">
        {visibleEvents.map((event) => (
          <button key={event.id} className="grid w-full grid-cols-[34px_1fr_auto] items-center gap-3 py-3 text-left transition hover:bg-[#F4F8FA]">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white ${toneSolid(event.tone)}`}>{event.icon}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-[#112532]">{event.title}</span>
              <span className="mt-0.5 block truncate text-xs font-bold text-[#112532]/55">{event.line}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              {event.amount && <span className="text-sm font-black text-[#112532]">{event.amount}</span>}
              <span className="text-xs font-bold text-[#112532]/45">{event.when}</span>
            </span>
          </button>
        ))}
      </div>
    </ShellCard>
  );
}

function Opportunities() {
  return (
    <ShellCard className="overflow-hidden p-4">
      <SectionTitle eyebrow="Opportunités" title="À tester" action="Voir tout" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {opportunities.map((item) => (
          <article key={item.id} className="rounded-[1.35rem] bg-[#FDFBF7] p-4 ring-1 ring-[#112532]/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${toneSoft(item.tone)}`}>signal</span>
                <h3 className="mt-3 text-base font-black text-[#112532]">{item.title}</h3>
                <p className="mt-1 text-sm font-bold text-[#112532]/62">{item.listing}</p>
                <p className="text-sm font-bold text-[#112532]/62">{item.period}</p>
              </div>
              {item.potential > 0 && <p className={`text-2xl font-black ${toneText(item.tone)}`}>{formatMoney(item.potential)}</p>}
            </div>
            <button className={`mt-4 w-full rounded-full px-4 py-2 text-sm font-black ${item.tone === "orange" ? "bg-[#E0680E] text-white" : "bg-white text-[#E0680E] ring-1 ring-[#E0680E]/35"}`}>{item.action}</button>
          </article>
        ))}
      </div>
    </ShellCard>
  );
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#80A5B7]">{eyebrow}</p>
        <h2 className="mt-1 truncate text-2xl font-black text-[#112532]">{title}</h2>
      </div>
      {action && <button className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#477084] ring-1 ring-[#112532]/8">{action} →</button>}
    </div>
  );
}

function BottomNav() {
  const items = [
    { label: "Cockpit", icon: "⌂", active: true },
    { label: "Réservations", icon: "□" },
    { label: "Paiements", icon: "€" },
    { label: "Logements", icon: "⌁" },
    { label: "Paramètres", icon: "⚙" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#112532]/8 bg-white/94 px-2 py-2 shadow-[0_-14px_30px_rgba(17,37,50,0.08)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => (
          <button key={item.label} className={`rounded-2xl px-1 py-2 text-center ${item.active ? "text-[#E0680E]" : "text-[#112532]/62"}`}>
            <span className="block text-xl font-black leading-none">{item.icon}</span>
            <span className="mt-1 block text-[10px] font-black">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function OwnerDemoCockpit() {
  const [scope, setScope] = useState<Scope>("all");
  const [horizon, setHorizon] = useState<Horizon>("72h");

  const selectedLabel = useMemo(() => scope === "all" ? "Vue combinée" : listings.find((listing) => listing.id === scope)?.name ?? "Vue combinée", [scope]);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#F4F8FA] pb-28 text-[#112532] md:pb-10">
      <TopNav />
      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-5 px-4 py-5 sm:px-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex rounded-full bg-[#80A5B7]/15 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#477084] ring-1 ring-[#80A5B7]/20">Demo</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#112532]">Cockpit propriétaire</h1>
            <p className="mt-1 text-sm font-bold text-[#112532]/55">{selectedLabel} · La liberté que vous voulez, le soutien dont vous avez besoin.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#112532] shadow-sm ring-1 ring-[#112532]/8">Aujourd’hui</button>
            <button className="hidden rounded-full bg-[#112532] px-4 py-2 text-xs font-black text-white shadow-sm sm:block">Personnaliser</button>
          </div>
        </div>

        <MoneyHero />
        <SmartBrief />
        <ListingCarousel scope={scope} setScope={setScope} />
        <MiniPlanning scope={scope} setScope={setScope} />
        <section className="grid min-w-0 gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <CompactEventFeed scope={scope} horizon={horizon} setHorizon={setHorizon} />
          <Opportunities />
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
