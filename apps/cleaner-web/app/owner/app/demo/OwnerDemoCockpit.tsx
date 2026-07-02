"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OwnerAppNav } from "@/components/owner-app/OwnerAppNav";

type Tone = "slate" | "emerald" | "sky" | "amber" | "violet" | "red";

type Property = {
  id: string;
  name: string;
  short: string;
  tone: Tone;
  status: string;
  money: string;
  detail: string;
  pulse?: boolean;
};

type Event = {
  id: string;
  when: string;
  type: "reservation" | "cleaning" | "report" | "intervention" | "payment" | "signal" | "stay";
  title: string;
  property: string;
  summary: string;
  money?: string;
  chip?: string;
  tone: Tone;
  side: "past" | "now" | "future";
};

type Signal = {
  id: string;
  title: string;
  body: string;
  tone: Tone;
  value?: string;
};

const properties: Property[] = [
  {
    id: "peskerezh",
    name: "La Peskerezh",
    short: "P",
    tone: "emerald",
    status: "Séjour en cours",
    money: "2 184 €",
    detail: "rapport OK · ménage couvert",
    pulse: true,
  },
  {
    id: "apt4",
    name: "Apt 4 · Balcon",
    short: "4",
    tone: "sky",
    status: "Arrivée demain",
    money: "684 €",
    detail: "ménage confirmé",
  },
  {
    id: "apt5",
    name: "Apt 5 · Sous les toits",
    short: "5",
    tone: "amber",
    status: "Semaine faible",
    money: "0 €",
    detail: "signal prix à regarder",
  },
  {
    id: "apt2",
    name: "Apt 2 · Jardin",
    short: "2",
    tone: "violet",
    status: "Intervention terminée",
    money: "412 €",
    detail: "photos reçues",
  },
];

const events: Event[] = [
  {
    id: "e1",
    when: "Hier 17:42",
    type: "reservation",
    title: "Nouvelle réservation",
    property: "Apt 4",
    summary: "12–16 août · 4 nuits · Airbnb",
    money: "+684 €",
    chip: "nouveau",
    tone: "sky",
    side: "past",
  },
  {
    id: "e2",
    when: "Hier 16:08",
    type: "report",
    title: "Rapport ménage reçu",
    property: "Apt 2",
    summary: "6 photos · aucun problème · prêt voyageurs",
    money: "54 € coût",
    chip: "rassurant",
    tone: "emerald",
    side: "past",
  },
  {
    id: "e3",
    when: "Maintenant",
    type: "stay",
    title: "Séjour en cours",
    property: "La Peskerezh",
    summary: "Le CA réalisé progresse au fil du séjour",
    money: "en direct",
    chip: "occupé",
    tone: "emerald",
    side: "now",
  },
  {
    id: "e4",
    when: "Aujourd’hui 15:00",
    type: "intervention",
    title: "Intervention terminée",
    property: "Apt 2",
    summary: "Jardin · 2h · frais matériel 18 €",
    money: "98 €",
    chip: "rapport reçu",
    tone: "violet",
    side: "now",
  },
  {
    id: "e5",
    when: "Demain 11:00",
    type: "cleaning",
    title: "Ménage confirmé",
    property: "Apt 4",
    summary: "Départ 10h · arrivée prévue 17h",
    money: "marge OK",
    chip: "couvert",
    tone: "emerald",
    side: "future",
  },
  {
    id: "e6",
    when: "Vendredi",
    type: "payment",
    title: "Demande de paiement",
    property: "Sandrine",
    summary: "Missions de juin · en attente validation",
    money: "420 €",
    chip: "à régler",
    tone: "amber",
    side: "future",
  },
  {
    id: "e7",
    when: "Semaine prochaine",
    type: "signal",
    title: "Signal prix",
    property: "Apt 5",
    summary: "Occupation en retard sur la période 8–11 juillet",
    money: "-8 % ?",
    chip: "opportunité",
    tone: "amber",
    side: "future",
  },
];

const signals: Signal[] = [
  {
    id: "s1",
    title: "Tout est couvert pour 72h",
    body: "3 départs, 3 ménages confirmés, aucune mission refusée, aucun rapport problématique.",
    tone: "emerald",
    value: "OK",
  },
  {
    id: "s2",
    title: "Septembre mérite attention",
    body: "Apt 5 est en retard d’occupation, mais le trafic direct progresse sur les pages logement.",
    tone: "amber",
    value: "à suivre",
  },
];

const occupancy = [
  { property: "Peskerezh", values: [64, 92, 96, 58, 34] },
  { property: "Apt 4", values: [42, 76, 88, 36, 18] },
  { property: "Apt 5", values: [38, 66, 72, 22, 12] },
  { property: "Apt 2", values: [48, 71, 81, 40, 20] },
];

const months = ["Juin", "Juil", "Août", "Sept", "Oct"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function toneDot(tone: Tone) {
  const classes: Record<Tone, string> = {
    slate: "bg-slate-400",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    red: "bg-red-500",
  };

  return classes[tone];
}

function toneCard(tone: Tone) {
  const classes: Record<Tone, string> = {
    slate: "bg-white text-slate-950 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-950 ring-emerald-100",
    sky: "bg-sky-50 text-sky-950 ring-sky-100",
    amber: "bg-amber-50 text-amber-950 ring-amber-100",
    violet: "bg-violet-50 text-violet-950 ring-violet-100",
    red: "bg-red-50 text-red-950 ring-red-100",
  };

  return classes[tone];
}

function eventIcon(type: Event["type"]) {
  return {
    reservation: "＋",
    cleaning: "✓",
    report: "◎",
    intervention: "◆",
    payment: "€",
    signal: "!",
    stay: "●",
  }[type];
}

function occupancyClass(value: number) {
  if (value >= 85) return "bg-emerald-600 text-white";
  if (value >= 65) return "bg-emerald-300 text-emerald-950";
  if (value >= 40) return "bg-amber-200 text-amber-950";
  if (value >= 20) return "bg-orange-100 text-orange-950";
  return "bg-slate-100 text-slate-500";
}

function MoneyHero() {
  const base = 8426.37;
  const perSecond = 0.0068;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();

    const interval = window.setInterval(() => {
      setElapsed((Date.now() - started) / 1000);
    }, 700);

    return () => window.clearInterval(interval);
  }, []);

  const realised = base + elapsed * perSecond;

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-sm sm:p-7">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -bottom-32 left-20 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/40">
            Argent réalisé
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
              {formatMoney(realised)}
            </h1>
            <span className="mb-2 rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-black text-emerald-200 ring-1 ring-emerald-300/20">
              live
            </span>
          </div>

          <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-white/65">
            Le réalisé avance au prorata des séjours en cours. Pas besoin d’afficher le taux horaire : le mouvement suffit à donner la sensation que la machine tourne.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-3xl bg-white p-4 text-slate-950">
            <p className="text-[10px] font-black uppercase text-slate-400">Depuis hier</p>
            <p className="mt-2 text-2xl font-black">+420 €</p>
          </div>

          <div className="rounded-3xl bg-white/10 p-4">
            <p className="text-[10px] font-black uppercase text-white/40">Prévu</p>
            <p className="mt-2 text-2xl font-black">14,2k</p>
          </div>

          <div className="rounded-3xl bg-white/10 p-4">
            <p className="text-[10px] font-black uppercase text-white/40">Direct</p>
            <p className="mt-2 text-2xl font-black">2</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PulseStrip() {
  const items = [
    ["4 logements", "couverts", "emerald"],
    ["2 séjours", "en cours", "sky"],
    ["3 ménages", "confirmés", "emerald"],
    ["1 paiement", "à traiter", "amber"],
    ["34 vues", "site direct", "violet"],
  ] as const;

  return (
    <section className="flex gap-2 overflow-x-auto pb-1">
      {items.map(([top, bottom, tone]) => (
        <button
          key={`${top}-${bottom}`}
          className={`shrink-0 rounded-full px-4 py-3 text-left text-xs font-black shadow-sm ring-1 ${toneCard(tone)}`}
        >
          <span className="block">{top}</span>
          <span className="block opacity-55">{bottom}</span>
        </button>
      ))}
    </section>
  );
}

function SituationCards() {
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {signals.map((signal) => (
        <article
          key={signal.id}
          className={`rounded-[1.75rem] p-5 shadow-sm ring-1 ${toneCard(signal.tone)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide opacity-55">
                À retenir
              </p>
              <h2 className="mt-2 text-xl font-black">{signal.title}</h2>
            </div>
            {signal.value && (
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black ring-1 ring-black/5">
                {signal.value}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm font-bold leading-6 opacity-70">{signal.body}</p>
          <button className="mt-4 rounded-full bg-white/70 px-4 py-2 text-xs font-black ring-1 ring-black/5">
            Pourquoi ?
          </button>
        </article>
      ))}
    </section>
  );
}

function PropertyOrbs() {
  return (
    <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Logements
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Vue flotte</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
          cliquer = filtrer
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {properties.map((property) => (
          <button
            key={property.id}
            className={`group rounded-[1.75rem] p-4 text-left shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${toneCard(property.tone)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-black shadow-sm ring-1 ring-black/5">
                {property.pulse && (
                  <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-400/30" />
                )}
                <span className="relative">{property.short}</span>
              </span>
              <span className={`mt-1 h-3 w-3 rounded-full ${toneDot(property.tone)}`} />
            </div>

            <p className="mt-4 truncate text-sm font-black">{property.name}</p>
            <p className="mt-1 text-xs font-bold opacity-60">{property.status}</p>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-xl font-black">{property.money}</p>
              <p className="text-right text-[11px] font-bold opacity-55">{property.detail}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function EventRiver() {
  const groups = [
    { key: "past", label: "Récemment", events: events.filter((event) => event.side === "past") },
    { key: "now", label: "Maintenant", events: events.filter((event) => event.side === "now") },
    { key: "future", label: "À venir", events: events.filter((event) => event.side === "future") },
  ];

  return (
    <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Flux opérationnel
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            L’histoire du business
          </h2>
        </div>

        <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-xs font-black text-slate-500">
          <button className="rounded-full bg-white px-3 py-1.5 shadow-sm">72h</button>
          <button className="px-3 py-1.5">7j</button>
          <button className="px-3 py-1.5">Saison</button>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
              {group.label}
            </p>

            <div className="relative space-y-3 pl-5">
              <div className="absolute bottom-3 left-[0.42rem] top-3 w-0.5 rounded-full bg-slate-100" />

              {group.events.map((event) => (
                <button
                  key={event.id}
                  className="group relative block w-full rounded-[1.5rem] bg-slate-50 p-4 text-left ring-1 ring-slate-100 transition hover:bg-white hover:shadow-sm"
                >
                  <span
                    className={`absolute -left-[1.15rem] top-5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white shadow-sm ${toneDot(event.tone)}`}
                  >
                    {eventIcon(event.type)}
                  </span>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-950">{event.title}</p>
                        {event.chip && (
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${toneCard(event.tone)}`}>
                            {event.chip}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {event.property} · {event.summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                      <p className="text-xs font-black text-slate-400">{event.when}</p>
                      {event.money && (
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {event.money}
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
    </section>
  );
}

function OccupancyHeatmap() {
  return (
    <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Signaux
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Occupation
          </h2>
        </div>
        <Link href="/owner/app/reservations" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
          Source
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[130px_repeat(5,1fr)] gap-2 text-xs font-black text-slate-400">
            <div />
            {months.map((month) => (
              <div key={month} className="text-center">{month}</div>
            ))}
          </div>

          <div className="mt-2 space-y-2">
            {occupancy.map((row) => (
              <div key={row.property} className="grid grid-cols-[130px_repeat(5,1fr)] gap-2">
                <div className="truncate rounded-2xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-700">
                  {row.property}
                </div>

                {row.values.map((value, index) => (
                  <div
                    key={`${row.property}-${months[index]}`}
                    className={`rounded-2xl px-2 py-2 text-center text-sm font-black ${occupancyClass(value)}`}
                  >
                    {value}%
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-500">
        Plus tard : relier cette table aux signaux de prix, booking pace, trafic direct et marge.
      </p>
    </section>
  );
}

function SignalDeck() {
  const items = [
    {
      title: "Trafic direct",
      value: "+34 vues",
      detail: "les pages logement progressent cette semaine",
      tone: "violet" as Tone,
    },
    {
      title: "Commissions évitées",
      value: "96 €",
      detail: "grâce aux réservations directes",
      tone: "emerald" as Tone,
    },
    {
      title: "Marge courte durée",
      value: "à surveiller",
      detail: "Apt 2 : le ménage pèse sur les courts séjours",
      tone: "amber" as Tone,
    },
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className={`rounded-[1.75rem] p-5 shadow-sm ring-1 ${toneCard(item.tone)}`}
        >
          <p className="text-[10px] font-black uppercase tracking-wide opacity-55">
            {item.title}
          </p>
          <h3 className="mt-2 text-2xl font-black">{item.value}</h3>
          <p className="mt-2 text-sm font-bold leading-5 opacity-65">{item.detail}</p>
        </article>
      ))}
    </section>
  );
}

export function OwnerDemoCockpit() {
  const [showIntro, setShowIntro] = useState(true);

  const introText = useMemo(
    () => [
      "+420 € depuis votre dernière visite",
      "2 rapports reçus",
      "0 problème critique",
    ],
    [],
  );

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-950 md:pb-8">
      <OwnerAppNav active="cockpit" />

      {showIntro && (
        <button
          onClick={() => setShowIntro(false)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-5 text-left text-white backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Depuis votre dernière visite
            </p>
            <div className="mt-5 space-y-3">
              {introText.map((line, index) => (
                <div
                  key={line}
                  className="rounded-2xl bg-slate-50 p-4 text-xl font-black"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  {line}
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm font-bold text-slate-500">
              Cliquer pour ouvrir le cockpit.
            </p>
          </div>
        </button>
      )}

      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Lab UI
            </p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Owner cockpit demo
            </h1>
          </div>

          <div className="flex gap-2">
            <Link
              href="/owner/app"
              className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200"
            >
              Retour app
            </Link>
            <button
              onClick={() => setShowIntro(true)}
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
            >
              Rejouer l’ouverture
            </button>
          </div>
        </div>

        <MoneyHero />
        <PulseStrip />
        <SituationCards />

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <PropertyOrbs />
          <EventRiver />
        </section>

        <SignalDeck />
        <OccupancyHeatmap />
      </div>
    </main>
  );
}
