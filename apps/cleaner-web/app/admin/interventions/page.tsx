import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createInterventionMission } from "./actions";

export const dynamic = "force-dynamic";

function nameFor(row: Record<string, any>) {
  return row.name || row.title || row.display_name || row.internal_name || row.first_name || "Sans nom";
}

function cleanerName(row: Record<string, any>) {
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.trading_name || "Intervenant";
}

export default async function AdminInterventionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const supabase = getSupabaseAdmin();

  const [{ data: properties }, { data: cleaners }, { data: recent }] = await Promise.all([
    supabase.from("properties").select("*").order("name", { ascending: true }),
    supabase.from("cleaners").select("*").order("first_name", { ascending: true }),
    supabase
      .from("cleaning_requests")
      .select("id,title,status,scheduled_end_at,total_cost_eur,public_token,created_at,properties(*),cleaners(*)")
      .eq("mission_type", "intervention")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-4 py-6">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8"><span className="h-2 w-2 rounded-full bg-[#E0680E]" />Pilotys · opération</div>
        <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-[#112532]/62">
            ← Back office
          </Link>

          <h1 className="mt-3 text-3xl font-black text-[#112532]">
            Missions ponctuelles
          </h1>

          <p className="mt-2 max-w-3xl text-sm font-medium text-[#112532]/62">
            Réparations, jardinage, contrôle ponctuel, petit entretien. Ces missions ne dépendent pas d’un séjour
            et n’utilisent pas de checklist ménage.
          </p>
        </div>

        {params.created && (
          <div className="rounded-2xl bg-[#ECFFF6] p-4 text-sm font-bold text-emerald-900 ring-1 ring-emerald-100">
            Intervention créée et SMS mis en file d’attente.
          </div>
        )}

        <section className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8">
          <h2 className="text-xl font-black text-[#112532]">
            Créer une intervention
          </h2>

          <form action={createInterventionMission} encType="multipart/form-data" className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-[#112532]/86">Logement</span>
                <select name="property_id" required className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm">
                  <option value="">Choisir…</option>
                  {(properties ?? []).map((property: any) => (
                    <option key={property.id} value={property.id}>
                      {nameFor(property)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-[#112532]/86">Intervenant</span>
                <select name="cleaner_id" required className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm">
                  <option value="">Choisir…</option>
                  {(cleaners ?? []).map((cleaner: any) => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {cleanerName(cleaner)} · {cleaner.hourly_rate_eur ?? 0} €/h
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <label className="block">
                <span className="text-sm font-bold text-[#112532]/86">Titre de la mission</span>
                <input
                  name="title"
                  required
                  placeholder="Ex : Peinture salle de bain suite au dégât des eaux"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-[#112532]/86">Catégorie</span>
                <select name="mission_category" className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm">
                  <option value="repair">Petite réparation</option>
                  <option value="garden">Jardin / tonte</option>
                  <option value="inspection">Contrôle</option>
                  <option value="inventory">Inventaire</option>
                  <option value="other">Autre</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-[#112532]/86">Description / consignes</span>
              <textarea
                name="mission_description"
                rows={5}
                placeholder="Décrire clairement ce qui doit être fait, où se trouve le problème, comment accéder, matériel à prévoir..."
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-[#112532]/86">Début possible</span>
                <input name="scheduled_start_at" type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm" />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-[#112532]/86">À faire avant</span>
                <input name="deadline_at" required type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm" />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="block">
                <span className="text-sm font-bold text-[#112532]/86">Heures estimées</span>
                <input name="estimated_hours" type="number" step="0.25" defaultValue="1" className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm" />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-[#112532]/86">Tarif horaire €</span>
                <input name="hourly_rate_eur" type="number" step="0.01" defaultValue="20" className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm" />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-[#112532]/86">Preuve photo</span>
                <select name="proof_photo_requirement" defaultValue="optional" className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm">
                  <option value="none">Aucune</option>
                  <option value="optional">Optionnelle</option>
                  <option value="required">Obligatoire</option>
                </select>
              </label>

              <label className="flex items-end gap-2 rounded-xl bg-[#F6F3EF] p-3 text-sm font-bold text-[#112532]/76">
                <input name="allow_material_expenses" type="checkbox" defaultChecked />
                Frais matériel autorisés
              </label>
            </div>

            <div className="rounded-2xl bg-[#FFF5DD] p-4 ring-1 ring-amber-100">
              <label className="flex gap-3 text-sm font-bold text-amber-950">
                <input name="allow_occupied_intervention" type="checkbox" />
                <span>
                  Autoriser l’intervenant à choisir un créneau même si le logement est occupé. Un avertissement sera affiché au moment du choix.
                </span>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-[#112532]/86">Photo de référence optionnelle</span>
              <input name="reference_photo" type="file" accept="image/*" className="mt-2 block w-full text-sm" />
            </label>

            <button className="w-full rounded-2xl bg-[#112532] px-5 py-3 font-black text-white">
              Créer et envoyer la mission
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-[#112532]">Dernières interventions</h2>

          {(recent ?? []).map((request: any) => (
            <div key={request.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#112532]/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-[#112532]">{request.title}</p>
                  <p className="mt-1 text-sm font-semibold text-[#112532]/48">
                    {nameFor(request.properties ?? {})} · {cleanerName(request.cleaners ?? {})}
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-[#112532]/76">
                  {request.status}
                </span>
              </div>

              {request.public_token && (
                <a
                  href={`/mission/${request.public_token}/intervention`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-bold text-[#112532] underline"
                >
                  Ouvrir la mission
                </a>
              )}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
