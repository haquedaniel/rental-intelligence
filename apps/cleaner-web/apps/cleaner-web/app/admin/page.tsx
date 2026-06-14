import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { logoutAdmin } from "./login/actions";

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Back office
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">
              Réglages ménage
            </h1>
          </div>

          <form action={logoutAdmin}>
            <button
              type="submit"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Déconnexion
            </button>
          </form>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/photos"
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <h2 className="text-lg font-bold text-slate-950">
              Photos modèles
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Ajouter les photos de couverture et les photos modèles par rubrique.
            </p>
          </Link>

          <div className="rounded-3xl bg-white p-5 opacity-60 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-950">
              Checklists
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Prochaine étape : modifier les rubriques et points à vérifier.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
