"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { OwnerAppNav } from "@/components/owner-app/OwnerAppNav";

type Tone = "slate" | "emerald" | "sky" | "amber" | "violet" | "red" | "indigo";
type MetricId = "realised" | "gross" | "net";
type Scope = "all" | string;
type Horizon = "72h" | "7j" | "saison";
type EventFilter = "all" | "stay" | "intervention" | "reservation" | "alert";

type Listing = {
  id: string;
  name: string;
  short: string;
  tone: Tone;
  gradient: string;
  status: string;
  revenue: number;
  occupancy: number;
  next: string;
};

type CompactEvent = {
  id: string;
  listingId: string;
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
    tone: "emerald",
    gradient:
      "linear-gradient(135deg, rgba(6,78,59,0.96), rgba(16,185,129,0.68)), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.38), transparent 28%)",
    status: "Séjour en cours",
    revenue: 2184,
    occupancy: 96,
    next: "Ménage couvert",
  },
  {
    id: "apt4",
    name: "Apt 4 · Balcon",
    short: "4",
    tone: "sky",
    gradient:
      "linear-gradient(135deg, rgba(12,74,110,0.96), rgba(56,189,248,0.64)), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.36), transparent 30%)",
    status: "Arrivée demain",
    revenue: 684,
    occupancy: 88,
    next: "Départ 10h · arrivée 17h",
  },
  {
    id: "apt5",
    name: "Apt 5 · Sous les toits",
    short: "5",
    tone: "amber",
    gradient:
      "linear-gradient(135deg, rgba(120,53,15,0.96), rgba(251,191,36,0.66)), radial-gradient(circle at 70% 25%, rgba(255,255,255,0.34), transparent 28%)",
    status: "Juillet lent",
    revenue: 0,
    occupancy: 72,
    next: "Prix à revoir 15–20 juillet",
  },
  {
    id: "apt2",
    name: "Apt 2 · Jardin",
    short: "2",
    tone: "violet",
    gradient:
      "linear-gradient(135deg, rgba(76,29,149,0.96), rgba(167,139,250,0.64)), radial-gradient(circle at 78% 28%, rgba(255,255,255,0.36), transparent 28%)",
    status: "Intervention reçue",
    revenue: 412,
    occupancy: 81,
    next: "Photos disponibles",
  },
];

const months = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sept", "Oct", "Nov", "Déc",
];

const monthlyRevenue = [
  { month: "Jan", realised: 420, future: 0 },
  { month: "Fév", realised: 620, future: 0 },
  { month: "Mar", realised: 780, future: 0 },
  { month: "Avr", realised: 940, future: 0 },
  { month: "Mai", realised: 1120, future: 0 },
  { month: "Juin", realised: 1860, future: 0 },
  { month: "Juil", realised: 2686, future: 1450, live: true },
  { month: "Août", realised: 0, future: 5200 },
  { month: "Sept", realised: 0, future: 2460 },
  { month: "Oct", realised: 0, future: 980 },
  { month: "Nov", realised: 0, future: 360 },
  { month: "Déc", realised: 0, future: 580 },
];

const planningDays = [
  { month: "Juillet", label: "VEN\n10" },
  { month: "Juillet", label: "SAM\n11" },
  { month: "Juillet", label: "DIM\n12" },
  { month: "Juillet", label: "LUN\n13" },
  { month: "Juillet", label: "MAR\n14" },
  { month: "Juillet", label: "MER\n15" },
  { month: "Juillet", label: "JEU\n16" },
  { month: "Juillet", label: "VEN\n17" },
  { month: "Juillet", label: "SAM\n18" },
  { month: "Juillet", label: "DIM\n19" },
  { month: "Juillet", label: "LUN\n20" },
  { month: "Juillet", label: "MAR\n21" },
  { month: "Juillet", label: "MER\n22" },
  { month: "Juillet", label: "JEU\n23" },
  { month: "Juillet", label: "VEN\n24" },
  { month: "Juillet", label: "SAM\n25" },
  { month: "Juillet", label: "DIM\n26" },
  { month: "Juillet", label: "LUN\n27" },
  { month: "Août", label: "MAR\n28" },
  { month: "Août", label: "MER\n29" },
  { month: "Août", label: "JEU\n30" },
  { month: "Août", label: "VEN\n31" },
  { month: "Août", label: "SAM\n01" },
  { month: "Août", label: "DIM\n02" },
];

const planningReservations = [
  { id: "stay-pesk-1", listingId: "peskerezh", guest: "Nathalie Sarrazy", detail: "7 nuits · Airbnb · 1 260 €", start: 2, span: 7, tone: "emerald" as Tone },
  { id: "stay-apt4-1", listingId: "apt4", guest: "Claire M.", detail: "4 nuits · Airbnb · 684 €", start: 7, span: 4, tone: "sky" as Tone },
  { id: "stay-apt5-1", listingId: "apt5", guest: "Trou à remplir", detail: "15–20 juillet · opportunité", start: 6, span: 5, tone: "amber" as Tone },
  { id: "stay-apt2-1", listingId: "apt2", guest: "Séjour jardin", detail: "3 nuits · direct · 412 €", start: 10, span: 3, tone: "violet" as Tone },
];

const planningMarkers = [
  { id: "clean-pesk", listingId: "peskerezh", day: 9, icon: "🧹", tone: "emerald" as Tone, label: "ménage accepté" },
  { id: "clean-apt4", listingId: "apt4", day: 11, icon: "🧹", tone: "emerald" as Tone, label: "ménage confirmé" },
  { id: "interv-apt2", listingId: "apt2", day: 13, icon: "◆", tone: "violet" as Tone, label: "intervention terminée" },
  { id: "alert-apt5", listingId: "apt5", day: 8, icon: "!", tone: "amber" as Tone, label: "trou à remplir" },
];

const events: CompactEvent[] = [
  {
    id: "res-new-apt4",
    listingId: "apt4",
    category: "reservation",
    when: "Hier 17:42",
    icon: "+",
    title: "Nouvelle réservation",
    line: "Apt 4 · 12–16 août · 4 nuits · Airbnb",
    amount: "+684 €",
    status: "nouveau",
    tone: "sky",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "report-apt2",
    listingId: "apt2",
    category: "intervention",
    when: "Hier 16:08",
    icon: "◎",
    title: "Rapport ménage",
    line: "Apt 2 · 6 photos · aucun problème",
    status: "photos",
    tone: "emerald",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "interv-apt2-sandrine",
    listingId: "apt2",
    category: "intervention",
    when: "Aujourd’hui 15:00",
    icon: "◆",
    title: "Intervention jardin",
    line: "Apt 2 · Sandrine · terminée · 4 photos",
    amount: "98 €",
    status: "terminée",
    tone: "violet",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "checkout-apt4",
    listingId: "apt4",
    category: "stay",
    when: "Demain 10:00",
    icon: "↗",
    title: "Départ",
    line: "Apt 4 · ménage confirmé 11h · arrivée 17h",
    status: "rotation",
    tone: "sky",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "clean-apt4",
    listingId: "apt4",
    category: "intervention",
    when: "Demain 11:00",
    icon: "🧹",
    title: "Ménage",
    line: "Apt 4 · Sandrine · accepté",
    amount: "54 €",
    status: "accepté",
    tone: "emerald",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "arrival-apt4",
    listingId: "apt4",
    category: "stay",
    when: "Demain 17:00",
    icon: "→",
    title: "Arrivée",
    line: "Apt 4 · voyageurs attendus",
    status: "prévu",
    tone: "sky",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "interv-apt5-backup",
    listingId: "apt5",
    category: "intervention",
    when: "Vendredi",
    icon: "!",
    title: "Intervention peinture",
    line: "Apt 5 · refusée · backup proposé",
    status: "backup",
    tone: "amber",
    horizon: ["7j", "saison"],
  },
  {
    id: "res-mod-pesk",
    listingId: "peskerezh",
    category: "reservation",
    when: "Semaine prochaine",
    icon: "↔",
    title: "Réservation modifiée",
    line: "La Peskerezh · départ avancé · ménage recalé",
    amount: "-180 €",
    status: "modifiée",
    tone: "amber",
    horizon: ["7j", "saison"],
  },
];

const occupancy = [
  { listingId: "peskerezh", label: "Peskerezh", values: [24, 28, 36, 42, 51, 64, 92, 96, 58, 34, 18, 22] },
  { listingId: "apt4", label: "Apt 4", values: [16, 20, 24, 36, 42, 42, 76, 88, 36, 18, 10, 12] },
  { listingId: "apt5", label: "Apt 5", values: [12, 16, 18, 30, 36, 38, 66, 72, 22, 12, 6, 8] },
  { listingId: "apt2", label: "Apt 2", values: [14, 18, 22, 32, 40, 48, 71, 81, 40, 20, 8, 10] },
];

const marketPrices = [92, 96, 104, 118, 145, 168, 182, 220, 178, 140, 110, 98];

const opportunities = [
  {
    id: "gap-apt5",
    title: "Remplir un trou",
    body: "Apt 5 · 15–20 juillet · marché plutôt faible",
    action: "Tester -8% ou min. stay 2 nuits",
    tone: "amber" as Tone,
  },
  {
    id: "raise-pesk",
    title: "Derniers jours d’août",
    body: "Peskerezh · 96% occupé · marché tendu",
    action: "Garder le prix, voire +12 €/nuit",
    tone: "emerald" as Tone,
  },
  {
    id: "ops-apt4",
    title: "Rotation serrée",
    body: "Apt 4 · départ 10h, arrivée 17h",
    action: "Surveiller le rapport ménage",
    tone: "sky" as Tone,
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

function toneCard(tone: Tone) {
  const classes: Record<Tone, string> = {
    slate: "bg-white text-slate-950 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-950 ring-emerald-100",
    sky: "bg-sky-50 text-sky-950 ring-sky-100",
    amber: "bg-amber-50 text-amber-950 ring-amber-100",
    violet: "bg-violet-50 text-violet-950 ring-violet-100",
    red: "bg-red-50 text-red-950 ring-red-100",
    indigo: "bg-indigo-50 text-indigo-950 ring-indigo-100",
  };

  return classes[tone];
}

function toneSolid(tone: Tone) {
  const classes: Record<Tone, string> = {
    slate: "bg-slate-500",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    red: "bg-red-500",
    indigo: "bg-indigo-500",
  };

  return classes[tone];
}

function ShellCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>
      {children}
    </section>
  );
}

function MoneyHero() {
  const [elapsed, setElapsed] = useState(0);
  const [metric, setMetric] = useState<MetricId>("realised");

  useEffect(() => {
    const started = Date.now();
    const interval = window.setInterval(() => {
      setElapsed((Date.now() - started) / 1000);
    }, 600);

    return () => window.clearInterval(interval);
  }, []);

  const realised = 8426.37 + elapsed * 0.0074;
  const gross = 24860;
  const net = 18420;

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[#030712] p-5 text-white shadow-sm sm:p-7">
      <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl" />
      <div className="absolute -bottom-24 left-16 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="absolute right-8 top-8 h-28 w-28 rounded-full border border-white/10" />
      <div className="absolute right-12 top-12 h-20 w-20 rounded-full border border-white/10" />

      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-white/35">
          Argent qui rentre
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.25fr_0.75fr] lg:items-stretch">
          <button
            onClick={() => setMetric("realised")}
            className={`relative overflow-hidden rounded-[1.75rem] p-5 text-left ring-1 transition ${
              metric === "realised"
                ? "bg-white text-slate-950 ring-white"
                : "bg-white/8 text-white ring-white/10 hover:bg-white/12"
            }`}
          >
            <span className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-emerald-400/20 blur-2xl" />
            <span className="relative block text-[10px] font-black uppercase tracking-wide opacity-55">
              CA réalisé live
            </span>
            <span className="relative mt-2 block text-5xl font-black tracking-tight sm:text-7xl">
              {formatMoney(realised, 2)}
            </span>
            <span className="relative mt-3 inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-200 ring-1 ring-emerald-300/20">
              avance pendant les séjours en cours
            </span>
          </button>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <button
              onClick={() => setMetric("gross")}
              className={`rounded-[1.75rem] p-4 text-left ring-1 transition ${
                metric === "gross"
                  ? "bg-white text-slate-950 ring-white"
                  : "bg-white/8 text-white ring-white/10 hover:bg-white/12"
              }`}
            >
              <span className="block text-[10px] font-black uppercase tracking-wide opacity-55">
                CA brut annuel
              </span>
              <span className="mt-2 block text-3xl font-black tracking-tight">
                {formatMoney(gross)}
              </span>
              <span className="mt-1 block text-xs font-bold opacity-55">
                réservations confirmées
              </span>
            </button>

            <button
              onClick={() => setMetric("net")}
              className={`rounded-[1.75rem] p-4 text-left ring-1 transition ${
                metric === "net"
                  ? "bg-white text-slate-950 ring-white"
                  : "bg-white/8 text-white ring-white/10 hover:bg-white/12"
              }`}
            >
              <span className="block text-[10px] font-black uppercase tracking-wide opacity-55">
                Après variables
              </span>
              <span className="mt-2 block text-3xl font-black tracking-tight">
                {formatMoney(net)}
              </span>
              <span className="mt-1 block text-xs font-bold opacity-55">
                estimation opérationnelle
              </span>
            </button>
          </div>
        </div>

        <MetricBreakdown metric={metric} />
      </div>
    </section>
  );
}

function MetricBreakdown({ metric }: { metric: MetricId }) {
  if (metric === "realised") {
    const max = Math.max(...monthlyRevenue.map((row) => row.realised + row.future));

    return (
      <div className="mt-4 rounded-[1.75rem] bg-white/8 p-4 ring-1 ring-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">Réalisé par mois</p>
            <p className="mt-1 text-xs font-bold text-white/45">
              Plein = réalisé / prorata. Contour = reste déjà réservé sur l’année.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
            année
          </span>
        </div>

        <div className="mt-4 grid grid-cols-12 items-end gap-1.5">
          {monthlyRevenue.map((row) => {
            const total = row.realised + row.future;
            const totalHeight = Math.max(10, (total / max) * 100);
            const realisedHeight = total ? (row.realised / total) * 100 : 0;

            return (
              <button key={row.month} className="group flex flex-col items-center gap-2">
                <div
                  className={`flex w-full items-end overflow-hidden rounded-t-xl rounded-b-md border ${
                    row.future > 0 ? "border-white/40 bg-transparent" : "border-transparent bg-white/10"
                  } ${row.live ? "shadow-[0_0_18px_rgba(16,185,129,0.55)]" : ""}`}
                  style={{ height: `${totalHeight}px` }}
                >
                  <div
                    className="w-full rounded-t-lg bg-emerald-400"
                    style={{ height: `${Math.max(2, realisedHeight)}%` }}
                  />
                </div>
                <span className="text-[9px] font-black uppercase text-white/45">{row.month}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (metric === "gross") {
    const rows = [
      { label: "La Peskerezh", value: 10480, width: 42, tone: "emerald" as Tone },
      { label: "Apt 4 · Balcon", value: 6480, width: 26, tone: "sky" as Tone },
      { label: "Apt 5 · Sous les toits", value: 4320, width: 17, tone: "amber" as Tone },
      { label: "Apt 2 · Jardin", value: 3580, width: 15, tone: "violet" as Tone },
    ];

    return (
      <div className="mt-4 rounded-[1.75rem] bg-white/8 p-4 ring-1 ring-white/10">
        <p className="text-sm font-black text-white">CA brut par logement</p>
        <p className="mt-1 text-xs font-bold text-white/45">
          Airbnb domine pour l’instant, donc la lecture par logement est plus utile.
        </p>

        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[112px_1fr_86px] items-center gap-2 text-xs font-black sm:grid-cols-[150px_1fr_96px]">
              <span className="truncate text-white/55">{row.label}</span>
              <div className="h-4 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${toneSolid(row.tone)}`}
                  style={{ width: `${row.width}%` }}
                />
              </div>
              <span className="text-right text-white">{formatMoney(row.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const gross = 24860;
  const deductions = [
    { label: "Ménage", value: 3240, tone: "amber" as Tone },
    { label: "Commissions", value: 1120, tone: "sky" as Tone },
    { label: "Interventions", value: 430, tone: "violet" as Tone },
    { label: "Linge / autres", value: 650, tone: "slate" as Tone },
    { label: "Maintenance", value: 1000, tone: "red" as Tone },
  ];

  let running = gross;
  const waterfall = [
    { label: "CA brut", left: 0, width: 100, tone: "emerald" as Tone, display: formatMoney(gross) },
    ...deductions.map((item) => {
      running -= item.value;
      return {
        label: item.label,
        left: (running / gross) * 100,
        width: (item.value / gross) * 100,
        tone: item.tone,
        display: `-${formatMoney(item.value)}`,
      };
    }),
    { label: "Après variables", left: 0, width: (running / gross) * 100, tone: "emerald" as Tone, display: formatMoney(running) },
  ];

  return (
    <div className="mt-4 rounded-[1.75rem] bg-white/8 p-4 ring-1 ring-white/10">
      <p className="text-sm font-black text-white">Cascade variables</p>
      <p className="mt-1 text-xs font-bold text-white/45">
        Chaque coût part du niveau restant et mène progressivement au résultat.
      </p>

      <div className="mt-4 space-y-3">
        {waterfall.map((row) => (
          <div key={row.label} className="grid grid-cols-[104px_1fr_80px] items-center gap-2 text-xs font-black sm:grid-cols-[140px_1fr_96px]">
            <span className="truncate text-white/55">{row.label}</span>
            <div className="relative h-5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`absolute top-0 h-full rounded-full ${toneSolid(row.tone)}`}
                style={{
                  left: `${Math.max(0, row.left)}%`,
                  width: `${Math.max(3, row.width)}%`,
                }}
              />
            </div>
            <span className="text-right text-white">{row.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmartBrief() {
  return (
    <ShellCard className="overflow-hidden p-5">
      <div className="relative">
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl" />
        <p className="relative text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          À retenir maintenant
        </p>

        <p className="relative mt-3 text-xl font-black leading-8 text-slate-950 sm:text-2xl sm:leading-9">
          Vous devez{" "}
          <Link href="/owner/payments" className="underline decoration-amber-400 decoration-4 underline-offset-4">
            valider la demande de paiement de Sandrine
          </Link>{" "}
          aujourd’hui.{" "}
          <button className="font-black underline decoration-sky-300 decoration-4 underline-offset-4">
            Apt 2 est lent du 15 au 20 juillet
          </button>{" "}
          : vu le marché, une baisse de prix modérée semble pertinente.
        </p>
      </div>
    </ShellCard>
  );
}

function ListingCarousel({
  scope,
  setScope,
}: {
  scope: Scope;
  setScope: (scope: Scope) => void;
}) {
  const selected = scope === "all" ? null : listings.find((listing) => listing.id === scope);

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Logements
          </p>
          <h2 className="truncate text-2xl font-black text-slate-950">
            {selected ? selected.name : "Vue combinée"}
          </h2>
        </div>
        <p className="shrink-0 text-xs font-bold text-slate-400">swipe · filtrer</p>
      </div>

      <div className="w-full max-w-full overflow-x-auto pb-2">
        <div className="flex snap-x gap-3">
          <button
            onClick={() => setScope("all")}
            className={`min-w-[78%] snap-start overflow-hidden rounded-[2rem] p-3 text-left shadow-sm ring-1 transition sm:min-w-[340px] ${
              scope === "all"
                ? "bg-slate-950 text-white ring-slate-950"
                : "bg-white text-slate-950 ring-slate-200"
            }`}
          >
            <div className="flex h-40 flex-col justify-between rounded-[1.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 p-4 text-white">
              <div className="flex justify-between">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">
                  combiné
                </span>
                <span className="text-3xl font-black">4</span>
              </div>
              <div>
                <p className="text-2xl font-black">Tous les biens</p>
                <p className="mt-1 text-sm font-bold text-white/60">
                  argent · opérations · priorités
                </p>
              </div>
            </div>
          </button>

          {listings.map((listing) => (
            <button
              key={listing.id}
              onClick={() => setScope(listing.id)}
              className={`min-w-[78%] snap-start overflow-hidden rounded-[2rem] bg-white p-3 text-left shadow-sm ring-1 transition active:scale-[0.99] sm:min-w-[340px] ${
                scope === listing.id ? "ring-4 ring-slate-950" : "ring-slate-200"
              }`}
            >
              <div
                className="relative flex h-40 flex-col justify-between overflow-hidden rounded-[1.5rem] p-4 text-white"
                style={{ backgroundImage: listing.gradient }}
              >
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />

                <div className="relative flex justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-950 shadow-sm">
                    {listing.short}
                  </span>
                  <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-black backdrop-blur">
                    {listing.occupancy}% août
                  </span>
                </div>

                <div className="relative">
                  <p className="text-2xl font-black">{listing.name}</p>
                  <p className="mt-1 text-sm font-bold text-white/75">{listing.status}</p>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3 p-2 pt-4">
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">CA période</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatMoney(listing.revenue)}
                  </p>
                </div>
                <div className="max-w-[135px] rounded-2xl bg-slate-50 px-3 py-2 text-right text-xs font-black text-slate-500">
                  {listing.next}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <MiniPlanning scope={scope} setScope={setScope} />
    </section>
  );
}

function MiniPlanning({
  scope,
  setScope,
}: {
  scope: Scope;
  setScope: (scope: Scope) => void;
}) {
  const visibleListings = scope === "all"
    ? listings
    : listings.filter((listing) => listing.id === scope);

  const dayWidth = "2.65rem";

  return (
    <ShellCard className="max-w-full overflow-hidden">
      <div className="border-b border-slate-100 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          Planning
        </p>
        <h3 className="text-xl font-black leading-6 text-slate-950">
          Réservations, ménages et interventions
        </h3>
      </div>

      <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[118px_1fr] border-b border-slate-100">
            <div className="sticky left-0 z-30 bg-white" />
            <div
              className="grid gap-1 px-2 pt-2"
              style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}
            >
              <div className="col-span-18 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                Juillet
              </div>
              <div className="col-span-6 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                Août
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[118px_1fr] border-b border-slate-100">
            <div className="sticky left-0 z-30 bg-white" />
            <div
              className="grid gap-1 px-2 py-2"
              style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}
            >
              {planningDays.map((day, index) => (
                <div
                  key={`${day.label}-${index}`}
                  className="whitespace-pre-line rounded-2xl bg-slate-50 px-1.5 py-1.5 text-center text-[10px] font-black leading-4 text-slate-500 ring-1 ring-slate-100"
                >
                  {day.label}
                </div>
              ))}
            </div>
          </div>

          {visibleListings.map((listing) => {
            const rowReservations = planningReservations.filter((reservation) => reservation.listingId === listing.id);
            const rowMarkers = planningMarkers.filter((marker) => marker.listingId === listing.id);

            return (
              <div key={listing.id} className="grid grid-cols-[118px_1fr] border-b border-slate-100 last:border-b-0">
                <button
                  onClick={() => setScope(listing.id)}
                  className="sticky left-0 z-30 flex min-h-[74px] items-center gap-2 bg-white px-3 py-3 text-left"
                >
                  <span className={`h-3 w-3 shrink-0 rounded-full ${toneSolid(listing.tone)}`} />
                  <span className="min-w-0 whitespace-normal text-xs font-black leading-4 text-slate-800">
                    {listing.name}
                  </span>
                </button>

                <div className="relative h-[74px] px-2 py-2">
                  <div
                    className="absolute inset-x-2 inset-y-2 grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}
                  >
                    {planningDays.map((day, index) => (
                      <div key={`${listing.id}-${day.label}-${index}`} className="rounded-2xl bg-slate-50/75" />
                    ))}
                  </div>

                  <div
                    className="absolute inset-x-2 top-3 grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}
                  >
                    {rowReservations.map((reservation) => (
                      <button
                        key={reservation.id}
                        onClick={() => setScope(reservation.listingId)}
                        className={`h-10 rounded-2xl px-3 text-left text-white shadow-sm ring-1 ring-white/50 ${toneSolid(reservation.tone)}`}
                        style={{ gridColumn: `${reservation.start} / span ${reservation.span}` }}
                      >
                        <p className="truncate text-xs font-black">{reservation.guest}</p>
                        <p className="truncate text-[10px] font-bold text-white/75">{reservation.detail}</p>
                      </button>
                    ))}
                  </div>

                  <div
                    className="absolute inset-x-2 bottom-2 grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}
                  >
                    {rowMarkers.map((marker) => (
                      <button
                        key={marker.id}
                        title={marker.label}
                        onClick={() => setScope(marker.listingId)}
                        className={`flex h-7 w-7 items-center justify-center justify-self-center rounded-full text-[11px] font-black text-white shadow-md ring-4 ring-white ${toneSolid(marker.tone)}`}
                        style={{ gridColumn: `${marker.day} / span 1` }}
                      >
                        {marker.icon}
                      </button>
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

function CompactEventFeed({
  scope,
  horizon,
  setHorizon,
}: {
  scope: Scope;
  horizon: Horizon;
  setHorizon: (horizon: Horizon) => void;
}) {
  const [filter, setFilter] = useState<EventFilter>("all");

  const visibleEvents = events.filter((event) => {
    const scopeMatch = scope === "all" || event.listingId === scope || event.listingId === "all";
    const filterMatch = filter === "all" || event.category === filter;
    return scopeMatch && filterMatch && event.horizon.includes(horizon);
  });

  const filters: { key: EventFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "stay", label: "Séjours" },
    { key: "intervention", label: "Missions" },
    { key: "reservation", label: "Réservations" },
    { key: "alert", label: "Alertes" },
  ];

  return (
    <ShellCard className="max-w-full overflow-hidden p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Activité
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Prochains points
          </h2>
        </div>

        <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-xs font-black text-slate-500">
          {(["72h", "7j", "saison"] as Horizon[]).map((item) => (
            <button
              key={item}
              onClick={() => setHorizon(item)}
              className={horizon === item ? "rounded-full bg-white px-3 py-1.5 text-slate-950 shadow-sm" : "px-3 py-1.5"}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={filter === item.key ? "shrink-0 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white" : "shrink-0 rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600"}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative mt-4">
        <div className="absolute bottom-4 left-4 top-4 w-0.5 rounded-full bg-slate-100" />

        <div className="space-y-1">
          {visibleEvents.map((event) => (
            <button
              key={event.id}
              className="relative grid w-full grid-cols-[34px_1fr_auto] items-center gap-3 rounded-2xl px-1 py-2 text-left transition hover:bg-slate-50"
            >
              <span className={`z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white shadow-sm ring-4 ring-white ${toneSolid(event.tone)}`}>
                {event.icon}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-slate-950">
                  {event.title} · {event.line}
                </span>
                <span className="mt-0.5 block text-xs font-bold text-slate-400">
                  {event.when}
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1">
                {event.amount && <span className="text-sm font-black text-slate-950">{event.amount}</span>}
                {event.status && (
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${toneCard(event.tone)}`}>
                    {event.status}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </ShellCard>
  );
}

function MiniSparkline({ data, tone }: { data: number[]; tone: Tone }) {
  const points = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    return data.map((value, index) => {
      const x = 4 + (index / Math.max(data.length - 1, 1)) * 82;
      const y = 24 - ((value - min) / range) * 18;
      return `${x},${y}`;
    }).join(" ");
  }, [data]);

  const color = {
    slate: "#64748b",
    emerald: "#10b981",
    sky: "#0ea5e9",
    amber: "#f59e0b",
    violet: "#8b5cf6",
    red: "#ef4444",
    indigo: "#6366f1",
  }[tone];

  return (
    <svg viewBox="0 0 90 30" className="h-8 w-24 overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignalCards() {
  return (
    <section className="space-y-3">
      <article className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-500">
              Marché · Le Goyen
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">prix haut</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">notre prix vs tendance marché</p>
          </div>
          <MiniSparkline data={[160, 150, 170, 180, 220, 205, 185, 175]} tone="amber" />
        </div>
      </article>

      <article className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-violet-400">
              Trafic direct
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">+34 vues</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">petit volume, à suivre plus bas</p>
          </div>
          <MiniSparkline data={[1, 1, 2, 1, 3, 4, 6]} tone="violet" />
        </div>
      </article>
    </section>
  );
}

function Opportunities() {
  return (
    <ShellCard className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-amber-50 via-white to-violet-50 p-5">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          Opportunités
        </p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">
          À tester
        </h2>

        <div className="mt-4 space-y-3">
          {opportunities.map((item) => (
            <button key={item.id} className={`block w-full rounded-[1.5rem] p-4 text-left shadow-sm ring-1 ${toneCard(item.tone)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{item.title}</p>
                  <p className="mt-1 text-sm font-bold opacity-65">{item.body}</p>
                </div>
                <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-black ring-1 ring-black/5">
                  idée
                </span>
              </div>
              <p className="mt-3 text-xs font-black opacity-70">{item.action}</p>
            </button>
          ))}
        </div>
      </div>
    </ShellCard>
  );
}

function OccupancyPricing({
  scope,
}: {
  scope: Scope;
}) {
  const rows = scope === "all" ? occupancy : occupancy.filter((row) => row.listingId === scope);

  return (
    <ShellCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Occupation × Marché
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {rows.length === 1 ? rows[0].label : "Saison"}
          </h2>
        </div>
        <Link href="/owner/app/reservations" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
          Source
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[112px_repeat(12,1fr)] gap-2 text-xs font-black text-slate-400">
            <div />
            {months.map((month) => (
              <div key={month} className="text-center">{month}</div>
            ))}
          </div>

          <div className="mt-2 space-y-2">
            {rows.map((row) => (
              <div key={row.listingId} className="grid grid-cols-[112px_repeat(12,1fr)] gap-2">
                <div className="truncate rounded-2xl bg-slate-50 px-3 py-3 text-sm font-black text-slate-700">
                  {row.label}
                </div>

                {row.values.map((value, index) => {
                  const price = marketPrices[index];
                  const priceTop = Math.max(10, Math.min(78, 88 - ((price - 80) / 160) * 78));

                  return (
                    <button key={`${row.listingId}-${months[index]}`} className="relative h-20 overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                      <div
                        className={`absolute bottom-0 left-0 right-0 ${occupancyColor(value)}`}
                        style={{ height: `${Math.max(value, 8)}%` }}
                      />
                      <div
                        className="absolute left-2 right-2 h-1 rounded-full bg-orange-400 shadow-sm"
                        style={{ top: `${priceTop}%` }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-sm font-black text-slate-950">{value}%</span>
                        <span className="text-[10px] font-black text-orange-700">{price}€</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs font-bold text-slate-500">
        Couleur = occupation. Ligne orange = prix marché type Le Goyen. Cellule cliquable pour détail mois/logement.
      </p>
    </ShellCard>
  );
}

function occupancyColor(value: number) {
  if (value >= 85) return "bg-emerald-500/80";
  if (value >= 65) return "bg-emerald-300/80";
  if (value >= 40) return "bg-amber-200/85";
  if (value >= 20) return "bg-orange-100";
  return "bg-slate-100";
}

export function OwnerDemoCockpit() {
  const [scope, setScope] = useState<Scope>("all");
  const [horizon, setHorizon] = useState<Horizon>("72h");

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-50 pb-28 text-slate-950 md:pb-8">
      <OwnerAppNav active="cockpit" />

      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-5 px-3 py-4 sm:px-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Lab UI
            </p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Owner cockpit demo
            </h1>
          </div>

          <Link href="/owner/app" className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200">
            Retour app
          </Link>
        </div>

        <MoneyHero />
        <SmartBrief />
        <ListingCarousel scope={scope} setScope={setScope} />

        <section className="grid min-w-0 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 space-y-5">
            <CompactEventFeed scope={scope} horizon={horizon} setHorizon={setHorizon} />
          </div>

          <div className="min-w-0 space-y-5">
            <Opportunities />
          </div>
        </section>
      </div>
    </main>
  );
}
