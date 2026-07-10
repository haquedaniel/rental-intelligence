"use client";

function calendarDayPriceAmount(day: Row | null | undefined): number | null {
  if (!day) return null;

  const fields = [
    "price_eur",
    "daily_price_eur",
    "rate_eur",
    "recommended_price_eur",
    "public_price_eur",
    "base_price_eur",
    "available_price_eur",
    "min_price_eur",
  ];

  for (const field of fields) {
    const value = day[field];
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

function calendarDayPriceLabel(day: Row | null | undefined): string | null {
  const amount = calendarDayPriceAmount(day);
  if (!amount) return null;

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function isCalendarDayBooked(day: Row | null | undefined): boolean {
  if (!day) return false;

  return Boolean(
    day.reservation_id ||
    day.booking_id ||
    day.source_booking_id ||
    day.is_booked ||
    day.booked ||
    day.occupied ||
    day.status === "booked" ||
    day.status === "occupied",
  );
}
import { useEffect, useMemo, useState, type ReactNode } from "react";

type Tone = "navy" | "blue" | "orange" | "mustard" | "green";
type MetricId = "realised" | "gross" | "net";
type Scope = "peskerezh" | "apt4" | "apt5" | "apt2";
type TimelineKind = "arrival" | "departure" | "cleaning" | "intervention";

type Listing = {
  id: Scope;
  name: string;
  short: string;
  image: string;
  tone: Tone;
  dot: string;
  status: string;
  revenue: number;
  occupancy: number;
};

type PlanningReservation = {
  id: string;
  listingId: Scope;
  guest: string;
  start: number;
  span: number;
  price: number;
  nightly: number;
};

type PlanningMarker = {
  id: string;
  listingId: Scope;
  day: number;
  icon: string;
  tone: Tone;
  label: string;
};

type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  side: "past" | "future";
  time: string;
  listingId: Scope;
  title: string;
  detail: string;
  status?: string;
  tone: Tone;
};

const listings: Listing[] = [
  { id: "peskerezh", name: "La Peskerezh", short: "P", image: "/pilotys-assets/property-peskerezh.svg", tone: "navy", dot: "#112532", status: "Tout est à jour", revenue: 12540, occupancy: 72 },
  { id: "apt4", name: "Apt 4 · Balcon", short: "4", image: "/pilotys-assets/property-balcon.svg", tone: "orange", dot: "#E0680E", status: "2 demandes en attente", revenue: 9210, occupancy: 66 },
  { id: "apt5", name: "Apt 5 · Sous les toits", short: "5", image: "/pilotys-assets/property-attic.svg", tone: "mustard", dot: "#F4B044", status: "Planning à optimiser", revenue: 7860, occupancy: 64 },
  { id: "apt2", name: "Apt 2 · Jardin", short: "2", image: "/pilotys-assets/property-garden.svg", tone: "blue", dot: "#80A5B7", status: "Baisse d’occupation détectée", revenue: 6980, occupancy: 58 },
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
  ...Array.from({ length: 11 }, (_, i) => ({ month: "Juillet", label: `${21 + i}\n${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim", "Lun", "Mar", "Mer", "Jeu"][i]}` })),
  ...Array.from({ length: 31 }, (_, i) => ({ month: "Août", label: `${String(i + 1).padStart(2, "0")}\n${["Ven", "Sam", "Dim", "Lun", "Mar", "Mer", "Jeu"][i % 7]}` })),
  ...Array.from({ length: 8 }, (_, i) => ({ month: "Septembre", label: `${String(i + 1).padStart(2, "0")}\n${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim", "Lun"][i]}` })),
];

const monthSpans = [
  { month: "Juillet", start: 1, span: 11 },
  { month: "Août", start: 12, span: 31 },
  { month: "Septembre", start: 43, span: 8 },
];

const marketTension = planningDays.map((_, index) => {
  const wave = Math.sin((index - 5) / 4) * 0.22 + Math.sin(index / 9) * 0.18;
  const season = index > 10 && index < 38 ? 0.62 : index >= 38 ? 0.42 : 0.36;
  return Math.max(0.16, Math.min(0.98, season + wave));
});

const planningReservations: PlanningReservation[] = [
  { id: "stay-pesk-1", listingId: "peskerezh", guest: "Durand", start: 2, span: 4, price: 640, nightly: 160 },
  { id: "stay-pesk-2", listingId: "peskerezh", guest: "Leroy", start: 17, span: 7, price: 1470, nightly: 210 },
  { id: "stay-pesk-3", listingId: "peskerezh", guest: "Olsen", start: 35, span: 9, price: 1980, nightly: 220 },
  { id: "stay-apt4-1", listingId: "apt4", guest: "Leroy", start: 3, span: 5, price: 750, nightly: 150 },
  { id: "stay-apt4-2", listingId: "apt4", guest: "Mathis", start: 12, span: 3, price: 540, nightly: 180 },
  { id: "stay-apt4-3", listingId: "apt4", guest: "Claire", start: 25, span: 6, price: 1080, nightly: 180 },
  { id: "stay-apt5-1", listingId: "apt5", guest: "Petit", start: 3, span: 3, price: 390, nightly: 130 },
  { id: "stay-apt5-2", listingId: "apt5", guest: "Bernard", start: 9, span: 6, price: 900, nightly: 150 },
  { id: "stay-apt5-3", listingId: "apt5", guest: "Simon", start: 41, span: 5, price: 625, nightly: 125 },
  { id: "stay-apt2-1", listingId: "apt2", guest: "Roux", start: 2, span: 4, price: 520, nightly: 130 },
  { id: "stay-apt2-2", listingId: "apt2", guest: "Dupont", start: 14, span: 4, price: 560, nightly: 140 },
  { id: "stay-apt2-3", listingId: "apt2", guest: "Martin", start: 30, span: 8, price: 1120, nightly: 140 },
];

const planningMarkers: PlanningMarker[] = [
  { id: "clean-pesk", listingId: "peskerezh", day: 6, icon: "✦", tone: "mustard", label: "ménage" },
  { id: "clean-pesk-2", listingId: "peskerezh", day: 24, icon: "✦", tone: "mustard", label: "ménage" },
  { id: "clean-apt4", listingId: "apt4", day: 8, icon: "✦", tone: "mustard", label: "ménage" },
  { id: "interv-apt4", listingId: "apt4", day: 31, icon: "↗", tone: "orange", label: "intervention" },
  { id: "alert-apt5", listingId: "apt5", day: 6, icon: "!", tone: "orange", label: "alerte" },
  { id: "clean-apt5", listingId: "apt5", day: 15, icon: "✦", tone: "mustard", label: "ménage" },
  { id: "clean-apt2", listingId: "apt2", day: 7, icon: "✦", tone: "mustard", label: "ménage" },
  { id: "interv-apt2", listingId: "apt2", day: 18, icon: "↗", tone: "orange", label: "intervention" },
];

const timelineEvents: TimelineEvent[] = [
  { id: "p1", side: "past", kind: "cleaning", time: "Hier 16:08", listingId: "apt5", title: "Ménage terminé", detail: "Photos et rapport disponibles", status: "rapport", tone: "blue" },
  { id: "p2", side: "past", kind: "departure", time: "Hier 10:00", listingId: "peskerezh", title: "Départ", detail: "Famille Leroy", tone: "navy" },
  { id: "p3", side: "past", kind: "intervention", time: "Lun 14:30", listingId: "apt2", title: "Intervention jardin", detail: "Terminée · 4 photos", status: "terminée", tone: "blue" },
  { id: "p4", side: "past", kind: "arrival", time: "Dim 17:00", listingId: "apt4", title: "Arrivée", detail: "Claire Martin", tone: "orange" },
  { id: "f1", side: "future", kind: "departure", time: "Aujourd’hui 10:00", listingId: "apt4", title: "Départ", detail: "Rotation serrée", tone: "orange" },
  { id: "f2", side: "future", kind: "cleaning", time: "Aujourd’hui 11:00", listingId: "apt4", title: "Ménage accepté", detail: "Sandrine · rapport attendu", status: "accepté", tone: "mustard" },
  { id: "f3", side: "future", kind: "arrival", time: "Aujourd’hui 17:00", listingId: "apt4", title: "Arrivée", detail: "Voyageurs attendus", tone: "orange" },
  { id: "f4", side: "future", kind: "intervention", time: "Demain 09:00", listingId: "apt5", title: "Peinture", detail: "Intervenant à confirmer", status: "à confirmer", tone: "orange" },
];

const opportunities = [
  { id: "gap-apt2", title: "Remplir un trou", listing: "Apt 2 · Jardin", period: "15–20 juillet · 5 nuits", potential: 620, action: "Agir maintenant", tone: "orange" as Tone },
  { id: "raise-apt5", title: "Derniers jours d’août", listing: "Apt 5 · Sous les toits", period: "27–31 août · 4 nuits", potential: 540, action: "Voir les tarifs", tone: "mustard" as Tone },
  { id: "direct-pesk", title: "Relancer le direct", listing: "La Peskerezh", period: "trafic en hausse · 34 vues", potential: 410, action: "Préparer l’offre", tone: "blue" as Tone },
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

function listingById(id: Scope) {
  return listings.find((listing) => listing.id === id)!;
}

function tensionColor(value: number) {
  if (value > 0.72) return "bg-[#E0680E]";
  if (value > 0.52) return "bg-[#F4B044]";
  return "bg-[#80A5B7]";
}

function dailyPrice(dayIndex: number, listingId: Scope) {
  const base: Record<Scope, number> = { peskerezh: 190, apt4: 145, apt5: 120, apt2: 125 };
  const tension = marketTension[dayIndex - 1] ?? 0.45;
  return Math.round((base[listingId] * (0.84 + tension * 0.42)) / 5) * 5;
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

function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#112532]/8 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <PilotysMark />
        <div className="flex items-center gap-2">
          <button className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F8FA] text-[#112532] ring-1 ring-[#112532]/8">
            ◴
            <span className="absolute -right-0.5 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#E0680E] px-1 text-xs font-black text-white">2</span>
          </button>
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-black text-[#112532] ring-1 ring-[#112532]/10">≡</button>
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
        <MetricButton active={metric === "gross"} onClick={() => setMetric("gross")} label="CA brut annuel" value={formatMoney(gross)} delta="↑ 12 %" tone="blue" />
        <MetricButton active={metric === "net"} onClick={() => setMetric("net")} label="Après variables" value={formatMoney(net)} delta="↑ 9 %" tone="mustard" />
      </div>

      <MetricPanel metric={metric} />
    </section>
  );
}

function MetricButton({ active, onClick, label, value, delta, tone }: { active: boolean; onClick: () => void; label: string; value: string; delta: string; tone: Tone }) {
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
      <p className="relative mt-5 text-sm font-black text-emerald-500">vs N-1 · {delta}</p>
    </button>
  );
}

function MetricPanel({ metric }: { metric: MetricId }) {
  if (metric === "gross") {
    const rows = [
      { label: "La Peskerezh", value: 10480, width: 84, tone: "navy" as Tone },
      { label: "Apt 4 · Balcon", value: 6480, width: 52, tone: "orange" as Tone },
      { label: "Apt 5 · Sous les toits", value: 4320, width: 35, tone: "mustard" as Tone },
      { label: "Apt 2 · Jardin", value: 3580, width: 29, tone: "blue" as Tone },
    ];
    return (
      <ShellCard className="overflow-hidden p-5 sm:p-6">
        <h2 className="text-3xl font-black tracking-tight text-[#112532]">CA brut par logement</h2>
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
        <h2 className="text-3xl font-black tracking-tight text-[#112532]">Après variables</h2>
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

  return <MonthlyRevenueChart />;
}

function MonthlyRevenueChart() {
  const max = Math.max(...monthlyRevenue.map((row) => row.realised + row.future));
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
          {monthlyRevenue.map((row) => {
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

function SmartBrief() {
  return (
    <ShellCard className="overflow-hidden p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF6EF] text-xl text-[#E0680E] ring-1 ring-[#E0680E]/14">✦</span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">À retenir</p>
          <p className="mt-2 text-xl font-black leading-8 text-[#112532] sm:text-2xl">
            Valider le paiement de Sandrine. <span className="text-[#E0680E]">Baisse modérée</span> à tester sur Apt 2.
          </p>
        </div>
      </div>
    </ShellCard>
  );
}

function PropertySelector({ selected, setSelected }: { selected: Scope[]; setSelected: (next: Scope[]) => void }) {
  function toggle(id: Scope) {
    if (selected.includes(id)) {
      if (selected.length > 1) setSelected(selected.filter((item) => item !== id));
      return;
    }
    setSelected([...selected, id]);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">Logements</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-[#112532]">Sélection</h2>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex gap-3">
          {listings.map((listing) => {
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
                  <img src={listing.image} alt="" className="h-full w-full object-cover" />
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

function Planning({ selected }: { selected: Scope[] }) {
  const selectedListings = listings.filter((listing) => selected.includes(listing.id));
  const dayWidth = "3.35rem";

  const reservationsByListing = useMemo(() => {
    const covered = new Map<string, Set<number>>();
    for (const listing of listings) covered.set(listing.id, new Set<number>());
    for (const reservation of planningReservations) {
      const set = covered.get(reservation.listingId)!;
      for (let day = reservation.start; day < reservation.start + reservation.span; day++) set.add(day);
    }
    return covered;
  }, []);

  return (
    <ShellCard className="overflow-hidden">
      <div className="border-b border-[#112532]/8 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">Planning</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-[#112532]">Réservations & missions</h2>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-black text-[#112532]/60">
            {selectedListings.map((listing) => (
              <span key={listing.id} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: listing.dot }} />
                {listing.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto p-4">
        <div className="min-w-[1760px] relative">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
            {monthSpans.map((span) => (
              <div key={span.month} className="rounded-full bg-[#F4F8FA] px-4 py-1.5 text-sm font-black text-[#477084]" style={{ gridColumn: `${span.start} / span ${span.span}` }}>
                {span.month}
              </div>
            ))}
          </div>

          <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
            {planningDays.map((day, index) => (
              <div key={`${day.month}-${index}`} className="whitespace-pre-line rounded-2xl bg-[#F4F8FA] px-1.5 py-1.5 text-center text-[10px] font-black leading-4 text-[#112532]/58 ring-1 ring-[#112532]/5">
                {day.label}
                  {!isCalendarDayBooked(day) && calendarDayPriceLabel(day) ? (
                    <span
                      title="Prix jour libre"
                      className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-black text-[#112532]/38 ring-1 ring-[#112532]/5"
                    >
                      {calendarDayPriceLabel(day)}
                    </span>
                  ) : null}

              </div>
            ))}
          </div>

          <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
            {marketTension.map((value, index) => (
              <div key={`tension-${index}`} className={`h-4 rounded-full ${tensionColor(value)}`} style={{ opacity: 0.18 + value * 0.38 }} />
            ))}
          </div>

          {selectedListings.map((listing) => {
            const rowReservations = planningReservations.filter((reservation) => reservation.listingId === listing.id);
            const rowMarkers = planningMarkers.filter((marker) => marker.listingId === listing.id);
            const coveredDays = reservationsByListing.get(listing.id)!;

            return (
              <div key={listing.id} className="relative mt-2 h-[68px] rounded-2xl bg-[#F4F8FA]/70">
                <div className="absolute inset-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
                  {planningDays.map((_, index) => {
                    const day = index + 1;
                    const covered = coveredDays.has(day);
                    return (
                      <div key={`${listing.id}-price-${day}`} className="flex items-end justify-center rounded-xl bg-white/88 pb-1">
                        {!covered ? <span className="text-[10px] font-black text-[#112532]/28">{dailyPrice(day, listing.id)}€</span> : null}
                      </div>
                    );
                  })}
                </div>

                <div className="absolute inset-x-2 top-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
                  {rowReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="h-10 rounded-2xl px-3 text-left text-white shadow-sm ring-1 ring-white/55"
                      style={{ gridColumn: `${reservation.start} / span ${reservation.span}`, backgroundColor: listing.dot }}
                    >
                      <p className="truncate text-sm font-black leading-5">{reservation.guest} · {formatMoney(reservation.price)}</p>
                      <p className="truncate text-[11px] font-bold text-white/72">{reservation.span} nuits · {reservation.nightly}€/nuit</p>
                    </div>
                  ))}
                </div>

                <div className="absolute inset-x-2 bottom-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${planningDays.length}, ${dayWidth})` }}>
                  {rowMarkers.map((marker) => (
                    <div
                      key={marker.id}
                      title={marker.label}
                      className={`flex h-7 w-7 items-center justify-center justify-self-center rounded-full text-[11px] font-black text-white shadow-md ring-4 ring-white ${toneSolid(marker.tone)}`}
                      style={{ gridColumn: `${marker.day} / span 1` }}
                    >
                      {marker.icon}
                    </div>
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

function TimelineBrowser() {
  const past = timelineEvents.filter((event) => event.side === "past");
  const future = timelineEvents.filter((event) => event.side === "future");

  return (
    <ShellCard className="overflow-hidden p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">Activité</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-[#112532]">Timeline</h2>
      </div>

      <div className="relative mt-5 max-h-[34rem] overflow-y-auto pr-1">
        <div className="absolute bottom-0 left-[1.18rem] top-0 w-0.5 rounded-full bg-[#D8E6EC]" />

        <div className="space-y-3 pb-4">
          {past.map((event) => <TimelineRow key={event.id} event={event} muted />)}
        </div>

        <div className="relative my-4 flex items-center gap-3">
          <span className="z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#112532] text-xs font-black text-white ring-4 ring-white">auj.</span>
          <div className="h-px flex-1 bg-[#112532]/12" />
          <span className="rounded-full bg-[#112532]/6 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#112532]/55">Aujourd’hui</span>
        </div>

        <div className="space-y-3 pt-1">
          {future.map((event) => <TimelineRow key={event.id} event={event} />)}
        </div>
      </div>
    </ShellCard>
  );
}

function TimelineRow({ event, muted = false }: { event: TimelineEvent; muted?: boolean }) {
  const listing = listingById(event.listingId);
  const icon = event.kind === "arrival" ? "→" : event.kind === "departure" ? "↗" : event.kind === "cleaning" ? "✦" : "◆";

  return (
    <button className={`relative grid w-full grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl px-0 py-2 text-left transition hover:bg-[#F4F8FA] ${muted ? "opacity-72" : ""}`}>
      <span className={`z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white shadow-sm ring-4 ring-white ${toneSolid(event.tone)}`}>{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: listing.dot }} />
          <span className="truncate text-base font-black text-[#112532]">{event.title}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold text-[#112532]/55">{listing.name} · {event.detail}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs font-bold text-[#112532]/50">{event.time}</span>
        {event.status ? <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${toneSoft(event.tone)}`}>{event.status}</span> : null}
      </span>
    </button>
  );
}

function Opportunities() {
  return (
    <ShellCard className="overflow-hidden p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">Opportunités</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-[#112532]">À tester</h2>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {opportunities.map((item) => (
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

export function OwnerDemoCockpit() {
  const [selected, setSelected] = useState<Scope[]>(["peskerezh", "apt4", "apt5", "apt2"]);

  return (
    <main className="min-h-screen bg-[#F4F8FA] pb-28 text-[#112532] xl:pb-10">
      <TopNav />

      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <MoneyHero />
        <SmartBrief />
        <PropertySelector selected={selected} setSelected={setSelected} />
        <Planning selected={selected} />

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <TimelineBrowser />
          <Opportunities />
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

export default OwnerDemoCockpit;
