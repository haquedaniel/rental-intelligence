import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { archiveWorkType, createWorkType, updateWorkType } from "./actions";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

const SERVICE_OPTIONS = [
  ["standard_cleaning", "Ménage standard"],
  ["deep_cleaning", "Grand ménage"],
  ["linen_laundry", "Linge / lessive"],
  ["inventory_check", "Contrôle inventaire"],
  ["garden_lawn", "Jardin / tonte"],
  ["maintenance_check", "Petite maintenance"],
  ["other", "Mission ponctuelle"],
];

function serviceLabel(value?: string): string {
  return SERVICE_OPTIONS.find(([key]) => key === value)?.[1] ?? value ?? "Mission";
}

function serviceBadgeClass(value?: string): string {
  switch (value) {
    case "garden_lawn":
      return "bg-emerald-100 text-emerald-800";
    case "deep_cleaning":
      return "bg-violet-100 text-violet-800";
    case "linen_laundry":
      return "bg-sky-100 text-sky-800";
    case "inventory_check":
      return "bg-amber-100 text-amber-900";
    case "maintenance_check":
      return "bg-orange-100 text-orange-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function numberLabel(value: unknown): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "—";
}

function profileCard(profile: Row) {
  return (
    <form
      key={profile.id}
      action={updateWorkType}
      className={`rounded-3xl p-5 shadow-sm ring-1 ${
        profile.active === false
          ? "bg-slate-50 ring-slate-200 opacity-70"
          : "bg-white ring-slate-200"
      }`}
    >
      <input type="hidden" name="id" value={profile.id} />

      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${serviceBadgeClass(profile.service_type)}`}>
          {serviceLabel(profile.service_type)}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          {numberLabel(profile.estimated_hours)}h
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          Ordre {profile.sort_order ?? 100}
        </span>

        {profile.active === false ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
            Inactif
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            Actif
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-bold text-slate-800">
            Nom affiché
          </label>
          <input
            name="label"
            defaultValue={profile.label ?? ""}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800">
            Code interne
          </label>
          <input
            name="code"
            defaultValue={profile.code ?? ""}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800">
            Catégorie
          </label>
          <select
            name="service_type"
            defaultValue={profile.service_type ?? "standard_cleaning"}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
          >
            {SERVICE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800">
            Durée estimée
          </label>
          <input
            name="estimated_hours"
            type="number"
            min="0.25"
            step="0.25"
            defaultValue={profile.estimated_hours ?? 2}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800">
            Ordre
          </label>
          <input
            name="sort_order"
            type="number"
            defaultValue={profile.sort_order ?? 100}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-bold text-slate-800">
          Description / usage
        </label>
        <textarea
          name="description"
          rows={2}
          defaultValue={profile.description ?? ""}
          placeholder="Ex : tonte du jardin, nettoyage vitres, grand ménage après travaux..."
          className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            name="default_linen_required"
            defaultChecked={profile.default_linen_required !== false}
          />
          Linge par défaut
        </label>

        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            name="default_laundry_required"
            defaultChecked={profile.default_laundry_required !== false}
          />
          Lessive par défaut
        </label>

        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={profile.active !== false}
          />
          Actif
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white"
        >
          Enregistrer
        </button>

        {profile.active !== false && (
          <button
            formAction={archiveWorkType}
            className="rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-800 ring-1 ring-red-100"
          >
            Désactiver
          </button>
        )}
      </div>
    </form>
  );
}

export default async function AdminWorkTypesPage() {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const { data: propertiesData, error: propertiesError } = await supabase
    .from("properties")
    .select("*")
    .order("name", { ascending: true });

  if (propertiesError) {
    throw new Error(`Impossible de charger les logements : ${propertiesError.message}`);
  }

  const { data: profilesData, error: profilesError } = await supabase
    .from("property_cleaning_profiles")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (profilesError) {
    throw new Error(`Impossible de charger les types de mission : ${profilesError.message}`);
  }

  const properties = propertiesData ?? [];
  const profiles = profilesData ?? [];

  const profilesByProperty: Record<string, Row[]> = {};

  for (const profile of profiles) {
    const propertyId = String(profile.property_id);
    profilesByProperty[propertyId] = profilesByProperty[propertyId] ?? [];
    profilesByProperty[propertyId].push(profile);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Paramétrage opérations
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Types de mission
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Ces profils apparaissent dans le formulaire de création de mission :
            ménage léger, grand ménage, tonte du jardin, contrôle linge, petite
            maintenance, etc.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-950">
            Ajouter un type de mission
          </h2>

          <form action={createWorkType} className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-slate-800">
                Logement
              </label>
              <select
                name="property_id"
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                required
              >
                <option value="">Choisir...</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800">
                Nom du type
              </label>
              <input
                name="label"
                placeholder="Tonte du jardin"
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800">
                Code interne
              </label>
              <input
                name="code"
                placeholder="garden_lawn"
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800">
                Catégorie
              </label>
              <select
                name="service_type"
                defaultValue="garden_lawn"
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
              >
                {SERVICE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800">
                Durée estimée
              </label>
              <input
                name="estimated_hours"
                type="number"
                min="0.25"
                step="0.25"
                defaultValue="1.5"
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800">
                Ordre
              </label>
              <input
                name="sort_order"
                type="number"
                defaultValue="100"
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-800">
                Description / usage
              </label>
              <textarea
                name="description"
                rows={2}
                placeholder="Ex : tonte du jardin et débroussaillage léger..."
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
              <input type="checkbox" name="default_linen_required" />
              Linge par défaut
            </label>

            <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
              <input type="checkbox" name="default_laundry_required" />
              Lessive par défaut
            </label>

            <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
              <input type="checkbox" name="active" defaultChecked />
              Actif
            </label>

            <button
              type="submit"
              className="rounded-2xl bg-slate-950 px-4 py-4 font-bold text-white md:col-span-2"
            >
              Ajouter le type de mission
            </button>
          </form>
        </section>

        {properties.map((property) => {
          const propertyProfiles = profilesByProperty[property.id] ?? [];

          return (
            <section key={property.id} className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  {property.name}
                </h2>
                <p className="text-sm text-slate-500">
                  {propertyProfiles.length} type(s) de mission
                </p>
              </div>

              <div className="grid gap-4">
                {propertyProfiles.length === 0 ? (
                  <div className="rounded-3xl bg-white p-5 text-slate-600 shadow-sm ring-1 ring-slate-200">
                    Aucun type de mission configuré.
                  </div>
                ) : (
                  propertyProfiles.map((profile) => profileCard(profile))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
