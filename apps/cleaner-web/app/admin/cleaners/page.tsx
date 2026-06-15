import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import {
  createCleaner,
  updateCleaner,
  updatePropertyCleaner,
} from "./actions";

export const dynamic = "force-dynamic";

function fullName(cleaner: any) {
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ");
}

export default async function AdminCleanersPage() {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const { data: cleaners } = await supabase
    .from("cleaners")
    .select(
      "id,first_name,last_name,phone,email,hourly_rate_eur,included_radius_km,travel_rate_per_km_eur,active,notes",
    )
    .order("first_name", { ascending: true });

  const { data: properties } = await supabase
    .from("properties")
    .select("id,name,address,preferred_cleaner_id")
    .order("name", { ascending: true });

  const activeCleaners = (cleaners ?? []).filter((cleaner) => cleaner.active);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Intervenantes ménage
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Gérez les personnes disponibles, leurs coordonnées, tarifs et
            affectations par logement.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-950">
            Ajouter une intervenante
          </h2>

          <form action={createCleaner} className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Prénom
              </label>
              <input
                name="first_name"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Nom
              </label>
              <input
                name="last_name"
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Téléphone WhatsApp
              </label>
              <input
                name="phone"
                placeholder="+336..."
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Email
              </label>
              <input
                name="email"
                type="email"
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Tarif horaire (€)
              </label>
              <input
                name="hourly_rate_eur"
                type="number"
                step="0.01"
                defaultValue={18}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Rayon inclus (km)
              </label>
              <input
                name="included_radius_km"
                type="number"
                step="0.1"
                defaultValue={0}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Déplacement €/km
              </label>
              <input
                name="travel_rate_per_km_eur"
                type="number"
                step="0.01"
                defaultValue={0}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-800">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
              >
                Ajouter
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-950">
            Affectation par logement
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Cette affectation est utilisée par la génération automatique des
            missions.
          </p>

          <div className="mt-4 space-y-4">
            {(properties ?? []).map((property) => (
              <form
                key={property.id}
                action={updatePropertyCleaner}
                className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_260px_120px]"
              >
                <input type="hidden" name="property_id" value={property.id} />

                <div>
                  <p className="font-semibold text-slate-950">
                    {property.name}
                  </p>
                  {property.address && (
                    <p className="mt-1 text-sm text-slate-500">
                      {property.address}
                    </p>
                  )}
                </div>

                <select
                  name="preferred_cleaner_id"
                  defaultValue={property.preferred_cleaner_id ?? ""}
                  className="rounded-xl border border-slate-300 p-2 text-sm"
                >
                  <option value="">Aucune</option>
                  {activeCleaners.map((cleaner) => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {fullName(cleaner)}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                >
                  Enregistrer
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="px-1 text-lg font-bold text-slate-950">
            Intervenantes existantes
          </h2>

          {(cleaners ?? []).map((cleaner) => (
            <div
              key={cleaner.id}
              className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ${
                cleaner.active ? "ring-slate-200" : "opacity-60 ring-red-200"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-2 text-xl font-bold text-slate-950">
                  {fullName(cleaner)}
                </h3>

                {cleaner.active ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                    Désactivée
                  </span>
                )}
              </div>

              <form
                action={updateCleaner}
                className="mt-4 grid gap-4 md:grid-cols-2"
              >
                <input type="hidden" name="cleaner_id" value={cleaner.id} />

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Prénom
                  </label>
                  <input
                    name="first_name"
                    defaultValue={cleaner.first_name ?? ""}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Nom
                  </label>
                  <input
                    name="last_name"
                    defaultValue={cleaner.last_name ?? ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Téléphone WhatsApp
                  </label>
                  <input
                    name="phone"
                    defaultValue={cleaner.phone ?? ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={cleaner.email ?? ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Tarif horaire (€)
                  </label>
                  <input
                    name="hourly_rate_eur"
                    type="number"
                    step="0.01"
                    defaultValue={cleaner.hourly_rate_eur ?? 18}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Rayon inclus (km)
                  </label>
                  <input
                    name="included_radius_km"
                    type="number"
                    step="0.1"
                    defaultValue={cleaner.included_radius_km ?? 0}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Déplacement €/km
                  </label>
                  <input
                    name="travel_rate_per_km_eur"
                    type="number"
                    step="0.01"
                    defaultValue={cleaner.travel_rate_per_km_eur ?? 0}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <label className="flex items-center gap-2 self-end rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={cleaner.active}
                  />
                  Active
                </label>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={cleaner.notes ?? ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
