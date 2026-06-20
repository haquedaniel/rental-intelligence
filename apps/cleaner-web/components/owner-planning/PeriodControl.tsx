import Link from "next/link";
import {
  addDays,
  compactDateLabel,
  longDateLabel,
  todayParisDateKey,
  type Row,
} from "./timelineUtils";

function hrefFor(start: string, end: string, propertyId?: string) {
  const params = new URLSearchParams();
  params.set("start", start);
  params.set("end", end);
  if (propertyId) params.set("property", propertyId);
  return `/admin/planning-v2?${params.toString()}`;
}

function seasonRange() {
  const today = todayParisDateKey();
  const year = today.slice(0, 4);
  return {
    start: `${year}-06-01`,
    end: `${year}-09-30`,
  };
}

export function PeriodControl({
  start,
  end,
  selectedPropertyId,
  properties,
}: {
  start: string;
  end: string;
  selectedPropertyId?: string;
  properties: Row[];
}) {
  const today = todayParisDateKey();
  const season = seasonRange();

  const presets = [
    { label: "14 jours", start: today, end: addDays(today, 13) },
    { label: "30 jours", start: today, end: addDays(today, 29) },
    { label: "Saison", start: season.start, end: season.end },
    { label: "Année", start: `${today.slice(0, 4)}-01-01`, end: `${today.slice(0, 4)}-12-31` },
  ];

  return (
    <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Période de travail
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {longDateLabel(start)} → {longDateLabel(end)}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Cette période pilote les alertes, le planning, les ménages et les indicateurs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Link
              key={preset.label}
              href={hrefFor(preset.start, preset.end, selectedPropertyId)}
              className={`rounded-full px-4 py-2 text-sm font-bold ring-1 ${
                preset.start === start && preset.end === end
                  ? "bg-slate-950 text-white ring-slate-950"
                  : "bg-slate-50 text-slate-700 ring-slate-200"
              }`}
            >
              {preset.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <form action="/admin/planning-v2" className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-bold uppercase text-slate-400">Début</span>
            <input
              type="date"
              name="start"
              defaultValue={start}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase text-slate-400">Fin</span>
            <input
              type="date"
              name="end"
              defaultValue={end}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase text-slate-400">Logement</span>
            <select
              name="property"
              defaultValue={selectedPropertyId || ""}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
            >
              <option value="">Tous les logements</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          <button className="sm:col-span-3 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
            Appliquer
          </button>
        </form>

        <div className="rounded-3xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-100">
          <p className="font-bold text-slate-950">
            {compactDateLabel(start)} → {compactDateLabel(end)}
          </p>
          <p className="mt-1 text-xs">
            Slider visuel à venir. Cette première version utilise les mêmes paramètres URL.
          </p>
        </div>
      </div>
    </section>
  );
}
