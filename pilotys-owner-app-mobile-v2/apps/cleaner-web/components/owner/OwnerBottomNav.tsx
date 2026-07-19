"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type OwnerNavActive =
  | "dashboard"
  | "operations"
  | "pricing"
  | "admin"
  | "activity"
  // Legacy values retained while older owner/admin pages are migrated.
  | "cockpit"
  | "missions"
  | "payments"
  | "reports"
  | "reservations"
  | "settings";

type PrimaryOwnerSection = "dashboard" | "operations" | "pricing" | "admin";

type NavItem = {
  key: PrimaryOwnerSection;
  label: string;
  short: string;
  href: string;
  icon: string;
};

function ownerBase(pathname: string | null) {
  const match = (pathname || "").match(/^\/owner\/([^/]+)/);
  return match?.[1] ? `/owner/${match[1]}` : "/owner";
}

function itemsFor(pathname: string | null): NavItem[] {
  const base = ownerBase(pathname);
  return [
    { key: "dashboard", label: "Tableau de bord", short: "Dashboard", href: `${base}/cockpit`, icon: "✦" },
    { key: "operations", label: "Opérations", short: "Opérations", href: `${base}/operations`, icon: "✓" },
    { key: "pricing", label: "Tarification", short: "Prix", href: `${base}/pricing`, icon: "€" },
    { key: "admin", label: "Compte", short: "Compte", href: `${base}/admin`, icon: "●" },
  ];
}

function normalizeActive(active: OwnerNavActive): OwnerNavActive {
  switch (active) {
    case "cockpit":
    case "reports":
    case "reservations":
      return "dashboard";
    case "missions":
    case "payments":
      return "operations";
    case "settings":
      return "admin";
    default:
      return active;
  }
}

function inferActive(pathname: string | null): OwnerNavActive {
  const path = pathname || "";
  if (path.includes("/activity")) return "activity";
  if (path.includes("/operations") || path.includes("/payments") || path.includes("/missions") || path.includes("/issues")) return "operations";
  if (path.includes("/pricing")) return "pricing";
  if (path.includes("/admin")) return "admin";
  return "dashboard";
}

export function OwnerTopNav({ active }: { active?: OwnerNavActive }) {
  const pathname = usePathname();
  const current = normalizeActive(active || inferActive(pathname));
  const base = ownerBase(pathname);
  const navItems = itemsFor(pathname);

  return (
    <nav className="flex items-center justify-between gap-3">
      <Link href={`${base}/cockpit`} className="group flex items-center gap-3 text-[#112532]">
        <img src="/pilotys-assets/pilotys-logo-mark.svg" alt="" className="h-10 w-10 shrink-0" />
        <span className="leading-tight">
          <span className="block text-sm font-black tracking-[0.28em]">PILOTYS</span>
          <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-[#112532]/42">espace propriétaire</span>
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <Link href={`${base}/activity`} aria-label="Journal et notifications" className={["relative grid h-10 w-10 place-items-center rounded-full ring-1", current === "activity" ? "bg-[#112532] text-white ring-[#112532]" : "bg-white text-[#112532] ring-[#112532]/10"].join(" ")}>◴</Link>
        <Link href={`${base}/admin`} aria-label="Réglages" className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#112532] ring-1 ring-[#112532]/10">≡</Link>
      </div>

      <div className="hidden items-center gap-2 rounded-full bg-white/56 p-1.5 ring-1 ring-white/45 backdrop-blur lg:flex">
        {navItems.map((item) => (
          <Link key={item.key} href={item.href} className={["rounded-full px-4 py-2 text-xs font-black transition", current === item.key ? "bg-[#112532] text-white shadow-sm" : "text-[#112532]/64 hover:bg-white/75 hover:text-[#112532]"].join(" ")}>{item.label}</Link>
        ))}
      </div>
    </nav>
  );
}

export default function OwnerBottomNav({ active }: { active?: OwnerNavActive }) {
  const pathname = usePathname();
  const current = normalizeActive(active || inferActive(pathname));
  const navItems = itemsFor(pathname);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden">
      <nav
        className="pointer-events-auto mx-auto max-w-md rounded-t-[1.65rem] border-x border-t border-[#112532]/10 bg-white/96 px-2 pt-2 shadow-[0_-10px_30px_rgba(17,37,50,0.10)] backdrop-blur-xl"
        style={{ paddingBottom: "max(0.45rem, env(safe-area-inset-bottom))" }}
      >
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const selected = current === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={[
                  "relative flex min-h-[3.65rem] flex-col items-center justify-center rounded-[1.15rem] px-1 text-center transition",
                  selected
                    ? "bg-[#112532] text-white shadow-md"
                    : "text-[#112532]/58 hover:bg-[#F4F8FA] hover:text-[#112532]",
                ].join(" ")}
              >
                <span className={["grid h-7 w-7 place-items-center rounded-full text-xs font-black", selected ? "bg-white/14 text-white" : "bg-[#112532]/6 text-[#112532]/55"].join(" ")}>
                  {item.icon}
                </span>
                <span className="mt-1 text-[10px] font-black leading-none">{item.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
