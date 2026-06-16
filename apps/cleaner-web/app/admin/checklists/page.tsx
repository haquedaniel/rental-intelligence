import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addChecklistSection,
  archiveChecklistSection,
  copyTemplateToProfile,
  createBlankChecklistForProfile,
  createStandardChecklistForProfile,
  updateChecklistSection,
  updateChecklistTemplate,
} from "./actions";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function selectedClass(isSelected: boolean): string {
  return isSelected
    ? "bg-slate-950 text-white"
    : "bg-slate-100 text-slate-700";
}

function photoRequirementLabel(value?: string): string {
  if (value === "required") return "Photo obligatoire";
  if (value === "optional") return "Photo optionnelle";
  return "Pas de photo";
}

function serviceLabel(value?: string): string {
  switch (value) {
    case "garden_lawn":
      return "Jardin / tonte";
    case "deep_cleaning":
      return "Grand ménage";
    case "linen_laundry":
      return "Linge / lessive";
    case "inventory_check":
      return "Contrôle inventaire";
    case "maintenance_check":
      return "Petite maintenance";
    case "other":
      return "Mission ponctuelle";
    default:
      return "Ménage standard";
  }
}

function checklistUrl(propertyId: string, profileId?: string): string {
  const params = new URLSearchParams();
  params.set("property", propertyId);
  if (profileId) params.set("profile", profileId);
  return `/admin/checklists?${params.toString()}`;
}

function sectionForm(section: Row) {
  return (
    <form
      key={section.id}
      action={updateChecklistSection}
      className={`rounded-3xl p-5 shadow-sm ring-1 ${
        section.active === false
          ? "bg-slate-50 opacity-70 ring-slate-200"
          : "bg-white ring-slate-200"
      }`}
    >
      <input type="hidden" name="id" value={section.id} />

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          {section.section_key}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          Ordre {section.sort_order ?? 100}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          {photoRequirementLabel(section.photo_requirement)}
        </span>
        {section.required ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            Obligatoire
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            Optionnelle
          </span>
        )}
        {section.active === false && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
            Masquée
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-bold text-slate-800">
            Titre
          </label>
          <input
            name="title"
            defaultValue={section.title ?? ""}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800">
            Case principale
          </label>
          <input
            name="high_level_check_label"
            defaultValue={section.high_level_check_label ?? ""}
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
            defaultValue={section.sort_order ?? 100}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800">
            Photos
          </label>
          <select
            name="photo_requirement"
            defaultValue={section.photo_requirement ?? "none"}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
          >
            <option value="none">Pas de photo</option>
            <option value="optional">Photo optionnelle</option>
            <option value="required">Photo obligatoire</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-bold text-slate-800">
          Points à vérifier
        </label>
        <textarea
          name="detail_items"
          rows={5}
          defaultValue={(section.detail_items ?? []).join("\n")}
          placeholder="Un point par ligne"
          className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">
          Un point par ligne. Les tirets sont acceptés.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          <input type="checkbox" name="required" defaultChecked={section.required !== false} />
          Rubrique obligatoire
        </label>

        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            name="visible_to_cleaner"
            defaultChecked={section.visible_to_cleaner !== false}
          />
          Visible pour l’intervenante
        </label>

        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          <input type="checkbox" name="active" defaultChecked={section.active !== false} />
          Active
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white"
        >
          Enregistrer cette rubrique
        </button>

        {section.active !== false && (
          <button
            formAction={archiveChecklistSection}
            className="rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-800 ring-1 ring-red-100"
          >
            Masquer
          </button>
        )}
      </div>
    </form>
  );
}

export default async function AdminChecklistsPage({
  searchParams,
}: {
  searchParams?: Promise<{ property?: string; profile?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const supabase = getSupabaseAdmin();

  const { data: propertiesData, error: propertiesError } = await supabase
    .from("properties")
    .select("*")
    .order("name", { ascending: true });

  if (propertiesError) {
    throw new Error(`Impossible de charger les logements : ${propertiesError.message}`);
  }

  const properties = propertiesData ?? [];
  const selectedPropertyId = params?.property ?? properties[0]?.id ?? "";

  const { data: profilesData, error: profilesError } = await supabase
    .from("property_cleaning_profiles")
    .select("*")
    .eq("property_id", selectedPropertyId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (profilesError) {
    throw new Error(`Impossible de charger les types de mission : ${profilesError.message}`);
  }

  const profiles = profilesData ?? [];
  const selectedProfileId = params?.profile ?? profiles[0]?.id ?? "";

  const { data: templatesData, error: templatesError } = selectedProfileId
    ? await supabase
        .from("cleaning_checklist_templates")
        .select("*")
        .eq("property_id", selectedPropertyId)
        .eq("cleaning_profile_id", selectedProfileId)
        .order("active", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (templatesError) {
    throw new Error(`Impossible de charger les checklists : ${templatesError.message}`);
  }

  const { data: legacyTemplatesData } = selectedPropertyId
    ? await supabase
        .from("cleaning_checklist_templates")
        .select("*")
        .eq("property_id", selectedPropertyId)
        .is("cleaning_profile_id", null)
        .order("active", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: [] };

  const templates = templatesData ?? [];
  const activeTemplate =
    templates.find((template) => template.active !== false) ?? templates[0] ?? null;

  const legacyTemplates = legacyTemplatesData ?? [];
  const legacyTemplate =
    legacyTemplates.find((template) => template.active !== false) ??
    legacyTemplates[0] ??
    null;

  const { data: sectionsData, error: sectionsError } = activeTemplate
    ? await supabase
        .from("cleaning_checklist_sections")
        .select("*")
        .eq("template_id", activeTemplate.id)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (sectionsError) {
    throw new Error(`Impossible de charger les rubriques : ${sectionsError.message}`);
  }

  const sections = sectionsData ?? [];
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId);
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-slate-950">
            Checklists de mission
          </h1>

          <p className="mt-2 text-slate-600">
            Une checklist est maintenant liée à un logement et à un type de mission.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-950">Logement</h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {properties.map((property) => (
              <Link
                key={property.id}
                href={checklistUrl(property.id)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${selectedClass(
                  property.id === selectedPropertyId,
                )}`}
              >
                {property.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Type de mission
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Sélectionnez le profil dont vous voulez modifier la checklist.
              </p>
            </div>

            <Link
              href="/admin/work-types"
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
            >
              Gérer les types
            </Link>
          </div>

          {profiles.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-100">
              Aucun type de mission actif pour ce logement. Créez-en un dans “Types de mission”.
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {profiles.map((profile) => (
                <Link
                  key={profile.id}
                  href={checklistUrl(selectedPropertyId, profile.id)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${selectedClass(
                    profile.id === selectedProfileId,
                  )}`}
                >
                  {profile.label ?? profile.code} · {serviceLabel(profile.service_type)}
                </Link>
              ))}
            </div>
          )}
        </section>

        {selectedProfile && (
          <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Contexte
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {selectedProperty?.name} · {selectedProfile.label ?? selectedProfile.code}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {selectedProfile.estimated_hours ?? "?"}h estimée(s) · {serviceLabel(selectedProfile.service_type)}
            </p>
          </section>
        )}

        {selectedPropertyId && selectedProfileId && (
          <section className="grid gap-4 md:grid-cols-3">
            <form
              action={createBlankChecklistForProfile}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <input type="hidden" name="property_id" value={selectedPropertyId} />
              <input type="hidden" name="cleaning_profile_id" value={selectedProfileId} />

              <h2 className="text-lg font-bold text-slate-950">
                Créer vierge
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Remplace uniquement la checklist active de ce type de mission.
              </p>

              <input
                name="name"
                defaultValue={selectedProfile?.label ?? "Nouvelle checklist"}
                className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />

              <input
                name="estimated_minutes"
                type="number"
                defaultValue={Math.round(Number(selectedProfile?.estimated_hours ?? 2) * 60)}
                className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />

              <button className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white">
                Créer vierge
              </button>
            </form>

            <form
              action={createStandardChecklistForProfile}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <input type="hidden" name="property_id" value={selectedPropertyId} />
              <input type="hidden" name="cleaning_profile_id" value={selectedProfileId} />

              <h2 className="text-lg font-bold text-slate-950">
                Installer standard
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Crée une checklist ménage standard pour ce type de mission.
              </p>

              <input
                name="name"
                defaultValue={selectedProfile?.label ?? "Ménage standard"}
                className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />

              <input
                name="estimated_minutes"
                type="number"
                defaultValue={Math.round(Number(selectedProfile?.estimated_hours ?? 2) * 60)}
                className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm"
              />

              <button className="mt-4 w-full rounded-2xl bg-emerald-700 px-4 py-3 font-bold text-white">
                Installer standard
              </button>
            </form>

            <form
              action={copyTemplateToProfile}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <input type="hidden" name="property_id" value={selectedPropertyId} />
              <input type="hidden" name="cleaning_profile_id" value={selectedProfileId} />
              <input type="hidden" name="source_template_id" value={legacyTemplate?.id ?? ""} />

              <h2 className="text-lg font-bold text-slate-950">
                Copier l’ancienne
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Utile pour rattacher votre checklist historique à un type de mission.
              </p>

              <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                {legacyTemplate ? (
                  <>
                    <p className="font-bold">{legacyTemplate.name}</p>
                    <p>{legacyTemplate.estimated_minutes} minutes</p>
                  </>
                ) : (
                  <p>Aucune checklist historique disponible.</p>
                )}
              </div>

              <button
                disabled={!legacyTemplate}
                className="mt-4 w-full rounded-2xl bg-amber-600 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Copier vers ce type
              </button>
            </form>
          </section>
        )}

        {activeTemplate && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-950">
              Checklist active
            </h2>

            <form action={updateChecklistTemplate} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={activeTemplate.id} />

              <div className="grid gap-4 md:grid-cols-[1fr_220px_140px]">
                <div>
                  <label className="block text-sm font-bold text-slate-800">
                    Nom
                  </label>
                  <input
                    name="name"
                    defaultValue={activeTemplate.name ?? ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800">
                    Durée en minutes
                  </label>
                  <input
                    name="estimated_minutes"
                    type="number"
                    defaultValue={activeTemplate.estimated_minutes ?? 120}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                <label className="mt-7 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  <input type="checkbox" name="active" defaultChecked={activeTemplate.active !== false} />
                  Active
                </label>
              </div>

              <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white">
                Enregistrer la checklist
              </button>
            </form>
          </section>
        )}

        {!activeTemplate && selectedProfileId && (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-950">
              Pas encore de checklist pour ce type de mission
            </h2>
            <p className="mt-2 text-slate-600">
              Créez une checklist vierge, installez une checklist standard, ou copiez votre ancienne checklist.
            </p>
          </section>
        )}

        {activeTemplate && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-950">
              Ajouter une rubrique
            </h2>

            <form action={addChecklistSection} className="mt-5 space-y-4">
              <input type="hidden" name="template_id" value={activeTemplate.id} />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-bold text-slate-800">
                    Titre
                  </label>
                  <input
                    name="title"
                    placeholder="Ex : Terrasse"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800">
                    Case principale à valider
                  </label>
                  <input
                    name="high_level_check_label"
                    placeholder="Ex : Terrasse propre et rangée"
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

                <div>
                  <label className="block text-sm font-bold text-slate-800">
                    Photos
                  </label>
                  <select
                    name="photo_requirement"
                    defaultValue="none"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  >
                    <option value="none">Pas de photo</option>
                    <option value="optional">Photo optionnelle</option>
                    <option value="required">Photo obligatoire</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800">
                  Points à vérifier
                </label>
                <textarea
                  name="detail_items"
                  rows={5}
                  placeholder={"Un point par ligne\nEx : Table propre\nEx : Chaises rangées"}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  <input type="checkbox" name="required" defaultChecked />
                  Rubrique obligatoire
                </label>

                <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  <input type="checkbox" name="visible_to_cleaner" defaultChecked />
                  Visible pour l’intervenante
                </label>
              </div>

              <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white">
                Ajouter la rubrique
              </button>
            </form>
          </section>
        )}

        {activeTemplate && (
          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Rubriques existantes
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {sections.length} rubrique(s) pour cette checklist.
              </p>
            </div>

            {sections.length === 0 ? (
              <div className="rounded-3xl bg-white p-5 text-slate-600 shadow-sm ring-1 ring-slate-200">
                Aucune rubrique pour l’instant.
              </div>
            ) : (
              sections.map((section) => sectionForm(section))
            )}
          </section>
        )}
      </div>
    </main>
  );
}
