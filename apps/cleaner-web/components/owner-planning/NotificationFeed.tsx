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
      className="block rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-100 transition hover:bg-slate-50"
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
  const urgentCount = items.filter((item) => item.severity === "red").length;
  const count = items.length;

  return (
    <details className="relative">
      <summary className="list-none">
        <div className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-lg shadow-sm ring-1 ring-slate-200">
          🔔
          {count > 0 && (
            <span className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ${urgentCount ? "bg-red-600" : "bg-amber-500"}`}>
              {count}
            </span>
          )}
        </div>
      </summary>

      <div className="fixed right-3 top-24 z-50 w-[calc(100vw-1.5rem)] max-w-[360px] rounded-[1.25rem] bg-slate-100 p-2 shadow-xl ring-1 ring-slate-200 sm:absolute sm:right-0 sm:top-auto sm:mt-2 sm:w-[360px]">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Notifications
          </p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">
            {count}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-100">
            <p className="text-xs font-black text-slate-950">Rien d’urgent</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Aucune action immédiate.</p>
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-2 overflow-auto">
            {(["red", "amber", "slate"] as const).map((severity) => {
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
                    {groupItems.slice(0, 6).map((item) => (
                      <NotificationRow key={item.key} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
