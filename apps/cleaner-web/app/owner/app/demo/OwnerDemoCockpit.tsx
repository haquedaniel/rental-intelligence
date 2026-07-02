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
  const configs = {
    realised: {
      title: "Lecture du réalisé",
      intro: "Séjours terminés + prorata des séjours actuellement occupés.",
      lines: [
        ["Séjours terminés", 78, "7 840 €", "emerald"],
        ["Séjours en cours", 6, "586 €", "sky"],
        ["Aujourd’hui", 3, "+42 €", "violet"],
      ],
    },
    gross: {
      title: "CA brut annuel",
      intro: "Réservations confirmées, annulations exclues.",
      lines: [
        ["Airbnb", 52, "12 940 €", "sky"],
        ["Direct", 18, "4 480 €", "emerald"],
        ["Booking", 26, "6 460 €", "violet"],
        ["Autres", 4, "980 €", "slate"],
      ],
    },
    net: {
      title: "Après variables",
      intro: "Vue rapide des principaux coûts variables avant analyse complète.",
      lines: [
        ["CA brut", 100, "24 860 €", "emerald"],
        ["Ménage", 14, "-3 240 €", "amber"],
        ["Commissions", 6, "-1 120 €", "sky"],
        ["Interventions", 3, "-430 €", "violet"],
        ["Linge / autres", 4, "-650 €", "slate"],
        ["Après variables", 74, "18 420 €", "emerald"],
      ],
    },
  }[metric];

  return (
    <div className="mt-4 rounded-[1.75rem] bg-white/8 p-4 ring-1 ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">{configs.title}</p>
          <p className="mt-1 text-xs font-bold text-white/45">{configs.intro}</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
          détail
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {configs.lines.map(([label, width, value, tone]) => (
          <div key={label} className="grid grid-cols-[96px_1fr_76px] items-center gap-2 text-xs font-black sm:grid-cols-[130px_1fr_90px]">
            <span className="truncate text-white/55">{label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${toneSolid(tone as Tone)}`}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="text-right text-white">{value}</span>
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
          Vous devez valider la demande de paiement de Sandrine aujourd’hui.
          Apt 2 est lent du 15 au 20 juillet : vu le marché, une baisse de prix modérée semble pertinente.
        </p>

        <div className="relative mt-5 flex flex-wrap gap-2">
          <Link
            href="/owner/payments"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
          >
            Valider paiement
          </Link>
          <button className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-900 ring-1 ring-amber-100">
            Voir prix Apt 2
          </button>
          <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
            Pourquoi ?
          </button>
        </div>
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
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
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
          className={`min-w-[74%] snap-start overflow-hidden rounded-[2rem] p-4 text-left shadow-sm ring-1 transition sm:min-w-[320px] ${
            scope === "all"
              ? "bg-slate-950 text-white ring-slate-950"
              : "bg-white text-slate-950 ring-slate-200"
          }`}
        >
          <div className="flex h-44 flex-col justify-between rounded-[1.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 p-4 text-white">
            <div className="flex justify-between">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">
                tous
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
            className={`min-w-[74%] snap-start overflow-hidden rounded-[2rem] bg-white p-3 text-left shadow-sm ring-1 transition hover:-translate-y-0.5 sm:min-w-[320px] ${
              scope === listing.id ? "ring-4 ring-slate-950" : "ring-slate-200"
            }`}
          >
            <div
              className="relative flex h-44 flex-col justify-between overflow-hidden rounded-[1.5rem] p-4 text-white"
              style={{ backgroundImage: listing.gradient }}
            >
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
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
              <div className="max-w-[130px] rounded-2xl bg-slate-50 px-3 py-2 text-right text-xs font-black text-slate-500">
                {listing.next}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
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

  const grouped = visibleEvents.reduce<Record<string, Event[]>>((acc, event) => {
    acc[event.day] = acc[event.day] || [];
    acc[event.day].push(event);
    return acc;
  }, {});

  return (
    <ShellCard className="overflow-hidden p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Timeline
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Ce qui vient de se passer / ce qui arrive
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

      <div className="mt-5 space-y-6">
        {Object.entries(grouped).map(([day, items]) => (
          <div key={day} className="grid gap-3 sm:grid-cols-[82px_1fr]">
            <p className="pt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
              {day}
            </p>

            <div className="relative space-y-3 pl-6">
              <div className="absolute bottom-4 left-[0.55rem] top-4 w-1 rounded-full bg-slate-100" />

              {items.map((event) => (
                <button
                  key={event.id}
                  className="group relative block w-full rounded-[1.5rem] bg-slate-50 p-4 text-left ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                >
                  <span
                    className={`absolute -left-[1.37rem] top-5 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white shadow-lg ring-4 ring-white ${toneSolid(event.tone)}`}
                  >
                    {iconFor(event.type)}
                  </span>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
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
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                      <p className="text-xs font-black text-slate-400">{event.when}</p>
                      {event.amount && (
                        <p className="mt-1 text-base font-black text-slate-950">
                          {event.amount}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}

function Sparkline({ data, tone }: { data: number[]; tone: Tone }) {
  const points = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    return data
      .map((value, index) => {
        const x = (index / Math.max(data.length - 1, 1)) * 100;
        const y = 34 - ((value - min) / range) * 28;
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
    <svg viewBox="0 0 100 40" className="h-12 w-full overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="100" cy={points.split(" ").at(-1)?.split(",")[1] ?? 20} r="4" fill={color} />
    </svg>
  );
}

function SignalCards() {
  return (
    <section className="grid gap-3 lg:grid-cols-3">
      {signals.map((signal) => (
        <article
          key={signal.id}
          className={`overflow-hidden rounded-[1.75rem] p-4 shadow-sm ring-1 ${toneCard(signal.tone)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide opacity-55">
                {signal.title}
              </p>
              <h3 className="mt-1 text-2xl font-black">{signal.value}</h3>
            </div>
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black ring-1 ring-black/5">
              signal
            </span>
          </div>

          <div className="mt-3">
            <Sparkline data={signal.data} tone={signal.tone} />
          </div>

          <p className="mt-2 text-sm font-bold leading-5 opacity-65">{signal.detail}</p>
        </article>
      ))}
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

  if (rows.length === 1) {
    const row = rows[0];

    return (
      <ShellCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Occupation
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{row.label}</h2>
          </div>
          <Link
            href="/owner/app/reservations"
            className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
          >
            Réservations
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2">
          {row.values.map((value, index) => (
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
      </ShellCard>
    );
  }

  return (
    <ShellCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Occupation
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Table saison</h2>
        </div>
        <Link
          href="/owner/app/reservations"
          className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
        >
          Source
        </Link>
      </div>

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
    </ShellCard>
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
