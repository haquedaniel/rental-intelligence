import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { submitInterventionReport } from "./actions";
import { CleanerPreparationNoteBanner } from "@/components/cleaner/CleanerPreparationNoteBanner";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0 €";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(number);
}

export default async function InterventionReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: request, error } = await supabase
    .from("cleaning_requests")
    .select("*,properties(*),cleaners(*)")
    .eq("public_token", token)
    .eq("mission_type", "intervention")
    .maybeSingle();

  if (error || !request) notFound();

  let referencePhotoUrl: string | null = null;
  if (request.reference_photo_path) {
    const { data } = await supabase.storage
      .from(request.reference_photo_bucket || "intervention-reference-photos")
      .createSignedUrl(request.reference_photo_path, 60 * 60);

    referencePhotoUrl = data?.signedUrl ?? null;
  }

  const cleanerToken = request.cleaners?.public_token ?? null;
  const estimatedHours = Number(request.estimated_hours ?? 1);
  const hourlyRate = Number(request.hourly_rate_eur_snapshot ?? 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5 pb-24">\
        <CleanerPreparationNoteBanner missionToken={token} />

        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Rapport d’intervention
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {request.title}
          </h1>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">Mission demandée</h2>

          {referencePhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={referencePhotoUrl}
              alt=""
              className="mt-4 max-h-80 w-full rounded-2xl object-cover ring-1 ring-slate-200"
            />
          )}

          <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
            {request.mission_description || "Aucune consigne détaillée."}
          </p>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
            Temps prévu : {estimatedHours} h · base {money(hourlyRate)}/h
          </div>
        </section>

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

          <label className="block rounded-2xl bg-slate-50 p-4">
            <span className="text-sm font-bold text-slate-800">Temps réel passé</span>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Prérempli avec le temps prévu. À modifier seulement si l’écart est significatif.
            </p>
            <input
              name="actual_hours"
              type="number"
              step="0.25"
              required
              defaultValue={estimatedHours}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
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
            <details className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <summary className="cursor-pointer font-black text-amber-950">
                Ajouter des frais matériel
              </summary>
              <p className="mt-2 text-sm font-semibold text-amber-900/70">
                À utiliser seulement si vous avez acheté du matériel pour cette intervention.
              </p>

              <div className="mt-4 space-y-3">
                {[1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[1fr_140px]">
                    <input
                      name={`expense_label_${index}`}
                      placeholder={`Libellé ${index}`}
                      className="rounded-xl border border-amber-200 bg-white p-2 text-sm"
                    />
                    <input
                      name={`expense_amount_${index}`}
                      type="number"
                      step="0.01"
                      placeholder="Montant €"
                      className="rounded-xl border border-amber-200 bg-white p-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </details>
          )}

          <button className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-lg font-black text-white">
            Envoyer le rapport
          </button>
        </form>

        {cleanerToken && (
          <Link href={`/cleaner/${cleanerToken}`} className="block text-center text-sm font-bold text-slate-500">
            Retour aux missions
          </Link>
        )}
      </div>
    </main>
  );
}