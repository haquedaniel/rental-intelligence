import Link from "next/link";

import { getCleanerLocale, t, type CleanerLocale } from "@/lib/cleanerI18n";

type CleanerNavActive = "missions" | "planning" | "payments" | "profile";

type CleanerBottomNavProps = {
  cleanerToken?: string | null;
  missionToken?: string | null;
  active?: CleanerNavActive;
  locale?: CleanerLocale;
};

function cleanerPath(cleanerToken: string | null | undefined, suffix = "") {
  if (!cleanerToken) return null;
  return `/cleaner/${cleanerToken}${suffix}`;
}

export function CleanerBottomNav({
  cleanerToken,
  missionToken,
  active = "missions",
  locale = "fr",
}: CleanerBottomNavProps) {
  const currentLocale = getCleanerLocale(locale);
  const fallbackMissionHref = missionToken ? `/mission/${missionToken}` : null;

  const items: Array<{
    key: CleanerNavActive;
    label: string;
    icon: string;
    href: string | null;
  }> = [
    {
      key: "missions",
      label: t(currentLocale, "nav.missions"),
      icon: "📋",
      href: cleanerPath(cleanerToken) ?? fallbackMissionHref,
    },
    {
      key: "planning",
      label: t(currentLocale, "nav.planning"),
      icon: "📅",
      href: cleanerPath(cleanerToken, "/planning"),
    },
    {
      key: "payments",
      label: t(currentLocale, "nav.payments"),
      icon: "€",
      href: cleanerPath(cleanerToken, "/payments"),
    },
    {
      key: "profile",
      label: t(currentLocale, "nav.profile"),
      icon: "👤",
      href: cleanerPath(cleanerToken, "/profile"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.10)] backdrop-blur sm:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
        {items.map((item) => {
          const isActive = active === item.key;
          const className = `relative flex flex-col items-center justify-center rounded-2xl px-1 py-2 text-[10px] font-black ${
            isActive
              ? "bg-slate-950 text-white"
              : item.href
                ? "text-slate-500 active:bg-slate-100"
                : "cursor-not-allowed text-slate-300"
          }`;

          if (!item.href) {
            return (
              <span key={item.key} className={className}>
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="mt-1 truncate">{item.label}</span>
              </span>
            );
          }

          return (
            <Link key={item.key} href={item.href} className={className}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
