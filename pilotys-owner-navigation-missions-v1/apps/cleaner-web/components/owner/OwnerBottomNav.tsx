import Link from "next/link";

type OwnerNavKey = "cockpit" | "reservations" | "missions" | "reports" | "payments" | "settings";

const NAV_ITEMS: {
  key: OwnerNavKey;
  label: string;
  icon: string;
  href: string;
}[] = [
  {
    key: "cockpit",
    label: "Cockpit",
    icon: "⌁",
    href: "/owner/cockpit",
  },
  {
    key: "reservations",
    label: "Séjours",
    icon: "◴",
    href: "/owner/cockpit?view=planning",
  },
  {
    key: "missions",
    label: "Missions",
    icon: "✓",
    href: "/owner/cockpit?view=alerts",
  },
  {
    key: "payments",
    label: "Paiements",
    icon: "€",
    href: "/owner/payments",
  },
  {
    key: "settings",
    label: "Réglages",
    icon: "⋯",
    href: "/admin/settings",
  },
];

function itemClass(active: boolean) {
  return active
    ? "flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl bg-[#112532] px-2 py-2 text-white shadow-sm"
    : "flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[#112532]/55 hover:bg-[#112532]/5";
}

export default function OwnerBottomNav({
  active,
}: {
  active?: OwnerNavKey;
}) {
  return (
    <>
      <div className="h-24 sm:hidden" />

      <nav
        aria-label="Navigation propriétaire"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#112532]/10 bg-[#F6F3EF]/94 px-3 pb-[max(env(safe-area-inset-bottom),0.55rem)] pt-2 shadow-[0_-14px_30px_rgba(17,37,50,0.10)] backdrop-blur-xl sm:hidden"
      >
        <div className="mx-auto flex max-w-md gap-1 rounded-[1.35rem] bg-white p-1 ring-1 ring-[#112532]/8">
          {NAV_ITEMS.map((item) => (
            <Link key={item.key} href={item.href} className={itemClass(active === item.key)}>
              <span className="text-base leading-none">{item.icon}</span>
              <span className="mt-1 max-w-full truncate text-[10px] font-black leading-none">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

export function OwnerTopNav({
  active,
  backHref = "/owner/cockpit",
  backLabel = "Retour cockpit",
}: {
  active?: OwnerNavKey;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href={backHref} className="text-sm font-black text-[#112532]/55">
        ← {backLabel}
      </Link>

      <nav className="hidden gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-[#112532]/8 sm:flex">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={
              active === item.key
                ? "rounded-full bg-[#112532] px-4 py-2 text-xs font-black text-white"
                : "rounded-full px-4 py-2 text-xs font-black text-[#112532]/62 hover:bg-[#112532]/5"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
