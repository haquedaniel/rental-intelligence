import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-3 py-4 text-[#112532] sm:px-6">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8"><span className="h-2 w-2 rounded-full bg-[#E0680E]" />Pilotys · opération</div>
        <div className="mx-auto max-w-4xl space-y-4">
        <header>
          <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
            Accueil
          </p>
          <h1 className="text-3xl font-black tracking-tight">
            Pilotys
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[#112532]/48">
            Deux espaces : le cockpit propriétaire pour le quotidien, le back office pour configurer le système.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/owner/cockpit"
            className="rounded-[1.5rem] bg-[#112532] p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
            className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/10 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-3xl">⚙️</div>
            <h2 className="mt-4 text-xl font-black">Back office</h2>
            <p className="mt-1 text-sm font-semibold text-[#112532]/48">
              Configurer les rappels, intervenantes, logements, paiements, accès et outils.
            </p>
            <p className="mt-4 text-xs font-black text-[#112532]/36">Ouvrir →</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
