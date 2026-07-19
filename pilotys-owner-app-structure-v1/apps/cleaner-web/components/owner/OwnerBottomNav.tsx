"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type OwnerNavActive =
  | "dashboard"
  | "operations"
  | "pricing"
  | "admin"
  | "activity";

type NavItem = {
  key: Exclude<OwnerNavActive, "activity">;
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
    { key: "admin", label: "Réglages", short: "Réglages", href: `${base}/admin`, icon: "⚙" },
  ];
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
  const current = active || inferActive(pathname);
  const base = ownerBase(pathname);
  const navItems = itemsFor(pathname);

  return (
    <nav className="flex items-center justify-between gap-3">
      <Link href={`${base}/cockpit`} className="group flex items-center gap-3 rounded-2xl bg-white/86 px-3 py-2 text-[#112532] shadow-sm ring-1 ring-white/55 backdrop-blur">
        <span className="relative grid h-9 w-9 place-items-center rounded-2xl bg-[#112532] text-sm font-black text-white shadow-sm">P<span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#E0680E]" /></span>
        <span className="leading-tight"><span className="block text-sm font-black tracking-[0.28em]">PILOTYS</span><span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#112532]/42">espace propriétaire</span></span>
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
  const current = active || inferActive(pathname);
  const navItems = itemsFor(pathname);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3 md:hidden">
      <nav className="pointer-events-auto relative mx-auto max-w-md overflow-hidden rounded-[1.7rem] bg-white/90 p-1.5 shadow-2xl shadow-[#112532]/18 ring-1 ring-[#112532]/10 backdrop-blur-xl">
        <div className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-gradient-to-r from-[#E0680E] via-[#F4B044] to-[#80A5B7]" />
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const selected = current === item.key;
            return (
              <Link key={item.key} href={item.href} className={["relative flex min-h-[3.55rem] flex-col items-center justify-center rounded-[1.25rem] px-1 text-center transition", selected ? "bg-[#112532] text-white shadow-lg shadow-[#112532]/18" : "bg-white/78 text-[#112532]/62 hover:bg-white hover:text-[#112532]"].join(" ")}>
                <span className={["grid h-6 w-6 place-items-center rounded-full text-[11px] font-black", selected ? "bg-white/16 text-white" : "bg-[#112532]/6 text-[#112532]/50"].join(" ")}>{item.icon}</span>
                <span className="mt-1 max-w-full truncate text-[10px] font-black leading-none">{item.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
