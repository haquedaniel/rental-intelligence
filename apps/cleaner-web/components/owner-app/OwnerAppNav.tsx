import Link from "next/link";

type OwnerAppNavProps = {
  active: "cockpit" | "planning" | "reservations" | "properties" | "people" | "revenue";
};

const ITEMS = [
  { key: "cockpit", label: "Cockpit", icon: "◌", href: "/owner/app" },
  { key: "planning", label: "Planning", icon: "▦", href: "/owner/cockpit" },
  { key: "reservations", label: "Réservations", icon: "≡", href: "/owner/app/reservations" },
  { key: "properties", label: "Logements", icon: "⌂", href: "/owner/app#logements" },
  { key: "people", label: "Intervenants", icon: "●", href: "/admin/cleaners" },
  { key: "revenue", label: "Revenus", icon: "€", href: "/owner/app#revenus" },
] as const;

export function OwnerAppNav({ active }: OwnerAppNavProps) {
  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50/90 px-3 py-2 backdrop-blur sm:px-5 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/admin" className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
              P
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-950">
                Pilotys Owner
              </span>
              <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Cockpit propriétaire
              </span>
            </span>
          </Link>

          <div className="hidden gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 md:flex">
            {ITEMS.map((item) => {
              const isActive = item.key === active;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={
                    isActive
                      ? "rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
                      : "rounded-full px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <Link
            href="/admin/interventions"
            className="shrink-0 rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white shadow-sm"
          >
            + Intervention
          </Link>
        </div>
      </nav>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.10)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {ITEMS.slice(0, 5).map((item) => {
            const isActive = item.key === active;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={
                  isActive
                    ? "flex flex-col items-center justify-center rounded-2xl bg-slate-950 px-1 py-2 text-[10px] font-black text-white"
                    : "flex flex-col items-center justify-center rounded-2xl px-1 py-2 text-[10px] font-black text-slate-500 active:bg-slate-100"
                }
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="mt-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
