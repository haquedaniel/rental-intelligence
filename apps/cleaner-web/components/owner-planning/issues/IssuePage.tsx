import Link from "next/link";

export type Row = Record<string, any>;

const PARIS_TZ = "Europe/Paris";

export function parisDateKey(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);

  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function compactDate(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "short",
  })
    .format(new Date(value))
    .replace(".", "");
}

export function dateTime(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(":", "h")
    .replace(".", "");
}

export function timeOnly(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(":", "h");
}

export function fullName(cleaner?: Row | null): string {
  if (!cleaner) return "Non affecté";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || cleaner.name || "Intervenante";
}

export function money(value?: number | string | null): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function statusLabel(status?: string | null): string {
  switch (status) {
    case "created":
      return "Créée";
    case "sent":
      return "Proposée";
    case "accepted":
      return "Acceptée";
    case "refused":
      return "Refusée";
    case "cancelled":
      return "Annulée";
    case "completed":
      return "Terminée";
    case "report_submitted":
      return "Rapport envoyé";
    case "problem_reported":
      return "Problème signalé";
    case "failed":
      return "Échec";
    case "delivered":
      return "Envoyé";
    case "queued":
      return "En attente";
    default:
      return status || "—";
  }
}

export function statusPillClass(status?: string | null): string {
  if (["refused", "cancelled", "failed", "problem_reported"].includes(status || "")) {
    return "bg-red-100 text-red-800 ring-red-200";
  }
  if (["created", "sent", "queued"].includes(status || "")) {
    return "bg-amber-100 text-amber-900 ring-amber-200";
  }
  if (["accepted", "completed", "report_submitted", "delivered"].includes(status || "")) {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function IssueShell({
  title,
  subtitle,
  severity = "amber",
  children,
}: {
  title: string;
  subtitle: string;
  severity?: "red" | "amber" | "slate";
  children: React.ReactNode;
}) {
  const dot =
    severity === "red"
      ? "bg-red-600"
      : severity === "amber"
        ? "bg-amber-500"
        : "bg-slate-500";

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Notification
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {subtitle}
            </p>
          </div>

          <Link
            href="/admin/planning-v2"
            className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            Planning
          </Link>
        </header>

        {children}
      </div>
    </main>
  );
}

export function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </dl>
  );
}

export function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-black text-slate-950">{value}</dd>
    </div>
  );
}

export function Pill({
  status,
  label,
}: {
  status?: string | null;
  label?: string;
}) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ring-1 ${statusPillClass(status)}`}>
      {label ?? statusLabel(status)}
    </span>
  );
}

export function ActionPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.25rem] bg-slate-950 p-4 text-white shadow-sm">
      <h2 className="text-sm font-black">Résolution recommandée</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ActionLink({
  href,
  children,
  tone = "light",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <Link
      href={href}
      className={
        tone === "dark"
          ? "inline-flex rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white ring-1 ring-white/20"
          : "inline-flex rounded-full bg-white px-3 py-2 text-xs font-black text-slate-950 ring-1 ring-white/30"
      }
    >
      {children}
    </Link>
  );
}

export function Timeline({
  items,
}: {
  items: Array<{
    key: string;
    title: string;
    detail?: React.ReactNode;
    meta?: string;
    status?: string | null;
    statusText?: string;
  }>;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">
        Aucun historique disponible.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">{item.title}</p>
              {item.detail && (
                <div className="mt-1 text-xs font-semibold text-slate-500">{item.detail}</div>
              )}
            </div>
            {item.status ? <Pill status={item.status} label={item.statusText} /> : null}
          </div>
          {item.meta && (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {item.meta}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-[1.25rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-black">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p>
        <Link
          href="/admin/planning-v2"
          className="mt-4 inline-flex rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
        >
          Retour planning
        </Link>
      </div>
    </main>
  );
}
