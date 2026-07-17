"use client";

import { useEffect, useMemo, useState } from "react";
import type { OwnerCockpitData } from "./types";

type Row = Record<string, any>;

const DAY_MS = 86_400_000;
const MARKET_COLORS = [
  "#dbe9f3", "#c8dfea", "#b5d3df", "#dce3e6", "#f0dfbd", "#ebc982", "#e9b35f",
];
const SEASON_COLORS = ["#d58b55", "#8fa7b5", "#b49aa7", "#9cab8f", "#b2a06f", "#7fa4a0"];

function iso(value: any) { return String(value || "").slice(0, 10); }
function noon(value: string) { return new Date(`${value}T12:00:00`); }
function addDays(value: string, days: number) {
  const date = noon(value); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) { return Math.round((noon(b).getTime() - noon(a).getTime()) / DAY_MS); }
function money(value: any) {
  if (value == null || value === "") return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
}
function firstName(value: any) {
  const text = String(value || "Réservation").trim();
  const first = text.split(/\s+/)[0];
  return first || "Réservation";
}
function hash(value: string) {
  let h = 0; for (let i = 0; i < value.length; i++) h = ((h << 5) - h + value.charCodeAt(i)) | 0; return Math.abs(h);
}

function marketLevel(value: number, scale: number) {
  if (Math.abs(value) < 0.15) return 3;
  const n = Math.max(-1, Math.min(1, value / scale));
  if (n <= -0.65) return 0;
  if (n <= -0.30) return 1;
  if (n < -0.08) return 2;
  if (n < 0.08) return 3;
  if (n < 0.30) return 4;
  if (n < 0.65) return 5;
  return 6;
}

export function OwnerPricingCalendar({ data, selectedListingIds }: { data: OwnerCockpitData; selectedListingIds: string[] }) {
  const available = useMemo(() => data.listings.filter((listing) => data.pricingCalendar.some((row) => row.listingId === listing.id)), [data]);
  const preferred = available.find((listing) => selectedListingIds.includes(listing.id)) || available[0];
  const [manualListingId, setManualListingId] = useState<string | null>(null);
  const listing = available.find((item) => item.id === manualListingId) || preferred;
  const listingRows = useMemo(() => data.pricingCalendar.filter((row) => row.listingId === listing?.id), [data.pricingCalendar, listing?.id]);
  const months = useMemo(() => [...new Set(listingRows.map((row) => row.date.slice(0, 7)))].sort(), [listingRows]);
  const currentMonthIndex = Math.max(0, months.findIndex((month) => month >= data.today.slice(0, 7)));
  const [monthOffset, setMonthOffset] = useState(currentMonthIndex);

  if (!listing || months.length === 0) {
    return (
      <section className="rounded-[1.7rem] bg-white p-5 shadow-[0_10px_30px_rgba(17,37,50,0.06)] ring-1 ring-[#112532]/8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E0680E]">Tarification</p>
        <h2 className="mt-1 text-3xl font-black text-[#112532]">Calendrier des prix</h2>
        <p className="mt-3 text-sm font-bold text-[#112532]/55">Aucun calendrier calculé pour les logements sélectionnés.</p>
      </section>
    );
  }

  const safeIndex = Math.max(0, Math.min(monthOffset, months.length - 1));
  const monthKey = months[safeIndex];
  const monthRows = listingRows.filter((row) => row.date.startsWith(monthKey));
  const byDate = new Map(monthRows.map((row) => [row.date, row]));
  const first = `${monthKey}-01`;
  const firstDate = noon(first);
  const leading = (firstDate.getDay() + 6) % 7;
  const nextMonth = new Date(firstDate); nextMonth.setMonth(nextMonth.getMonth() + 1);
  const last = addDays(nextMonth.toISOString().slice(0, 10), -1);
  const count = Math.ceil((leading + Number(last.slice(8))) / 7) * 7;
  const gridStart = addDays(first, -leading);
  const cells = Array.from({ length: count }, (_, index) => addDays(gridStart, index));
  const weeks = Array.from({ length: count / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  const marketValues = monthRows.map((row) => Math.abs(Number(row.marketSignalPct || 0))).filter((value) => value > 0.01).sort((a, b) => a - b);
  const p90 = marketValues.length ? marketValues[Math.min(marketValues.length - 1, Math.floor(marketValues.length * 0.9))] : 0;
  // Adaptive scale: subtle real-world changes remain visible, while outliers do not flatten the month.
  const marketScale = Math.max(3, p90 || 0);

  const seasons = data.pricingSeasons.filter((season) => season.listingId === listing.id && season.startDate <= last && season.endDate >= first);
  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const reservations = data.pricingReservations.filter((reservation) => reservation.listingId === listing.id && reservation.start < addDays(last, 1) && reservation.end > first);
  const missingCount = data.listings.filter((item) => !data.pricingCalendar.some((row) => row.listingId === item.id)).length;

  return (
    <section className="rounded-[1.7rem] bg-white p-4 shadow-[0_10px_30px_rgba(17,37,50,0.06)] ring-1 ring-[#112532]/8 sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#E0680E]">Tarification</p><h2 className="mt-1 text-3xl font-black text-[#112532]">Calendrier des prix</h2></div>
      </div>
      <p className="mt-2 text-sm font-bold text-[#112532]/55">Touchez un prix pour comprendre son calcul.</p>

      {available.length > 1 && <select value={listing.id} onChange={(e) => { setManualListingId(e.target.value); setMonthOffset(0); }} className="mt-4 w-full rounded-2xl border border-[#112532]/10 bg-white px-4 py-3 text-sm font-black text-[#112532]">
        {available.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>}

      <div className="mt-4 overflow-hidden rounded-[1.45rem] border border-[#112532]/10">
        <div className="grid grid-cols-[42px_1fr_42px] items-center gap-2 px-2 py-2">
          <button disabled={safeIndex === 0} onClick={() => setMonthOffset(Math.max(0, safeIndex - 1))} className="h-10 rounded-xl border border-[#112532]/12 disabled:opacity-25">←</button>
          <h3 className="text-center text-lg font-black capitalize">{firstDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h3>
          <button disabled={safeIndex === months.length - 1} onClick={() => setMonthOffset(Math.min(months.length - 1, safeIndex + 1))} className="h-10 rounded-xl border border-[#112532]/12 disabled:opacity-25">→</button>
        </div>
        <div className="grid grid-cols-7 border-t border-[#112532]/8">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => <div className="py-1.5 text-center text-[10px] font-black text-[#112532]/60" key={day}>{day}</div>)}</div>

        <div>
          {weeks.map((week, weekIndex) => {
            const weekStart = week[0]; const weekEnd = addDays(week[6], 1);
            const seasonSegments = seasons.flatMap((season) => {
              const start = season.startDate > weekStart ? season.startDate : weekStart;
              const endExclusive = addDays(season.endDate, 1) < weekEnd ? addDays(season.endDate, 1) : weekEnd;
              if (start >= endExclusive) return [];
              return [{
                ...season,
                left: (daysBetween(weekStart, start) / 7) * 100,
                right: 100 - (daysBetween(weekStart, endExclusive) / 7) * 100,
              }];
            });
            const segments = reservations.flatMap((reservation) => {
              const start = reservation.start > weekStart ? reservation.start : weekStart;
              const end = reservation.end < weekEnd ? reservation.end : weekEnd;
              if (start >= end) return [];
              const startIndex = daysBetween(weekStart, start);
              const endIndex = daysBetween(weekStart, end);
              return [{ ...reservation, left: ((startIndex + (start === reservation.start ? 0.5 : 0)) / 7) * 100, right: 100 - ((endIndex - (end === reservation.end ? 0.5 : 0)) / 7) * 100 }];
            });
            return <div className="relative grid h-[66px] grid-cols-7 border-t border-[#112532]/8" key={weekIndex}>
              {week.map((date) => {
                const row = byDate.get(date); const inMonth = date.startsWith(monthKey);
                const level = marketLevel(Number(row?.marketSignalPct || 0), marketScale);
                return <button type="button" disabled={!row} onClick={() => row && window.dispatchEvent(new CustomEvent("pilotys-price-detail", { detail: row }))} key={date} className={`relative min-w-0 border-r border-[#112532]/6 px-1 pt-1 text-center last:border-r-0 ${inMonth ? "bg-white" : "bg-[#F8FAFB] text-[#112532]/25"}`}>
                  <div className="relative h-4 text-[11px] font-black">{Number(date.slice(8))}</div>
                  {row && <strong className="mt-1 block text-[13px] leading-4">{money(row.finalPrice)}</strong>}
                  {row && <span className="absolute bottom-[4px] left-[5px] right-[5px] h-[5px] rounded-full" style={{ backgroundColor: MARKET_COLORS[level] }} />}
                </button>;
              })}
              <div className="pointer-events-none absolute inset-x-0 top-[19px] z-10 h-[2px]">
                {seasonSegments.map((segment) => <i key={segment.id} className="absolute h-[2px]" style={{ left: `${segment.left}%`, right: `${segment.right}%`, backgroundColor: SEASON_COLORS[hash(segment.id) % SEASON_COLORS.length] }} />)}
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-[39px] z-10 h-[18px]">
                {segments.map((segment, index) => <div key={`${segment.id}-${index}`} className="absolute h-[17px] overflow-hidden rounded-full bg-[#173d50] px-2 text-[9px] font-black leading-[17px] text-white shadow-sm" style={{ left: `${segment.left}%`, right: `${segment.right}%` }} title={`${segment.guest} · ${money(segment.total)}`}>
                  {firstName(segment.guest)} · {money(segment.total)}
                </div>)}
              </div>
            </div>;
          })}
        </div>

        <div className="space-y-2 border-t border-[#112532]/8 px-3 py-3 text-[10px]">
          {seasons.length > 0 && <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><strong className="w-14">Saisons</strong>{seasons.map((season) => <span className="flex items-center gap-2" key={season.id}><i className="h-[2px] w-6" style={{ backgroundColor: SEASON_COLORS[hash(season.id) % SEASON_COLORS.length] }} />{season.name}</span>)}</div>}
          <div className="flex items-center gap-2"><strong className="w-14 shrink-0">Marché</strong><div className="grid flex-1 grid-cols-7 gap-1">{MARKET_COLORS.map((color) => <i className="h-[5px] rounded-full" style={{ backgroundColor: color }} key={color} />)}</div></div>
          <div className="ml-16 flex justify-between text-[9px] font-bold text-[#112532]/45"><span>plus faible</span><span>normal</span><span>plus fort</span></div>
        </div>
      </div>

      {missingCount > 0 && <details className="mt-3 rounded-2xl border border-[#112532]/8 px-4 py-3 text-sm"><summary className="cursor-pointer font-black">{missingCount} logement(s) sans calendrier calculé</summary><p className="mt-2 text-[#112532]/55">Ils apparaîtront ici après leur premier calcul tarifaire.</p></details>}

      <PriceDetailDrawer />
    </section>
  );
}

function PriceDetailDrawer() {
  const [row, setRow] = useState<any>(null);
  useEffect(() => {
    const handler = (event: Event) => setRow((event as CustomEvent).detail);
    window.addEventListener("pilotys-price-detail", handler);
    return () => window.removeEventListener("pilotys-price-detail", handler);
  }, []);
  if (!row) return null;
  return <div className="fixed inset-0 z-[70] flex items-end bg-[#071821]/35" onClick={() => setRow(null)}><div className="mx-auto w-full max-w-md rounded-t-[1.8rem] bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
    <button onClick={() => setRow(null)} className="float-right text-2xl">×</button>
    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E0680E]">Pourquoi ce prix ?</p>
    <h3 className="mt-1 text-xl font-black capitalize">{noon(row.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</h3>
    <p className="mt-2 text-4xl font-black">{money(row.finalPrice)}</p>
    <div className="mt-5 space-y-3">{(row.explanationSteps || []).map((step: any, index: number) => <div className="flex items-start justify-between gap-4 border-t border-[#112532]/8 pt-3" key={index}><div><strong>{step.label}</strong><p className="mt-1 text-xs text-[#112532]/55">{step.explanation}</p></div><strong className="shrink-0">{money(step.after_eur)}</strong></div>)}</div>
  </div></div>;
}

export function OwnerJournalHeadlines({ data }: { data: OwnerCockpitData }) {
  return <section className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_10px_30px_rgba(17,37,50,0.06)] ring-1 ring-[#112532]/8">
    <div className="flex items-end justify-between p-5 pb-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#80A5B7]">Journal</p><h2 className="mt-1 text-3xl font-black text-[#112532]">Dernières décisions</h2></div><a href={`/owner/${data.owner.token}/activity`} className="text-sm font-black text-[#E0680E]">Voir tout</a></div>
    {data.journalHeadlines.length ? data.journalHeadlines.slice(0, 8).map((item) => <a href={`/owner/${data.owner.token}/activity`} key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#112532]/8 px-5 py-3 hover:bg-[#F8FAFB]"><div><strong className="text-sm">{item.headline}</strong>{item.detail && <p className="mt-1 text-xs font-bold text-[#112532]/50">{item.detail}</p>}</div><time className="text-right text-[10px] font-bold text-[#112532]/45">{new Date(item.occurredAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</time></a>) : <p className="border-t border-[#112532]/8 p-5 text-sm font-bold text-[#112532]/50">Aucune décision récente.</p>}
  </section>;
}
