import Link from "next/link";

export type NotificationItem = {
  key: string;
  severity: "red" | "amber" | "slate";
  title: string;
  summary: string;
  meta?: string;
  href: string;
};

function dotClass(severity: NotificationItem["severity"]): string {
  if (severity === "red") return "bg-red-600";
  if (severity === "amber") return "bg-amber-500";
  return "bg-slate-400";
}

function groupLabel(severity: NotificationItem["severity"]): string {
  if (severity === "red") return "À faire";
  if (severity === "amber") return "À surveiller";
  return "Info";
}

function NotificationRow({ item }: { item: NotificationItem }) {
  return (
    <Link
      href={item.href}
      className="block rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-100"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass(item.severity)}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-xs font-black text-slate-950">
              {item.title}
            </p>
            {item.meta && (
              <p className="shrink-0 text-[9px] font-bold uppercase text-slate-400">
                {item.meta}
              </p>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-slate-500">
            {item.summary}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function NotificationFeed({
  items,
}: {
  items: NotificationItem[];
}) {
  if (items.length === 0) {
    return (
      <section className="rounded-[1.25rem] bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800">
            ✓
          </span>
          <div>
            <p className="text-xs font-black text-slate-950">Rien d’urgent</p>
            <p className="text-[11px] text-slate-500">Aucune action immédiate.</p>
          </div>
        </div>
      </section>
    );
  }

  const groups: NotificationItem["severity"][] = ["red", "amber", "slate"];

  return (
    <section className="rounded-[1.25rem] bg-slate-100/70 p-2 shadow-sm ring-1 ring-slate-200">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Alertes
        </p>
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
          {items.length}
        </span>
      </div>

      <div className="space-y-2">
        {groups.map((severity) => {
          const groupItems = items.filter((item) => item.severity === severity);
          if (groupItems.length === 0) return null;

          return (
            <div key={severity}>
              <div className="mb-1 flex items-center gap-1.5 px-1">
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass(severity)}`} />
                <p className="text-[10px] font-black uppercase text-slate-500">
                  {groupLabel(severity)} · {groupItems.length}
                </p>
              </div>

              <div className="-space-y-1">
                {groupItems.slice(0, 4).map((item) => (
                  <div key={item.key} className="relative">
                    <NotificationRow item={item} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
