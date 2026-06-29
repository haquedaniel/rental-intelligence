"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  const pathname = usePathname();
  const [pendingKey, setPendingKey] = useState<CleanerNavActive | null>(null);

  useEffect(() => {
    setPendingKey(null);
  }, [pathname]);

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
          const isPending = pendingKey === item.key;

          const className = [
            "relative flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2.5 text-[10px] font-black transition duration-150 ease-out",
            "active:scale-[0.97]",
            isActive
              ? "bg-slate-100 text-slate-950 ring-1 ring-slate-200"
              : item.href
                ? "text-slate-500 hover:bg-slate-50 active:bg-slate-100"
                : "cursor-not-allowed text-slate-300",
            isPending ? "opacity-70" : "",
          ].join(" ");

          const content = (
            <>
              {isActive && (
                <span className="absolute -top-1 h-1 w-7 rounded-full bg-slate-900/70" />
              )}

              {isPending && (
                <span className="absolute right-3 top-2 h-2 w-2 animate-pulse rounded-full bg-slate-900/60" />
              )}

              <span
                className={[
                  "flex h-7 min-w-7 items-center justify-center rounded-xl text-lg leading-none transition",
                  isActive ? "bg-white shadow-sm" : "",
                ].join(" ")}
              >
                {item.icon}
              </span>

              <span className="mt-1 max-w-full truncate">{item.label}</span>
            </>
          );

          if (!item.href) {
            return (
              <span key={item.key} className={className}>
                {content}
              </span>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch
              className={className}
              onClick={() => {
                if (item.href !== pathname) {
                  setPendingKey(item.key);
                }
              }}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
