import Link from "next/link";

import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

const STATUS_ORDER: Record<string, number> = {
  critical: 1,
  warning: 2,
  ok: 3,
};

const STATUS_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-800 ring-red-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

function valueToText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseDateSafe(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  if (key.endsWith("_at") || key.includes("checked_at") || key.includes("event_at")) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
    }
  }

  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function statusRank(row: Row): number {
  return STATUS_ORDER[String(row.health_status ?? "").toLowerCase()] ?? 99;
}

function sortRows(rows: Row[]) {
  return [...rows].sort((a, b) => {
    const statusDiff = statusRank(a) - statusRank(b);
    if (statusDiff !== 0) return statusDiff;
    return String(a.job_name ?? "").localeCompare(String(b.job_name ?? ""));
  });
}

function uniqueValues(rows: Row[], key: string) {
  return [...new Set(rows.map((row) => String(row[key] ?? "")).filter(Boolean))].sort();
}

function filterRows({ rows, status, job, q }: { rows: Row[]; status: string; job: string; q: string }) {
  const query = q.trim().toLowerCase();

  return rows.filter((row) => {
    if (status && String(row.health_status ?? "") !== status) return false;
    if (job && String(row.job_name ?? "") !== job) return false;

    if (query) {
      const haystack = Object.values(row).map(valueToText).join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

function StatusPill({ status }: { status: unknown }) {
  const value = String(status ?? "unknown");
  const className = STATUS_STYLES[value] ?? "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${className}`}>
      {value}
    </span>
  );
}

function StatCard({ label, value, className }: { label: string; value: string | number; className: string }) {
  return (
    <div className={`rounded-3xl p-5 shadow-sm ring-1 ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-65">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

export default async function OpsHealthPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; job?: string; q?: string }>;
}) {
  await requireAdmin();

  const params = searchParams ? await searchParams : {};
  const status = String(params.status ?? "");
  const job = String(params.job ?? "");
  const q = String(params.q ?? "");

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ops_script_health")
    .select("*")
    .range(0, 9999);

  if (error) {
    return (
      <main className="min-h-screen bg-[#F6F3EF] px-4 py-8 text-[#112532]">
        <div className="mx-auto max-w-5xl rounded-3xl bg-red-50 p-6 text-red-900 ring-1 ring-red-200">
          <p className="text-sm font-black uppercase tracking-[0.18em]">Pilotys · Ops health</p>
          <h1 className="mt-3 text-3xl font-black">Unable to load health table</h1>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 text-xs">{error.message}</pre>
        </div>
      </main>
    );
  }

  const allRows = sortRows((data ?? []) as Row[]);
  const rows = filterRows({ rows: allRows, status, job, q });

  const preferredColumns = [
    "health_status",
    "job_name",
    "checked_at",
    "max_age",
    "last_event_at",
    "last_event_type",
    "last_severity",
    "title",
    "summary",
    "reason_code",
    "run_id",
  ];

  const dynamicColumns = Array.from(new Set(allRows.flatMap((row) => Object.keys(row))));
  const columns = [
    ...preferredColumns,
    ...dynamicColumns.filter((column) => !preferredColumns.includes(column)),
  ].filter((column, index, arr) => arr.indexOf(column) === index);

  const statusValues = uniqueValues(allRows, "health_status");
  const jobValues = uniqueValues(allRows, "job_name");

  const counts = allRows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.health_status ?? "unknown");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const latestCheckedAt = allRows
    .map((row) => parseDateSafe(row.checked_at))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-4 pb-20 pt-8 text-[#112532]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#E0680E]">
              Pilotys · Ops health
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Script health</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-[#112532]/58">
              Live view of <code className="rounded bg-white px-1.5 py-0.5">public.ops_script_health</code>.
              The query intentionally uses <code className="rounded bg-white px-1.5 py-0.5">select(&quot;*&quot;)</code> so new columns appear automatically.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/settings" className="rounded-full bg-white px-4 py-3 text-sm font-black text-[#112532]/65 ring-1 ring-[#112532]/10">
              Settings
            </Link>
            <Link href="/admin/ops-health" className="rounded-full bg-[#112532] px-4 py-3 text-sm font-black text-white">
              Refresh
            </Link>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total jobs" value={allRows.length} className="bg-white text-[#112532] ring-[#112532]/8" />
          <StatCard label="Critical" value={counts.critical ?? 0} className="bg-red-50 text-red-800 ring-red-200" />
          <StatCard label="Warning" value={counts.warning ?? 0} className="bg-amber-50 text-amber-800 ring-amber-200" />
          <StatCard label="OK" value={counts.ok ?? 0} className="bg-emerald-50 text-emerald-800 ring-emerald-200" />
          <StatCard
            label="Checked"
            value={latestCheckedAt ? formatValue("checked_at", latestCheckedAt.toISOString()) : "—"}
            className="bg-[#EFF6F8] text-[#112532] ring-[#80A5B7]/25"
          />
        </section>

        <form className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#112532]/8 md:grid-cols-[1fr_1fr_1.4fr_auto]">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#112532]/45">
            Status
            <select name="status" defaultValue={status} className="mt-2 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#112532]">
              <option value="">All</option>
              {statusValues.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#112532]/45">
            Job
            <select name="job" defaultValue={job} className="mt-2 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#112532]">
              <option value="">All</option>
              {jobValues.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#112532]/45">
            Search
            <input name="q" defaultValue={q} placeholder="title, summary, run id..." className="mt-2 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#112532]" />
          </label>

          <div className="flex items-end gap-2">
            <button className="rounded-2xl bg-[#E0680E] px-5 py-3 text-sm font-black text-white shadow-sm shadow-[#E0680E]/20">
              Apply
            </button>
            <Link href="/admin/ops-health" className="rounded-2xl bg-[#112532]/6 px-5 py-3 text-sm font-black text-[#112532]/62">
              Reset
            </Link>
          </div>
        </form>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#112532]/8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#112532]/8 px-5 py-4">
            <div>
              <h2 className="text-lg font-black">Rows</h2>
              <p className="mt-1 text-xs font-bold text-[#112532]/45">Showing {rows.length} of {allRows.length}</p>
            </div>
          </div>

          <div className="max-h-[72vh] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#F6F3EF]">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="whitespace-nowrap border-b border-[#112532]/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#112532]/45">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.job_name ?? "row"}-${row.run_id ?? index}`} className="border-b border-[#112532]/6 odd:bg-white even:bg-[#F6F3EF]/50">
                    {columns.map((column) => (
                      <td key={column} className="max-w-[28rem] border-b border-[#112532]/6 px-4 py-3 align-top font-semibold text-[#112532]/72">
                        {column === "health_status" ? (
                          <StatusPill status={row[column]} />
                        ) : (
                          <span className={column === "summary" ? "whitespace-normal" : "whitespace-nowrap"}>
                            {formatValue(column, row[column])}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(columns.length, 1)} className="px-4 py-10 text-center text-sm font-bold text-[#112532]/45">
                      No rows match the filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
