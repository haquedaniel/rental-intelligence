"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  compactDateLabel,
  dateAtNoonUtc,
  dateKeyFromUtcDate,
  daysBetweenInclusive,
} from "./timelineUtils";

function offsetFromYearStart(dateKey: string, yearStart: string): number {
  const a = dateAtNoonUtc(yearStart);
  const b = dateAtNoonUtc(dateKey);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function dateFromOffset(yearStart: string, offset: number): string {
  return addDays(yearStart, offset);
}

export function PeriodRangeSlider({
  start,
  end,
  selectedPropertyId,
}: {
  start: string;
  end: string;
  selectedPropertyId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const year = start.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const max = daysBetweenInclusive(yearStart, yearEnd) - 1;

  const initialStartOffset = offsetFromYearStart(start, yearStart);
  const initialEndOffset = offsetFromYearStart(end, yearStart);

  const [left, setLeft] = useState(Math.min(initialStartOffset, initialEndOffset));
  const [right, setRight] = useState(Math.max(initialStartOffset, initialEndOffset));

  const selectedStart = dateFromOffset(yearStart, left);
  const selectedEnd = dateFromOffset(yearStart, right);

  const leftPct = (left / max) * 100;
  const rightPct = (right / max) * 100;

  const presets = useMemo(() => {
    const today = dateKeyFromUtcDate(new Date());
    return [
      { label: "30 j", start: today, end: addDays(today, 29) },
      { label: "Saison", start: `${year}-06-01`, end: `${year}-09-30` },
      { label: "Année", start: yearStart, end: yearEnd },
    ];
  }, [year, yearStart, yearEnd]);

  function apply(nextStart = selectedStart, nextEnd = selectedEnd) {
    const params = new URLSearchParams();
    params.set("start", nextStart);
    params.set("end", nextEnd);
    if (selectedPropertyId) params.set("property", selectedPropertyId);

    startTransition(() => {
      router.push(`/admin/planning-v2?${params.toString()}`);
    });
  }

  function applyPreset(preset: { start: string; end: string }) {
    const nextLeft = offsetFromYearStart(preset.start, yearStart);
    const nextRight = offsetFromYearStart(preset.end, yearStart);
    setLeft(Math.max(0, Math.min(nextLeft, max)));
    setRight(Math.max(0, Math.min(nextRight, max)));
    apply(preset.start, preset.end);
  }

  return (
    <section className="rounded-[1.35rem] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Période
          </p>
          <p className="truncate text-sm font-black text-slate-950">
            {compactDateLabel(selectedStart)} → {compactDateLabel(selectedEnd)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => apply()}
          disabled={isPending}
          className="shrink-0 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60"
        >
          {isPending ? "Mise à jour…" : "Appliquer"}
        </button>
      </div>

      <div className="mt-3">
        <div className="relative h-8">
          <div className="absolute left-0 right-0 top-3 h-2 rounded-full bg-slate-100" />
          <div
            className="absolute top-3 h-2 rounded-full bg-slate-950"
            style={{ left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` }}
          />

          <input
            type="range"
            min={0}
            max={max}
            value={left}
            onChange={(event) => {
              const value = Math.min(Number(event.target.value), right - 1);
              setLeft(value);
            }}
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-8 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-950 [&::-webkit-slider-thumb]:shadow-md"
          />

          <input
            type="range"
            min={0}
            max={max}
            value={right}
            onChange={(event) => {
              const value = Math.max(Number(event.target.value), left + 1);
              setRight(value);
            }}
            className="pointer-events-none absolute inset-x-0 top-0 z-30 h-8 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-950 [&::-webkit-slider-thumb]:shadow-md"
          />
        </div>

        <div className="mt-1 flex justify-between text-[9px] font-bold text-slate-400">
          <span>janv.</span>
          <span>avr.</span>
          <span>juil.</span>
          <span>oct.</span>
          <span>déc.</span>
        </div>
      </div>

      {isPending && (
        <p className="mt-2 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-900 ring-1 ring-amber-100">
          Mise à jour de la période…
        </p>
      )}

      <div className="mt-2 flex gap-1.5 overflow-x-auto">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </section>
  );
}
