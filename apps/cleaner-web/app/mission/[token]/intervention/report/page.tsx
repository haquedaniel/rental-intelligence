import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { submitInterventionReport } from "./actions";

export const dynamic = "force-dynamic";

export default async function InterventionReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: request, error } = await getSupabaseAdmin()
    .from("cleaning_requests")
    .select("*,properties(*),cleaners(*)")
    .eq("public_token", token)
    .eq("mission_type", "intervention")
    .maybeSingle();

  if (error || !request) notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Rapport d’intervention
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {request.title}
          </h1>
        </div>

        <form action={submitInterventionReport} encType="multipart/form-data" className="space-y-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <input type="hidden" name="token" value={token} />

          <label className="block">
            <span className="text-sm font-bold text-slate-800">Résultat</span>
            <select name="status" className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm">
              <option value="completed">Terminé</option>
              <option value="completed_with_notes">Terminé avec remarque</option>
              <option value="problem">Impossible / problème</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-800">Ce qui a été fait</span>
            <textarea
              name="work_summary"
              required
              rows={5}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
              placeholder="Décrire simplement le travail réalisé."
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-800">Remarque / suite à prévoir</span>
            <textarea
              name="issue_notes"
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
              placeholder="Optionnel."
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-800">Temps réel passé</span>
            <input
              name="actual_hours"
              type="number"
              step="0.25"
              required
              defaultValue={request.estimated_hours ?? 1}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
            />
          </label>

          <label className="block rounded-2xl bg-slate-50 p-4">
            <span className="text-sm font-bold text-slate-800">
              Photos {request.proof_photo_requirement === "required" ? "obligatoires" : "optionnelles"}
            </span>
            <input
              name="proof_photos"
              type="file"
              accept="image/*"
              multiple
              required={request.proof_photo_requirement === "required"}
              className="mt-2 block w-full text-sm"
            />
          </label>

          {request.allow_material_expenses && (
            <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <h2 className="font-black text-amber-950">Frais matériel</h2>
              <p className="mt-1 text-sm font-semibold text-amber-900/70">
                Ajoutez uniquement les achats nécessaires à cette intervention.
              </p>

              <div className="mt-4 space-y-3">
                {[1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[1fr_140px]">
                    <input
                      name={`expense_label_${index}`}
                      placeholder={`Libellé ${index}`}
                      className="rounded-xl border border-amber-200 p-2 text-sm"
                    />
                    <input
                      name={`expense_amount_${index}`}
                      type="number"
                      step="0.01"
                      placeholder="Montant €"
                      className="rounded-xl border border-amber-200 p-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <button className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-lg font-black text-white">
            Envoyer le rapport
          </button>
        </form>
      </div>
    </main>
  );
}
