import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Accueil
          </p>
          <h1 className="text-3xl font-black tracking-tight">
            Pilotys
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
            Deux espaces : le cockpit propriétaire pour le quotidien, le back office pour configurer le système.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/owner/cockpit"
            className="rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-3xl">🧭</div>
            <h2 className="mt-4 text-xl font-black">Cockpit propriétaire</h2>
            <p className="mt-1 text-sm font-semibold text-white/70">
              KPIs, calendrier, alertes, missions et décisions opérationnelles.
            </p>
            <p className="mt-4 text-xs font-black text-white/50">Ouvrir →</p>
          </Link>

          <Link
            href="/admin/settings"
            className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-3xl">⚙️</div>
            <h2 className="mt-4 text-xl font-black">Back office</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Configurer les rappels, intervenantes, logements, paiements, accès et outils.
            </p>
            <p className="mt-4 text-xs font-black text-slate-400">Ouvrir →</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
