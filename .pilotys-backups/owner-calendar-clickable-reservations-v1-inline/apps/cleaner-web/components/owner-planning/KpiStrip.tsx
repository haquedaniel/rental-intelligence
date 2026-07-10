"use client";

import { useState } from "react";
import {
  money,
  periodLabel,
} from "./analyticsUtils";
import {
  daysBetweenInclusive,
  todayParisDateKey,
  type Row,
} from "./timelineUtils";

type KpiTone = "green" | "blue" | "amber" | "slate";
type KpiKey = "annual" | "realised" | "period" | "after_variables";

type ExpenseBreakdownItem = {
  label: string;
  amount: number;
  count: number;
};

function n(row: Row, key: string): number {
  const value = Number(row?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function pct(value: number, objective?: number | null): number | null {
  if (!objective || objective <= 0) return null;
  return Math.round((value / objective) * 100);
}

function progressClass(tone: KpiTone): string {
  if (tone === "green") return "bg-emerald-600";
  if (tone === "blue") return "bg-blue-600";
  if (tone === "amber") return "bg-amber-600";
  return "bg-slate-800";
}

function cardClass(tone: KpiTone, active: boolean): string {
  const ring = active ? "ring-2 ring-slate-950" : "ring-1 ring-slate-200";
  return `min-w-[210px] flex-1 rounded-[1.25rem] bg-white p-3 shadow-sm ${ring}`;
}

function dateInRange(row: Row, start: string, end: string): boolean {
  const date = String(row.date ?? "");
  return date >= start && date <= end;
}

function monthInRange(row: Row, start: string, end: string): boolean {
  const month = String(row.year_month ?? "");
  return month >= start.slice(0, 7) && month <= end.slice(0, 7);
}

function expenseDateInRange(row: Row, start: string, end: string): boolean {
  const date = String(row.expense_date ?? "");
  return Boolean(date && date >= start && date <= end);
}

function sum(rows: Row[], key: string): number {
  return rows.reduce((total, row) => total + n(row, key), 0);
}

function dayOfYear(dateKey: string): number {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const start = new Date(`${dateKey.slice(0, 4)}-01-01T12:00:00.000Z`);
  return Math.round((date.getTime() - start.getTime()) / 86400000) + 1;
}

function yearLength(year: string): number {
  const a = new Date(`${year}-01-01T12:00:00.000Z`);
  const b = new Date(`${Number(year) + 1}-01-01T12:00:00.000Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function proratedObjective(annualObjective: number, start: string, end: string): number | null {
  if (!annualObjective) return null;
  const yearDays = yearLength(start.slice(0, 4));
  const days = daysBetweenInclusive(start, end);
  return Math.round((annualObjective * days) / yearDays);
}

function labelForExpense(row: Row): string {
  const category = String(row.category ?? "");
  if (category === "cleaning_actual_cost") return "Ménage";
  if (category === "energy_usage") return "Électricité";
  if (category === "water_usage") return "Eau";
  if (category === "concierge") return "Conciergerie";
  if (category === "concierge_fee") return "Conciergerie";
  if (category === "channel_commission") return "Commission";
  if (category) return category.replaceAll("_", " ");

  const family = String(row.cost_family ?? "");
  return family ? family.replaceAll("_", " ") : "Autres frais";
}

function addBreakdown(map: Map<string, ExpenseBreakdownItem>, label: string, amount: number, count = 1) {
  if (!amount) return;
  const current = map.get(label) ?? { label, amount: 0, count: 0 };
  current.amount += amount;
  current.count += count;
  map.set(label, current);
}

function exactVariableExpenseAmount({
  periodDaily,
  expenseRows,
}: {
  periodDaily: Row[];
  expenseRows: Row[];
}) {
  const breakdown = new Map<string, ExpenseBreakdownItem>();

  const bookingExpenses = expenseRows.filter((row) =>
    row.expense_source === "booking_expenses",
  );

  for (const row of bookingExpenses) {
    addBreakdown(breakdown, labelForExpense(row), n(row, "expense_amount"));
  }

  const variableRows = expenseRows.filter((row) =>
    row.expense_source === "variable_period_costs",
  );

  for (const daily of periodDaily) {
    if (!daily.is_booked) continue;

    const matches = variableRows.filter((expense) =>
      String(expense.property_id ?? "") === String(daily.property_id ?? "") &&
      String(expense.year_month ?? "") === String(daily.year_month ?? ""),
    );

    for (const expense of matches) {
      addBreakdown(breakdown, labelForExpense(expense), n(expense, "amount_per_day"));
    }
  }

  const items = Array.from(breakdown.values()).sort((a, b) => b.amount - a.amount);
  const total = items.reduce((acc, item) => acc + item.amount, 0);

  return { total, items };
}

function KpiCard({
  kpiKey,
  selectedKpi,
  onSelect,
  label,
  value,
  objective,
  objectiveLabel,
  detail,
  tone,
}: {
  kpiKey: KpiKey;
  selectedKpi?: string;
  onSelect: (key: KpiKey) => void;
  label: string;
  value: number;
  objective?: number | null;
  objectiveLabel?: string;
  detail?: string;
  tone: KpiTone;
}) {
  const active = selectedKpi === kpiKey;
  const percentage = pct(value, objective);
  const width = percentage === null ? 18 : Math.max(4, Math.min(100, percentage));

  return (
    <button
      type="button"
      onClick={() => onSelect(kpiKey)}
      className={`${cardClass(tone, active)} text-left transition active:scale-[0.99]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black leading-none text-slate-950">
            {money(value)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-black text-slate-500">
            {percentage === null ? "—" : `${percentage}%`}
          </p>
          <p className="mt-1 text-[10px] font-bold text-slate-400">
            {active ? "fermer" : "détail"}
          </p>
        </div>
      </div>

      <p className="mt-2 truncate text-[11px] font-semibold text-slate-500">
        {objective
          ? `${objectiveLabel ?? "Objectif"} ${money(objective)}`
          : objectiveLabel ?? "Objectif à connecter"}
      </p>

      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${progressClass(tone)}`}
          style={{ width: `${width}%` }}
        />
      </div>

      {detail && (
        <p className="mt-2 truncate text-[11px] text-slate-500">
          {detail}
        </p>
      )}
    </button>
  );
}

function FinanceTable({
  rows,
  valueKey,
}: {
  rows: Row[];
  valueKey: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">
        Aucun détail disponible pour cette période.
      </p>
    );
  }

  const grouped = new Map<string, {
    listing: string;
    month: string;
    value: number;
    bookedNights: number;
    occupancy: number;
  }>();

  for (const row of rows) {
    const key = `${row.listing_id}:${row.year_month}`;
    const current = grouped.get(key) ?? {
      listing: row.listing_name || row.listing_id || "Logement",
      month: row.year_month,
      value: 0,
      bookedNights: 0,
      occupancy: 0,
    };

    current.value += n(row, valueKey);
    current.bookedNights += n(row, "booked_nights");
    current.occupancy = Math.max(current.occupancy, n(row, "occupancy_pct"));
    grouped.set(key, current);
  }

  const out = Array.from(grouped.values()).sort((a, b) =>
    `${a.listing}-${a.month}`.localeCompare(`${b.listing}-${b.month}`),
  );

  return (
    <div className="max-h-72 overflow-auto rounded-2xl ring-1 ring-slate-100">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-50 text-slate-500">
          <tr>
            <th className="p-2 font-black">Logement</th>
            <th className="p-2 font-black">Mois</th>
            <th className="p-2 text-right font-black">Montant</th>
            <th className="p-2 text-right font-black">Nuits</th>
            <th className="p-2 text-right font-black">Occ.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {out.map((row) => (
            <tr key={`${row.listing}-${row.month}`}>
              <td className="p-2 font-bold text-slate-900">{row.listing}</td>
              <td className="p-2 text-slate-600">{row.month}</td>
              <td className="p-2 text-right font-black text-slate-950">{money(row.value)}</td>
              <td className="p-2 text-right text-slate-600">{row.bookedNights}</td>
              <td className="p-2 text-right text-slate-600">{row.occupancy ? `${row.occupancy}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseChart({
  items,
  revenue,
}: {
  items: ExpenseBreakdownItem[];
  revenue: number;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">
        Aucun coût variable détecté pour cette période.
      </p>
    );
  }

  const total = items.reduce((acc, item) => acc + item.amount, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-slate-50 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-600">Total frais variables</span>
          <span className="font-black text-slate-950">{money(total)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-bold text-slate-600">% du CA période</span>
          <span className="font-black text-slate-950">
            {revenue ? `${Math.round((total / revenue) * 100)}%` : "—"}
          </span>
        </div>
      </div>

      {items.map((item) => {
        const pctOfExpenses = total ? Math.round((item.amount / total) * 100) : 0;
        const pctOfRevenue = revenue ? Math.round((item.amount / revenue) * 100) : 0;

        return (
          <div key={item.label}>
            <div className="mb-1 flex items-end justify-between gap-3 text-xs">
              <div>
                <p className="font-black text-slate-800">{item.label}</p>
                <p className="text-[10px] font-semibold text-slate-500">
                  {pctOfRevenue}% du CA
                </p>
              </div>
              <div className="text-right">
                <p className="font-black text-slate-950">{money(item.amount)}</p>
                <p className="text-[10px] font-semibold text-slate-500">{pctOfExpenses}% des frais</p>
              </div>
            </div>

            <div className="relative h-7 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-7 rounded-full bg-amber-600"
                style={{ width: `${Math.max(4, pctOfExpenses)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-end px-2 text-[10px] font-black text-slate-900">
                {money(item.amount)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function panelTitle(selectedKpi?: string, start?: string, end?: string): string {
  if (selectedKpi === "annual") return "Sur les livres · année";
  if (selectedKpi === "realised") return "Réalisé à date";
  if (selectedKpi === "period") return `CA période · ${periodLabel(start!, end!)}`;
  if (selectedKpi === "after_variables") return `Frais variables · ${periodLabel(start!, end!)}`;
  return "";
}

function DetailShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="absolute left-5 right-5 top-0 h-1 rounded-b-full bg-slate-950" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Détail KPI sélectionné
          </p>
          <h3 className="text-sm font-black text-slate-950">{title}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
          panneau
        </span>
      </div>
      {children}
    </section>
  );
}

function DetailPanel({
  selectedKpi,
  monthlyRows,
  periodMonthly,
  exactExpenses,
  periodRevenue,
  start,
  end,
}: {
  selectedKpi?: string;
  monthlyRows: Row[];
  periodMonthly: Row[];
  exactExpenses: { total: number; items: ExpenseBreakdownItem[] };
  periodRevenue: number;
  start: string;
  end: string;
}) {
  if (!selectedKpi) return null;

  if (selectedKpi === "annual") {
    return (
      <DetailShell title={panelTitle(selectedKpi, start, end)}>
        <FinanceTable rows={monthlyRows} valueKey="host_payout" />
      </DetailShell>
    );
  }

  if (selectedKpi === "realised") {
    const today = todayParisDateKey();
    return (
      <DetailShell title={panelTitle(selectedKpi, start, end)}>
        <FinanceTable
          rows={monthlyRows.filter((row) => String(row.year_month ?? "") <= today.slice(0, 7))}
          valueKey="host_payout"
        />
      </DetailShell>
    );
  }

  if (selectedKpi === "period") {
    return (
      <DetailShell title={panelTitle(selectedKpi, start, end)}>
        <FinanceTable rows={periodMonthly} valueKey="host_payout" />
      </DetailShell>
    );
  }

  if (selectedKpi === "after_variables") {
    return (
      <DetailShell title={panelTitle(selectedKpi, start, end)}>
        <ExpenseChart items={exactExpenses.items} revenue={periodRevenue} />
      </DetailShell>
    );
  }

  return null;
}

export function KpiStrip({
  dailyRows,
  monthlyRows,
  kpiRows,
  expenseRows,
  targetRows,
  start,
  end,
  selectedKpi: initialSelectedKpi,
}: {
  dailyRows: Row[];
  monthlyRows: Row[];
  kpiRows: Row[];
  expenseRows: Row[];
  targetRows: Row[];
  start: string;
  end: string;
  selectedKpi?: string;
  selectedPropertyId?: string;
}) {
  const [selectedKpi, setSelectedKpi] = useState<string | undefined>(initialSelectedKpi);
  const today = todayParisDateKey();

  function toggleKpi(key: KpiKey) {
    setSelectedKpi((current) => (current === key ? undefined : key));
  }

  const periodDaily = dailyRows.filter((row) => dateInRange(row, start, end));

  // "Réalisé à date" must also respect the selected period.
  // This is a pro-rata daily view, but filtered: selected period AND date <= today.
  const realisedDaily = dailyRows.filter((row) => {
    const date = String(row.date ?? "");
    return date >= start && date <= end && date <= today;
  });

  const periodMonthly = monthlyRows.filter((row) => monthInRange(row, start, end));

  const bookingExpenseRows = expenseRows.filter((row) =>
    row.expense_source === "booking_expenses" && expenseDateInRange(row, start, end),
  );

  const variableRowsForSelectedMonths = expenseRows.filter((row) =>
    row.expense_source === "variable_period_costs" && monthInRange(row, start, end),
  );

  const exactExpenses = exactVariableExpenseAmount({
    periodDaily,
    expenseRows: [...bookingExpenseRows, ...variableRowsForSelectedMonths],
  });

  // Annual "on the books" should come from the monthly finance table, not the daily allocation table.
  // This matches the cockpit finance view more closely and avoids losing revenue during migration.
  const annualOnBooks = sum(monthlyRows, "host_payout");

  const realisedToDate = sum(realisedDaily, "host_payout_allocated");
  const periodRevenue = sum(periodDaily, "host_payout_allocated");
  const periodAfterVariables = periodRevenue - exactExpenses.total;

  // Targets now come from the original listing/month YAML grid, synced to Supabase.
  // No pro-rata: if the selected period touches a month, that month's seasonal target counts.
  const year = start.slice(0, 4);
  const annualTargetRows = targetRows.filter((row) =>
    String(row.year_month ?? "").startsWith(year),
  );
  const periodTargetRows = targetRows.filter((row) => monthInRange(row, start, end));

  const annualObjective =
    sum(annualTargetRows, "target_gross_booking_value") ||
    sum(annualTargetRows, "target_host_payout") ||
    sum(kpiRows, "target_host_payout");

  const knownPeriodTarget =
    sum(periodTargetRows, "target_gross_booking_value") ||
    sum(periodTargetRows, "target_host_payout") ||
    null;

  const realisedObjective = knownPeriodTarget;
  const periodObjective = knownPeriodTarget;

  const marginPct = periodRevenue ? Math.round((periodAfterVariables / periodRevenue) * 100) : null;

  return (
    <section className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <KpiCard
          kpiKey="annual"
          selectedKpi={selectedKpi}
          onSelect={toggleKpi}
          label="Sur les livres · année"
          value={annualOnBooks}
          objective={annualObjective}
          objectiveLabel="Objectif annuel"
          tone="green"
        />

        <KpiCard
          kpiKey="realised"
          selectedKpi={selectedKpi}
          onSelect={toggleKpi}
          label="Réalisé à date"
          value={realisedToDate}
          objective={realisedObjective}
          objectiveLabel={realisedObjective ? "Objectif période" : "Objectif mensuel à connecter"}
          detail={`${periodLabel(start, end)} · jusqu’à aujourd’hui`}
          tone="blue"
        />

        <KpiCard
          kpiKey="period"
          selectedKpi={selectedKpi}
          onSelect={toggleKpi}
          label="CA période"
          value={periodRevenue}
          objective={periodObjective}
          objectiveLabel={periodObjective ? "Objectif période" : "Objectif mensuel à connecter"}
          detail={periodLabel(start, end)}
          tone="amber"
        />

        <KpiCard
          kpiKey="after_variables"
          selectedKpi={selectedKpi}
          onSelect={toggleKpi}
          label="Période · après variables"
          value={periodAfterVariables}
          objective={periodRevenue || null}
          objectiveLabel="CA période"
          detail={
            marginPct === null
              ? "Frais variables exacts"
              : `${marginPct}% du CA conservé · frais ${money(exactExpenses.total)}`
          }
          tone="green"
        />
      </div>

      <DetailPanel
        selectedKpi={selectedKpi}
        monthlyRows={monthlyRows}
        periodMonthly={periodMonthly}
        exactExpenses={exactExpenses}
        periodRevenue={periodRevenue}
        start={start}
        end={end}
      />
    </section>
  );
}

