"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type OwnerNavActive =
  | "cockpit"
  | "reservations"
  | "missions"
  | "reports"
  | "payments"
  | "settings";

type NavItem = {
  key: OwnerNavActive;
  label: string;
  short: string;
  href: string;
  icon: string;
};

function ownerCockpitBase(pathname: string | null) {
  const path = pathname || "";

  const tokenMatch = path.match(/^\/owner\/([^/]+)\/cockpit/);
  if (tokenMatch?.[1]) return `/owner/${tokenMatch[1]}/cockpit`;

  return "/owner/cockpit";
}

function itemsFor(pathname: string | null): NavItem[] {
  const cockpit = ownerCockpitBase(pathname);

  return [
    { key: "cockpit", label: "Cockpit", short: "Pilotage", href: cockpit, icon: "✦" },
    { key: "reservations", label: "Séjours", short: "Séjours", href: `${cockpit}?view=planning`, icon: "◌" },
    { key: "missions", label: "Missions", short: "Missions", href: `${cockpit}?view=alerts`, icon: "✓" },
    { key: "payments", label: "Paiements", short: "€", href: "/owner/payments", icon: "€" },
    { key: "settings", label: "Réglages", short: "Réglages", href: "/admin/settings", icon: "⚙" },
  ];
}

function inferActive(pathname: string | null): OwnerNavActive {
  const path = pathname || "";

  if (path.includes("/owner/payments")) return "payments";
  if (path.includes("/owner/reports")) return "reports";
  if (path.includes("/owner/missions") || path.includes("/owner/issues")) return "missions";
  if (
    path.includes("/owner/reservations") ||
    path.includes("/owner/reservation") ||
    path.includes("/owner/bookings") ||
    path.includes("/owner/booking") ||
    path.includes("/owner/stays")
  ) {
    return "reservations";
  }

  if (path.includes("/admin/settings")) return "settings";

  return "cockpit";
}

function itemClasses(active: boolean) {
  return active
    ? "bg-[#112532] text-white shadow-lg shadow-[#112532]/18 ring-[#112532]/10"
    : "bg-white/78 text-[#112532]/62 ring-[#112532]/8 hover:bg-white hover:text-[#112532]";
}

export function OwnerTopNav({ active }: { active?: OwnerNavActive }) {
  const pathname = usePathname();
  const current = active || inferActive(pathname);
  const navItems = itemsFor(pathname);

  return (
    <nav className="flex items-center justify-between gap-3">
      <Link
        href={ownerCockpitBase(pathname)}
        className="group flex items-center gap-3 rounded-2xl bg-white/86 px-3 py-2 text-[#112532] shadow-sm ring-1 ring-white/55 backdrop-blur"
      >
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#E0680E] text-sm font-black text-white shadow-sm">
          P
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-black tracking-tight">Pilotys</span>
          <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#112532]/42">
            Owner cockpit
          </span>
        </span>
      </Link>

      <div className="hidden items-center gap-2 rounded-full bg-white/56 p-1.5 ring-1 ring-white/45 backdrop-blur md:flex">
        {navItems.map((item) => {
          const isActive = current === item.key;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={[
                "rounded-full px-4 py-2 text-xs font-black transition",
                isActive
                  ? "bg-[#112532] text-white shadow-sm"
                  : "text-[#112532]/64 hover:bg-white/75 hover:text-[#112532]",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function OwnerBottomNav({ active }: { active?: OwnerNavActive }) {
  const pathname = usePathname();
  const current = active || inferActive(pathname);
  const navItems = itemsFor(pathname);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3 md:hidden">
      <nav className="pointer-events-auto relative mx-auto max-w-md overflow-hidden rounded-[1.7rem] bg-white/90 p-1.5 shadow-2xl shadow-[#112532]/18 ring-1 ring-[#112532]/10 backdrop-blur-xl">
        <div className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-gradient-to-r from-[#E0680E] via-[#F4B044] to-[#80A5B7]" />

        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const isActive = current === item.key;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={[
                  "relative flex min-h-[3.55rem] flex-col items-center justify-center rounded-[1.25rem] px-1 text-center transition",
                  itemClasses(isActive),
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-6 w-6 place-items-center rounded-full text-[11px] font-black",
                    isActive ? "bg-white/16 text-white" : "bg-[#112532]/6 text-[#112532]/50",
                  ].join(" ")}
                >
                  {item.icon}
                </span>
                <span className="mt-1 max-w-full truncate text-[10px] font-black leading-none">
                  {item.short}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
