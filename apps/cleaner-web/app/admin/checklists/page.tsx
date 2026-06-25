import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addChecklistSection,
  archiveChecklistSection,
  archiveSimpleChecklist,
  createSimpleChecklist,
  updateChecklistSection,
  updateSimpleChecklist,
} from "./actions";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;
type ChecklistTranslationLanguage = "en" | "ru";

function sectionTranslation(section: Row, language: ChecklistTranslationLanguage): Row {
  return section.translations?.[language] ?? {};
}

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

function checklistUrl(propertyId: string, checklistId?: string): string {
  const params = new URLSearchParams();
  params.set("property", propertyId);
  if (checklistId) params.set("checklist", checklistId);
  return `/admin/checklists?${params.toString()}`;
}

function durationLabel(profile: Row): string {
  const hours = Number(profile.estimated_hours ?? 0);
  if (!hours) return "durée non définie";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${String(hours).replace(".", ",")} h`;
}

function ChecklistCard({
  profile,
  selectedPropertyId,
  isSelected,
}: {
  profile: Row;
  selectedPropertyId: string;
  isSelected: boolean;
}) {
  return (
    <Link
      href={checklistUrl(selectedPropertyId, profile.id)}
      className={`block rounded-[1.25rem] p-4 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${
        isSelected
          ? "bg-slate-950 text-white ring-slate-950"
          : "bg-white text-slate-950 ring-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">{profile.label ?? profile.code}</h3>
          <p className={`mt-1 text-xs font-semibold ${isSelected ? "text-white/60" : "text-slate-500"}`}>
            {serviceLabel(profile.service_type)} · {durationLabel(profile)}
          </p>
        </div>

        <span
          className={`rounded-full px-2 py-1 text-[10px] font-black ${
            profile.active === false
              ? "bg-red-100 text-red-800"
              : isSelected
                ? "bg-white/15 text-white"
                : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {profile.active === false ? "Inactive" : "Active"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {profile.default_linen_required && (
          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${isSelected ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-600"}`}>
            Linge
          </span>
        )}
        {profile.default_laundry_required && (
          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${isSelected ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-600"}`}>
            Lessive
          </span>
        )}
        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${isSelected ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-600"}`}>
          Ordre {profile.sort_order ?? 100}
        </span>
      </div>

      <p className={`mt-4 text-xs font-black ${isSelected ? "text-white/50" : "text-slate-400"}`}>
        {isSelected ? "Sélectionnée" : "Modifier →"}
      </p>
    </Link>
  );
}

function SectionForm({ section }: { section: Row }) {
  return (
    <form
      key={section.id}
      action={updateChecklistSection}
      className={`rounded-[1.25rem] p-4 shadow-sm ring-1 ${
        section.active === false
          ? "bg-slate-50 opacity-70 ring-slate-200"
          : "bg-white ring-slate-200"
      }`}
    >
      <input type="hidden" name="id" value={section.id} />

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
          {section.section_key}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
          Ordre {section.sort_order ?? 100}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
          {photoRequirementLabel(section.photo_requirement)}
        </span>
        {section.required ? (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800">
            Obligatoire
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
            Optionnelle
          </span>
        )}
        {section.active === false && (
          <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-black text-red-800">
            Masquée
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Section
          </span>
          <input
            name="title"
            defaultValue={section.title ?? ""}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Case principale à cocher
          </span>
          <input
            name="high_level_check_label"
            defaultValue={section.high_level_check_label ?? ""}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Ordre
          </span>
          <input
            name="sort_order"
            type="number"
            defaultValue={section.sort_order ?? 100}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Photos pour cette section
          </span>
          <select
            name="photo_requirement"
            defaultValue={section.photo_requirement ?? "none"}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
          >
            <option value="none">Pas de photo</option>
            <option value="optional">Photo optionnelle</option>
            <option value="required">Photo obligatoire</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Tâches / points de contrôle
        </span>
        <textarea
          name="detail_items"
          rows={5}
          defaultValue={(section.detail_items ?? []).join("\n")}
          placeholder="Un point par ligne"
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900"
        />
      </label>

      <details className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">
          Traductions intervenantes EN / RU
        </summary>

        <p className="mt-2 text-xs font-semibold text-slate-500">
          Le français reste la version canonique. Si une traduction est vide, l’app utilisera le texte français.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {(["en", "ru"] as const).map((language) => {
            const translation = sectionTranslation(section, language);
            const label = language === "en" ? "Anglais" : "Russe";

            return (
              <div key={language} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <h4 className="text-sm font-black text-slate-950">{label}</h4>

                <label className="mt-3 block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Section
                  </span>
                  <input
                    name={`${language}_title`}
                    defaultValue={translation.title ?? ""}
                    placeholder={section.title ?? ""}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
                  />
                </label>

                <label className="mt-3 block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Case principale
                  </span>
                  <input
                    name={`${language}_high_level_check_label`}
                    defaultValue={translation.high_level_check_label ?? ""}
                    placeholder={section.high_level_check_label ?? ""}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
                  />
                </label>

                <label className="mt-3 block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Tâches traduites
                  </span>
                  <textarea
                    name={`${language}_detail_items`}
                    rows={5}
                    defaultValue={(translation.detail_items ?? []).join("\n")}
                    placeholder={(section.detail_items ?? []).join("\n")}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </details>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" name="required" defaultChecked={section.required !== false} />
          Obligatoire
        </label>

        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            name="visible_to_cleaner"
            defaultChecked={section.visible_to_cleaner !== false}
          />
          Visible intervenante
        </label>

        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" name="active" defaultChecked={section.active !== false} />
          Active
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          className="flex-1 rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
        >
          Enregistrer
        </button>

        {section.active !== false && (
          <button
            formAction={archiveChecklistSection}
            className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-800 ring-1 ring-red-100"
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
  searchParams?: Promise<{ property?: string; checklist?: string }>;
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

  const { data: profilesData, error: profilesError } = selectedPropertyId
    ? await supabase
        .from("property_cleaning_profiles")
        .select("*")
        .eq("property_id", selectedPropertyId)
        .order("active", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true })
    : { data: [], error: null };

  if (profilesError) {
    throw new Error(`Impossible de charger les checklists : ${profilesError.message}`);
  }

  const profiles = profilesData ?? [];
  const selectedProfileId =
    params?.checklist ??
    profiles.find((profile) => profile.active !== false)?.id ??
    profiles[0]?.id ??
    "";

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;

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
    throw new Error(`Impossible de charger le contenu de checklist : ${templatesError.message}`);
  }

  const templates = templatesData ?? [];
  const activeTemplate =
    templates.find((template) => template.active !== false) ?? templates[0] ?? null;

  const { data: sectionsData, error: sectionsError } = activeTemplate
    ? await supabase
        .from("cleaning_checklist_sections")
        .select("*")
        .eq("template_id", activeTemplate.id)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (sectionsError) {
    throw new Error(`Impossible de charger les sections : ${sectionsError.message}`);
  }

  const sectionRows = sectionsData ?? [];
  const sectionIds = sectionRows
    .map((section) => section.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const { data: sectionTranslationsData, error: sectionTranslationsError } = sectionIds.length > 0
    ? await supabase
        .from("cleaning_checklist_section_translations")
        .select("section_id,language,title,high_level_check_label,detail_items")
        .in("section_id", sectionIds)
    : { data: [], error: null };

  if (sectionTranslationsError) {
    throw new Error(`Impossible de charger les traductions : ${sectionTranslationsError.message}`);
  }

  const translationsBySectionId = new Map<string, Record<ChecklistTranslationLanguage, Row>>();

  for (const translation of sectionTranslationsData ?? []) {
    const language = translation.language as ChecklistTranslationLanguage;
    if (language !== "en" && language !== "ru") continue;

    const current = translationsBySectionId.get(translation.section_id) ?? { en: {}, ru: {} };
    current[language] = translation;
    translationsBySectionId.set(translation.section_id, current);
  }

  const sections = sectionRows.map((section) => ({
    ...section,
    translations: translationsBySectionId.get(section.id) ?? { en: {}, ru: {} },
  }));

  const selectedProperty = properties.find((property) => property.id === selectedPropertyId);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin/settings" className="text-sm font-semibold text-slate-500">
              ← Back office
            </Link>

            <h1 className="mt-4 text-3xl font-black tracking-tight">
              Checklists par logement
            </h1>

            <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
              Chaque logement peut avoir plusieurs checklists : ménage léger, ménage standard,
              grand ménage, jardinage, petite maintenance ou mission ponctuelle.
            </p>
          </div>

          <Link
            href="/admin/photos"
            className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            Photos
          </Link>
        </header>

        <section className="rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Logement
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {properties.map((property) => (
              <Link
                key={property.id}
                href={checklistUrl(property.id)}
                className={`rounded-full px-3 py-2 text-xs font-black ${selectedClass(
                  property.id === selectedPropertyId,
                )}`}
              >
                {property.name}
              </Link>
            ))}
          </div>
        </section>

        {selectedPropertyId && (
          <section className="rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Checklists disponibles
                </p>
                <h2 className="text-xl font-black text-slate-950">
                  {selectedProperty?.name ?? "Logement"}
                </h2>
              </div>

              <details className="w-full rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 md:w-auto md:min-w-[360px]">
                <summary className="cursor-pointer text-sm font-black text-slate-950">
                  + Créer une checklist
                </summary>

                <form action={createSimpleChecklist} className="mt-3 grid gap-3">
                  <input type="hidden" name="property_id" value={selectedPropertyId} />

                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Nom
                    </span>
                    <input
                      name="label"
                      placeholder="Ex : Ménage léger, Jardinage, Réparer poignée"
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                    />
                  </label>

                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Code interne
                      </span>
                      <input
                        name="code"
                        placeholder="menage_leger"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Durée estimée
                      </span>
                      <input
                        name="estimated_hours"
                        defaultValue="2"
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Catégorie
                    </span>
                    <select
                      name="service_type"
                      defaultValue="standard_cleaning"
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                    >
                      <option value="standard_cleaning">Ménage standard</option>
                      <option value="deep_cleaning">Grand ménage</option>
                      <option value="garden_lawn">Jardin / tonte</option>
                      <option value="linen_laundry">Linge / lessive</option>
                      <option value="inventory_check">Contrôle inventaire</option>
                      <option value="maintenance_check">Petite maintenance</option>
                      <option value="other">Mission ponctuelle</option>
                    </select>
                  </label>

                  <input type="hidden" name="sort_order" value="100" />

                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="flex items-center gap-2 rounded-2xl bg-white p-3 text-xs font-bold text-slate-700">
                      <input type="checkbox" name="default_linen_required" defaultChecked />
                      Linge
                    </label>
                    <label className="flex items-center gap-2 rounded-2xl bg-white p-3 text-xs font-bold text-slate-700">
                      <input type="checkbox" name="default_laundry_required" defaultChecked />
                      Lessive
                    </label>
                    <label className="flex items-center gap-2 rounded-2xl bg-white p-3 text-xs font-bold text-slate-700">
                      <input type="checkbox" name="use_master" defaultChecked />
                      Préremplir avec le master
                    </label>
                  </div>

                  <button className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                    Créer
                  </button>
                </form>
              </details>
            </div>

            {profiles.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-100">
                Aucune checklist pour ce logement. Créez la première, idéalement avec le master.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {profiles.map((profile) => (
                  <ChecklistCard
                    key={profile.id}
                    profile={profile}
                    selectedPropertyId={selectedPropertyId}
                    isSelected={profile.id === selectedProfileId}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {selectedProfile && activeTemplate && (
          <section className="rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Checklist sélectionnée
                </p>
                <h2 className="text-xl font-black text-slate-950">
                  {selectedProfile.label}
                </h2>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {sections.length} section(s)
              </span>
            </div>

            <form action={updateSimpleChecklist} className="mt-4 space-y-3">
              <input type="hidden" name="profile_id" value={selectedProfile.id} />
              <input type="hidden" name="template_id" value={activeTemplate.id} />

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Nom
                  </span>
                  <input
                    name="label"
                    defaultValue={selectedProfile.label ?? ""}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Code interne
                  </span>
                  <input
                    name="code"
                    defaultValue={selectedProfile.code ?? ""}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Catégorie
                  </span>
                  <select
                    name="service_type"
                    defaultValue={selectedProfile.service_type ?? "standard_cleaning"}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                  >
                    <option value="standard_cleaning">Ménage standard</option>
                    <option value="deep_cleaning">Grand ménage</option>
                    <option value="garden_lawn">Jardin / tonte</option>
                    <option value="linen_laundry">Linge / lessive</option>
                    <option value="inventory_check">Contrôle inventaire</option>
                    <option value="maintenance_check">Petite maintenance</option>
                    <option value="other">Mission ponctuelle</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Durée estimée
                  </span>
                  <input
                    name="estimated_hours"
                    defaultValue={selectedProfile.estimated_hours ?? 2}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Ordre
                  </span>
                  <input
                    name="sort_order"
                    type="number"
                    defaultValue={selectedProfile.sort_order ?? 100}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                  />
                </label>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    name="default_linen_required"
                    defaultChecked={selectedProfile.default_linen_required === true}
                  />
                  Linge par défaut
                </label>

                <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    name="default_laundry_required"
                    defaultChecked={selectedProfile.default_laundry_required === true}
                  />
                  Lessive par défaut
                </label>

                <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={selectedProfile.active !== false}
                  />
                  Active
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="flex-1 rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                  Enregistrer la checklist
                </button>

                <button
                  formAction={archiveSimpleChecklist}
                  className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-800 ring-1 ring-red-100"
                >
                  Désactiver
                </button>
              </div>
            </form>
          </section>
        )}

        {selectedProfile && !activeTemplate && (
          <section className="rounded-[1.25rem] bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              Checklist sans contenu
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Cette checklist existe, mais aucun contenu n’est attaché. Créez une nouvelle checklist avec le master ou ajoutez les sections manuellement.
            </p>
          </section>
        )}

        {activeTemplate && (
          <section className="rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-950">
              Ajouter une section
            </h2>

            <form action={addChecklistSection} className="mt-4 space-y-3">
              <input type="hidden" name="template_id" value={activeTemplate.id} />

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Section
                  </span>
                  <input
                    name="title"
                    placeholder="Ex : Terrasse"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Case principale à cocher
                  </span>
                  <input
                    name="high_level_check_label"
                    placeholder="Ex : Terrasse propre et rangée"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Ordre
                  </span>
                  <input
                    name="sort_order"
                    type="number"
                    defaultValue="100"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Photos pour cette section
                  </span>
                  <select
                    name="photo_requirement"
                    defaultValue="none"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
                  >
                    <option value="none">Pas de photo</option>
                    <option value="optional">Photo optionnelle</option>
                    <option value="required">Photo obligatoire</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Tâches / points de contrôle
                </span>
                <textarea
                  name="detail_items"
                  rows={5}
                  placeholder={"Un point par ligne\nEx : Table propre\nEx : Chaises rangées"}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold"
                />
              </label>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" name="required" defaultChecked />
                  Section obligatoire
                </label>

                <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" name="visible_to_cleaner" defaultChecked />
                  Visible intervenante
                </label>
              </div>

              <button className="w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                Ajouter la section
              </button>
            </form>
          </section>
        )}

        {activeTemplate && (
          <section className="space-y-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Sections de la checklist
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {sections.length} section(s). Les photos restent liées à la section via le réglage “photo obligatoire/optionnelle”.
              </p>
            </div>

            {sections.length === 0 ? (
              <div className="rounded-[1.25rem] bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
                Aucune section pour l’instant.
              </div>
            ) : (
              sections.map((section) => <SectionForm key={section.id} section={section} />)
            )}
          </section>
        )}
      </div>
    </main>
  );
}
