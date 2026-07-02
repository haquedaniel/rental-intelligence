"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { OwnerAppNav } from "@/components/owner-app/OwnerAppNav";

type Tone = "slate" | "emerald" | "sky" | "amber" | "violet" | "red" | "indigo";
type MetricId = "realised" | "gross" | "net";
type Scope = "all" | string;
type Horizon = "72h" | "7j" | "saison";

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

type Event = {
  id: string;
  listingId: string;
  when: string;
  day: string;
  type: "booking" | "stay" | "cleaning" | "report" | "intervention" | "payment" | "signal" | "arrival" | "departure";
  title: string;
  summary: string;
  amount?: string;
  chip?: string;
  tone: Tone;
  horizon: Horizon[];
};

type Signal = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: Tone;
  data: number[];
};

const listings: Listing[] = [
  {
    id: "peskerezh",
    name: "La Peskerezh",
    short: "P",
    tone: "emerald",
    gradient:
      "linear-gradient(135deg, rgba(6,78,59,0.95), rgba(16,185,129,0.68)), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.35), transparent 28%)",
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
      "linear-gradient(135deg, rgba(12,74,110,0.95), rgba(56,189,248,0.62)), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 30%)",
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
      "linear-gradient(135deg, rgba(120,53,15,0.96), rgba(251,191,36,0.65)), radial-gradient(circle at 70% 25%, rgba(255,255,255,0.34), transparent 28%)",
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
      "linear-gradient(135deg, rgba(76,29,149,0.96), rgba(167,139,250,0.62)), radial-gradient(circle at 78% 28%, rgba(255,255,255,0.35), transparent 28%)",
    status: "Intervention reçue",
    revenue: 412,
    occupancy: 81,
    next: "Photos disponibles",
  },
];

const events: Event[] = [
  {
    id: "e1",
    listingId: "apt4",
    when: "Hier 17:42",
    day: "Hier",
    type: "booking",
    title: "Nouvelle réservation",
    summary: "Apt 4 · 12–16 août · 4 nuits · Airbnb",
    amount: "+684 €",
    chip: "nouveau",
    tone: "sky",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "e2",
    listingId: "apt2",
    when: "Hier 16:08",
    day: "Hier",
    type: "report",
    title: "Rapport ménage reçu",
    summary: "Apt 2 · 6 photos · aucun problème · prêt voyageurs",
    amount: "54 € coût",
    chip: "rassurant",
    tone: "emerald",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "e3",
    listingId: "peskerezh",
    when: "Maintenant",
    day: "Maintenant",
    type: "stay",
    title: "Séjour en cours",
    summary: "La Peskerezh · le réalisé progresse au prorata",
    amount: "live",
    chip: "occupé",
    tone: "emerald",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "e4",
    listingId: "apt2",
    when: "Aujourd’hui 15:00",
    day: "Aujourd’hui",
    type: "intervention",
    title: "Intervention terminée",
    summary: "Jardin · 2h · frais matériel 18 € · photos reçues",
    amount: "98 €",
    chip: "rapport reçu",
    tone: "violet",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "e5",
    listingId: "apt4",
    when: "Demain 10:00",
    day: "Demain",
    type: "departure",
    title: "Départ voyageur",
    summary: "Apt 4 · départ 10h · ménage confirmé à 11h",
    amount: "marge OK",
    chip: "rotation",
    tone: "sky",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "e6",
    listingId: "apt4",
    when: "Demain 11:00",
    day: "Demain",
    type: "cleaning",
    title: "Ménage confirmé",
    summary: "Sandrine · arrivée prévue 17h · rapport attendu",
    amount: "54 €",
    chip: "couvert",
    tone: "emerald",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "e7",
    listingId: "all",
    when: "Aujourd’hui",
    day: "À faire",
    type: "payment",
    title: "Paiement à valider",
    summary: "Sandrine · missions de juin · demande en attente",
    amount: "420 €",
    chip: "action",
    tone: "amber",
    horizon: ["72h", "7j", "saison"],
  },
  {
    id: "e8",
    listingId: "apt5",
    when: "15–20 juillet",
    day: "Signal",
    type: "signal",
    title: "Prix probablement trop haut",
    summary: "Apt 5 · rythme de réservation lent vs marché",
    amount: "-8% ?",
    chip: "prix",
    tone: "amber",
    horizon: ["7j", "saison"],
  },
  {
    id: "e9",
    listingId: "peskerezh",
    when: "Août",
    day: "Saison",
    type: "booking",
    title: "Août presque plein",
    summary: "La Peskerezh · très bon rythme · prix tenus",
    amount: "96%",
    chip: "fort",
    tone: "emerald",
    horizon: ["saison"],
  },
];

const signals: Signal[] = [
  {
    id: "traffic",
    title: "Trafic direct",
    value: "+34 vues",
    detail: "pages logements cette semaine",
    tone: "violet",
    data: [8, 9, 12, 10, 15, 22, 34],
  },
  {
    id: "market",
    title: "Prix marché Apt 2",
    value: "+13%",
    detail: "au-dessus du médian 15–20 juillet",
    tone: "amber",
    data: [112, 108, 106, 104, 103, 105, 104],
  },
  {
    id: "pace",
    title: "Booking pace",
    value: "lent",
    detail: "septembre en retard",
    tone: "sky",
    data: [68, 62, 54, 48, 42, 37, 33],
  },
];

const occupancy = [
  { listingId: "peskerezh", label: "Peskerezh", values: [64, 92, 96, 58, 34] },
  { listingId: "apt4", label: "Apt 4", values: [42, 76, 88, 36, 18] },
  { listingId: "apt5", label: "Apt 5", values: [38, 66, 72, 22, 12] },
  { listingId: "apt2", label: "Apt 2", values: [48, 71, 81, 40, 20] },
];

const months = ["Juin", "Juil", "Août", "Sept", "Oct"];

const planningDays = [
  "VEN 10",
  "SAM 11",
  "DIM 12",
  "LUN 13",
  "MAR 14",
  "MER 15",
  "JEU 16",
  "VEN 17",
  "SAM 18",
  "DIM 19",
  "LUN 20",
  "MAR 21",
  "MER 22",
  "JEU 23",
  "VEN 24",
  "SAM 25",
  "DIM 26",
  "LUN 27",
];

const planningReservations = [
  {
    id: "stay-pesk-1",
    listingId: "peskerezh",
    guest: "Nathalie Sarrazy",
    detail: "7 nuits · Airbnb · 1 260 €",
    start: 2,
    span: 7,
    tone: "emerald" as Tone,
  },
  {
    id: "stay-apt4-1",
    listingId: "apt4",
    guest: "Claire M.",
    detail: "4 nuits · Airbnb · 684 €",
    start: 7,
    span: 4,
    tone: "sky" as Tone,
  },
  {
    id: "stay-apt5-1",
    listingId: "apt5",
    guest: "Période à remplir",
    detail: "15–20 juillet · prix à tester",
    start: 6,
    span: 5,
    tone: "amber" as Tone,
  },
  {
    id: "stay-apt2-1",
    listingId: "apt2",
    guest: "Séjour jardin",
    detail: "3 nuits · direct · 412 €",
    start: 10,
    span: 3,
    tone: "violet" as Tone,
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

function iconFor(type: Event["type"]) {
  return {
    booking: "+",
    stay: "●",
    cleaning: "✓",
    report: "◎",
    intervention: "◆",
    payment: "€",
    signal: "!",
    arrival: "→",
    departure: "↗",
  }[type];
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
  const [metric, setMetric] = useState<MetricId>("net");

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

  const metrics = [
    {
      id: "realised" as const,
      label: "CA réalisé",
      value: formatMoney(realised, 2),
      detail: "+420 € depuis votre dernière visite",
    },
    {
      id: "gross" as const,
      label: "CA brut annuel",
      value: formatMoney(gross),
      detail: "réservations confirmées",
    },
    {
      id: "net" as const,
      label: "Après variables",
      value: formatMoney(net),
      detail: "estimation opérationnelle",
    },
  ];

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
              se met à jour pendant les séjours en cours
            </span>
          </button>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {metrics.slice(1).map((item) => (
              <button
                key={item.id}
                onClick={() => setMetric(item.id)}
                className={`rounded-[1.75rem] p-4 text-left ring-1 transition ${
                  metric === item.id
                    ? "bg-white text-slate-950 ring-white"
                    : "bg-white/8 text-white ring-white/10 hover:bg-white/12"
                }`}
              >
                <span className="block text-[10px] font-black uppercase tracking-wide opacity-55">
                  {item.label}
                </span>
                <span className="mt-2 block text-3xl font-black tracking-tight">
                  {item.value}
                </span>
                <span className="mt-1 block text-xs font-bold opacity-55">
                  {item.detail}
                </span>
              </button>
            ))}
          </div>
        </div>

        <MetricBreakdown metric={metric} />
      </div>
    </section>
  );
}

function MetricBreakdown({ metric }: { metric: MetricId }) {
  if (metric === "gross") {
    const rows = [
      { label: "La Peskerezh", value: 10480, width: 42, tone: "emerald" as Tone },
      { label: "Apt 4 · Balcon", value: 6480, width: 26, tone: "sky" as Tone },
      { label: "Apt 5 · Sous les toits", value: 4320, width: 17, tone: "amber" as Tone },
      { label: "Apt 2 · Jardin", value: 3580, width: 15, tone: "violet" as Tone },
    ];

    return (
      <div className="mt-4 rounded-[1.75rem] bg-white/8 p-4 ring-1 ring-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">CA brut par logement</p>
            <p className="mt-1 text-xs font-bold text-white/45">
              Réservations confirmées, annulations exclues.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
            annuel
          </span>
        </div>

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

  if (metric === "net") {
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
      {
        label: "CA brut",
        left: 0,
        width: 100,
        tone: "emerald" as Tone,
        display: formatMoney(gross),
      },
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
      {
        label: "Après variables",
        left: 0,
        width: (running / gross) * 100,
        tone: "emerald" as Tone,
        display: formatMoney(running),
      },
    ];

    return (
      <div className="mt-4 rounded-[1.75rem] bg-white/8 p-4 ring-1 ring-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">Cascade variables</p>
            <p className="mt-1 text-xs font-bold text-white/45">
              Les coûts partent du brut et mènent progressivement au résultat après variables.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
            waterfall
          </span>
        </div>

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

  const rows = [
    { label: "Séjours terminés", value: 7840, width: 92, tone: "emerald" as Tone },
    { label: "Prorata en cours", value: 586, width: 7, tone: "sky" as Tone },
    { label: "Depuis ce matin", value: 42, width: 3, tone: "violet" as Tone },
  ];

  return (
    <div className="mt-4 rounded-[1.75rem] bg-white/8 p-4 ring-1 ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">Lecture du réalisé</p>
          <p className="mt-1 text-xs font-bold text-white/45">
            Séjours terminés + prorata des séjours en cours.
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
          live
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[112px_1fr_80px] items-center gap-2 text-xs font-black sm:grid-cols-[150px_1fr_96px]">
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

        <p className="relative mt-4 text-sm font-bold leading-6 text-slate-500">
          Cette zone doit rester courte : deux phrases maximum, avec les liens directement dans le texte.
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
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Logements
          </p>
          <h2 className="text-2xl font-black text-slate-950">
            {selected ? selected.name : "Vue combinée"}
          </h2>
        </div>
        <p className="text-xs font-bold text-slate-400">swipe · filtrer</p>
      </div>

      <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <button
          onClick={() => setScope("all")}
          className={`min-w-[78%] snap-start overflow-hidden rounded-[2rem] p-3 text-left shadow-sm ring-1 transition sm:min-w-[340px] ${
            scope === "all"
              ? "bg-slate-950 text-white ring-slate-950"
              : "bg-white text-slate-950 ring-slate-200"
          }`}
        >
          <div className="flex h-44 flex-col justify-between rounded-[1.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 p-4 text-white">
            <div className="flex justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">
                combiné
              </span>
              <span className="text-3xl font-black">4</span>
            </div>
            <div>
              <p className="text-2xl font-black">Tous les biens</p>
              <p className="mt-1 text-sm font-bold text-white/60">
                argent · opérations · signaux
              </p>
            </div>
          </div>
        </button>

        {listings.map((listing) => (
          <button
            key={listing.id}
            onClick={() => setScope(listing.id)}
            className={`min-w-[78%] snap-start overflow-hidden rounded-[2rem] bg-white p-3 text-left shadow-sm ring-1 transition hover:-translate-y-0.5 sm:min-w-[340px] ${
              scope === listing.id ? "ring-4 ring-slate-950" : "ring-slate-200"
            }`}
          >
            <div
              className="relative flex h-44 flex-col justify-between overflow-hidden rounded-[1.5rem] p-4 text-white"
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

  return (
    <ShellCard className="overflow-hidden">
      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Planning
            </p>
            <h3 className="text-xl font-black text-slate-950">
              Réservations à venir
            </h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
            scroll horizontal →
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[126px_1fr] border-b border-slate-100">
            <div className="bg-white" />
            <div
              className="grid gap-1 px-2 py-3"
              style={{ gridTemplateColumns: "repeat(18, 3.25rem)" }}
            >
              {planningDays.map((day) => (
                <div
                  key={day}
                  className="rounded-2xl bg-slate-50 px-2 py-2 text-center text-[11px] font-black text-slate-500 ring-1 ring-slate-100"
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {visibleListings.map((listing) => {
            const rowReservations = planningReservations.filter(
              (reservation) => reservation.listingId === listing.id,
            );

            return (
              <div key={listing.id} className="grid grid-cols-[126px_1fr] border-b border-slate-100 last:border-b-0">
                <button
                  onClick={() => setScope(listing.id)}
                  className="flex items-center gap-2 bg-white px-3 py-4 text-left"
                >
                  <span className={`h-3 w-3 rounded-full ${toneSolid(listing.tone)}`} />
                  <span className="min-w-0 truncate text-sm font-black text-slate-800">
                    {listing.name.replace(" · ", " ")}
                  </span>
                </button>

                <div
                  className="grid gap-1 px-2 py-4"
                  style={{ gridTemplateColumns: "repeat(18, 3.25rem)" }}
                >
                  {planningDays.map((day) => (
                    <div key={`${listing.id}-${day}`} className="h-14 rounded-2xl bg-slate-50/60" />
                  ))}

                  {rowReservations.map((reservation) => (
                    <button
                      key={reservation.id}
                      onClick={() => setScope(reservation.listingId)}
                      className={`relative z-10 -mt-14 h-14 rounded-2xl px-4 text-left text-white shadow-sm ring-1 ring-white/50 ${toneSolid(reservation.tone)}`}
                      style={{
                        gridColumn: `${reservation.start} / span ${reservation.span}`,
                      }}
                    >
                      <p className="truncate text-sm font-black">{reservation.guest}</p>
                      <p className="truncate text-xs font-bold text-white/70">{reservation.detail}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ShellCard>
  );
}

function Timeline({
  scope,
  horizon,
  setHorizon,
}: {
  scope: Scope;
  horizon: Horizon;
  setHorizon: (horizon: Horizon) => void;
}) {
  const visibleEvents = events.filter((event) => {
    const scopeMatch = scope === "all" || event.listingId === scope || event.listingId === "all";
    return scopeMatch && event.horizon.includes(horizon);
  });

  return (
    <ShellCard className="overflow-hidden p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Timeline
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Ordre des événements
          </h2>
        </div>

        <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-xs font-black text-slate-500">
          {(["72h", "7j", "saison"] as Horizon[]).map((item) => (
            <button
              key={item}
              onClick={() => setHorizon(item)}
              className={
                horizon === item
                  ? "rounded-full bg-white px-3 py-1.5 text-slate-950 shadow-sm"
                  : "px-3 py-1.5"
              }
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-7">
        <div className="absolute bottom-6 left-5 top-6 w-2 rounded-full bg-gradient-to-b from-sky-300 via-emerald-300 via-violet-300 to-amber-300 sm:left-1/2 sm:-ml-1" />

        <div className="space-y-5">
          {visibleEvents.map((event, index) => {
            const leftSide = index % 2 === 0;

            return (
              <div
                key={event.id}
                className="relative grid gap-3 pl-16 sm:grid-cols-[1fr_72px_1fr] sm:items-center sm:pl-0"
              >
                <div className={leftSide ? "hidden sm:block" : "hidden sm:block sm:col-start-3"}>
                  {leftSide && <TimelineCard event={event} align="right" />}
                </div>

                <div className="absolute left-0 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200 sm:static sm:col-start-2 sm:mx-auto">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white ${toneSolid(event.tone)}`}>
                    {iconFor(event.type)}
                  </span>
                </div>

                <div className={leftSide ? "sm:col-start-3" : "sm:col-start-1 sm:row-start-1"}>
                  {!leftSide && <TimelineCard event={event} align="left" />}
                  <div className="sm:hidden">
                    {leftSide && <TimelineCard event={event} align="left" />}
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

function TimelineCard({
  event,
  align,
}: {
  event: Event;
  align: "left" | "right";
}) {
  return (
    <button className={`w-full rounded-[1.5rem] bg-slate-50 p-4 text-left ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md ${
      align === "right" ? "sm:text-right" : ""
    }`}>
      <div className={`flex flex-wrap items-center gap-2 ${align === "right" ? "sm:justify-end" : ""}`}>
        <p className="text-lg font-black text-slate-950">{event.title}</p>
        {event.chip && (
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${toneCard(event.tone)}`}>
            {event.chip}
          </span>
        )}
      </div>

      <p className="mt-1 text-sm font-bold leading-5 text-slate-500">
        {event.summary}
      </p>

      <div className={`mt-3 flex items-center justify-between gap-3 ${align === "right" ? "sm:flex-row-reverse" : ""}`}>
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          {event.when}
        </p>
        {event.amount && (
          <p className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-950 ring-1 ring-slate-200">
            {event.amount}
          </p>
        )}
      </div>
    </button>
  );
}

function MiniSparkline({ data, tone }: { data: number[]; tone: Tone }) {
  const points = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    return data
      .map((value, index) => {
        const x = 4 + (index / Math.max(data.length - 1, 1)) * 82;
        const y = 24 - ((value - min) / range) * 18;
        return `${x},${y}`;
      })
      .join(" ");
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
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MarketMiniChart() {
  const goyen = [160, 150, 170, 180, 220, 205, 185, 175];
  const ours = [180, 180, 180, 190, 210, 230, 230, 230];

  function points(data: number[]) {
    const min = 140;
    const max = 240;
    return data.map((value, index) => {
      const x = 4 + (index / (data.length - 1)) * 82;
      const y = 26 - ((value - min) / (max - min)) * 22;
      return `${x},${y}`;
    }).join(" ");
  }

  return (
    <svg viewBox="0 0 90 32" className="h-9 w-28 overflow-visible">
      <polyline
        points={points(goyen)}
        fill="none"
        stroke="#fb923c"
        strokeWidth="3"
        strokeDasharray="4 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={points(ours)}
        fill="none"
        stroke="#2563eb"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="86" cy="5" r="4" fill="#2563eb" />
    </svg>
  );
}

function MiniBars({ data, tone }: { data: number[]; tone: Tone }) {
  return (
    <div className="flex h-9 w-24 items-end gap-1">
      {data.map((value, index) => (
        <span
          key={index}
          className={`w-2 rounded-full ${toneSolid(tone)}`}
          style={{ height: `${Math.max(8, value)}%` }}
        />
      ))}
    </div>
  );
}

function SignalCards() {
  return (
    <section className="grid gap-3 lg:grid-cols-1">
      <article className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-violet-400">
              Trafic direct
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">+34 vues</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">single digits / jour, tendance utile</p>
          </div>
          <MiniSparkline data={[1, 1, 2, 1, 3, 4, 6]} tone="violet" />
        </div>
      </article>

      <article className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-500">
              Marché · Le Goyen
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">prix haut</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">notre prix vs tendance marché</p>
          </div>
          <MarketMiniChart />
        </div>
      </article>

      <article className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-sky-500">
              Booking pace
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">lent</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">septembre sous le rythme attendu</p>
          </div>
          <MiniBars data={[80, 72, 64, 55, 47, 38, 33]} tone="sky" />
        </div>
      </article>
    </section>
  );
}

function Occupancy({
  scope,
}: {
  scope: Scope;
}) {
  const rows = scope === "all"
    ? occupancy
    : occupancy.filter((row) => row.listingId === scope);

  return (
    <ShellCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Occupation
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {rows.length === 1 ? rows[0].label : "Table saison"}
          </h2>
        </div>
        <Link
          href="/owner/app/reservations"
          className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
        >
          Source
        </Link>
      </div>

      <MarketTension scope={scope} />

      {rows.length === 1 ? (
        <div className="mt-5 grid grid-cols-5 gap-2">
          {rows[0].values.map((value, index) => (
            <div key={months[index]} className="text-center">
              <div className="mb-2 text-[10px] font-black uppercase text-slate-400">
                {months[index]}
              </div>
              <div className="flex h-36 items-end rounded-2xl bg-slate-100 p-1">
                <div
                  className={`w-full rounded-xl ${occupancyColor(value)}`}
                  style={{ height: `${Math.max(value, 8)}%` }}
                />
              </div>
              <div className="mt-2 text-sm font-black text-slate-950">{value}%</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-2 text-xs font-black text-slate-400">
              <div />
              {months.map((month) => (
                <div key={month} className="text-center">{month}</div>
              ))}
            </div>

            <div className="mt-2 space-y-2">
              {rows.map((row) => (
                <div key={row.listingId} className="grid grid-cols-[120px_repeat(5,1fr)] gap-2">
                  <div className="truncate rounded-2xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-700">
                    {row.label}
                  </div>
                  {row.values.map((value, index) => (
                    <div
                      key={`${row.listingId}-${months[index]}`}
                      className={`rounded-2xl px-2 py-2 text-center text-sm font-black ${occupancyColor(value)}`}
                    >
                      {value}%
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ShellCard>
  );
}

function MarketTension({ scope }: { scope: Scope }) {
  const value = scope === "apt5" ? 28 : scope === "apt2" ? 42 : 72;
  const label = value >= 65 ? "forte" : value >= 40 ? "normale" : "faible";

  return (
    <div className="mt-4 rounded-[1.5rem] bg-slate-50 p-4 ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Tension marché
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">{label}</p>
        </div>
        <div className="w-40">
          <div className="relative h-3 rounded-full bg-gradient-to-r from-slate-200 via-amber-200 to-emerald-500">
            <span
              className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-slate-950 shadow-sm ring-4 ring-white"
              style={{ left: `calc(${value}% - 0.625rem)` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-black text-slate-400">
            <span>faible</span>
            <span>fort</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function occupancyColor(value: number) {
  if (value >= 85) return "bg-emerald-600 text-white";
  if (value >= 65) return "bg-emerald-300 text-emerald-950";
  if (value >= 40) return "bg-amber-200 text-amber-950";
  if (value >= 20) return "bg-orange-100 text-orange-950";
  return "bg-slate-100 text-slate-500";
}

export function OwnerDemoCockpit() {
  const [scope, setScope] = useState<Scope>("all");
  const [horizon, setHorizon] = useState<Horizon>("72h");

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-950 md:pb-8">
      <OwnerAppNav active="cockpit" />

      <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Lab UI
            </p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Owner cockpit demo
            </h1>
          </div>

          <Link
            href="/owner/app"
            className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            Retour app
          </Link>
        </div>

        <MoneyHero />
        <SmartBrief />
        <ListingCarousel scope={scope} setScope={setScope} />

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Timeline scope={scope} horizon={horizon} setHorizon={setHorizon} />

          <div className="space-y-5">
            <SignalCards />
            <Occupancy scope={scope} />
          </div>
        </section>
      </div>
    </main>
  );
}
