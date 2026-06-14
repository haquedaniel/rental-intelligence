import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import {
  addChecklistSection,
  createStandardChecklist,
  updateChecklistSection,
  updateChecklistTemplate,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ property_id?: string }>;
};

function detailItemsText(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return items.map((item) => String(item)).join("\n");
}

function photoRequirementLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    none: "Pas de photo",
    optional: "Photo optionnelle",
    required: "Photo obligatoire",
  };

  return labels[value ?? "none"] ?? value ?? "Pas de photo";
}

function PhotoRequirementSelect({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  return (
    <select
      name="photo_requirement"
      defaultValue={defaultValue ?? "none"}
      className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
    >
      <option value="none">Pas de photo</option>
      <option value="optional">Photo optionnelle</option>
      <option value="required">Photo obligatoire</option>
    </select>
  );
}

export default async function AdminChecklistsPage({ searchParams }: PageProps) {
  await requireAdmin();

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedPropertyId = resolvedSearchParams?.property_id;

  const supabase = getSupabaseAdmin();

  const { data: properties } = await supabase
    .from("properties")
    .select("id,name,address")
    .order("name", { ascending: true });

  const selectedProperty =
    (properties ?? []).find((property) => property.id === selectedPropertyId) ??
    (properties ?? [])[0] ??
    null;

  const propertyId = selectedProperty?.id ?? null;

  let template: any = null;
  let sections: any[] = [];

  if (propertyId) {
    const { data: templates } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version,estimated_minutes,active")
      .eq("property_id", propertyId)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1);

    template = templates?.[0] ?? null;

    if (template) {
      const { data: sectionRows } = await supabase
        .from("cleaning_checklist_sections")
        .select(
          "id,section_key,title,high_level_check_label,detail_items,order_index,required,photo_requirement",
        )
        .eq("template_id", template.id)
        .order("order_index", { ascending: true });

      sections = sectionRows ?? [];
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Checklists ménage
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Modifiez les rubriques vues par les intervenantes dans le rapport de
            ménage.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-bold text-slate-950">Logement</h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {(properties ?? []).map((property) => (
              <Link
                key={property.id}
                href={`/admin/checklists?property_id=${property.id}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  property.id === propertyId
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {property.name}
              </Link>
            ))}
          </div>
        </section>

        {propertyId && !template && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h2 className="text-lg font-bold">Aucune checklist active</h2>
            <p className="mt-2 text-sm">
              Créez une checklist standard pour ce logement, puis modifiez-la
              selon vos besoins.
            </p>

            <form action={createStandardChecklist} className="mt-4">
              <input type="hidden" name="property_id" value={propertyId} />
              <button
                type="submit"
                className="rounded-2xl bg-amber-900 px-4 py-3 font-semibold text-white"
              >
                Créer une checklist standard
              </button>
            </form>
          </section>
        )}

        {propertyId && template && (
          <>
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-950">
                Checklist active
              </h2>

              <form
                action={updateChecklistTemplate}
                className="mt-4 grid gap-4 md:grid-cols-3"
              >
                <input type="hidden" name="property_id" value={propertyId} />
                <input type="hidden" name="template_id" value={template.id} />

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Nom
                  </label>
                  <input
                    name="name"
                    defaultValue={template.name ?? ""}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Durée estimée en minutes
                  </label>
                  <input
                    name="estimated_minutes"
                    type="number"
                    defaultValue={template.estimated_minutes ?? 120}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={template.active}
                    />
                    Active
                  </label>
                </div>

                <div className="md:col-span-3">
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
                  >
                    Enregistrer la checklist
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-950">
                Ajouter une rubrique
              </h2>

              <form
                action={addChecklistSection}
                className="mt-4 grid gap-4 md:grid-cols-2"
              >
                <input type="hidden" name="property_id" value={propertyId} />
                <input type="hidden" name="template_id" value={template.id} />

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Titre
                  </label>
                  <input
                    name="title"
                    placeholder="Ex : Terrasse"
                    required
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Case principale à valider
                  </label>
                  <input
                    name="high_level_check_label"
                    placeholder="Ex : Terrasse propre et rangée"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Ordre
                  </label>
                  <input
                    name="order_index"
                    type="number"
                    defaultValue={100}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Photos
                  </label>
                  <PhotoRequirementSelect defaultValue="none" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    Points à vérifier
                  </label>
                  <textarea
                    name="detail_items"
                    placeholder={"Un point par ligne\nEx : Table propre\nEx : Chaises rangées"}
                    rows={5}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="required" defaultChecked />
                  Rubrique obligatoire
                </label>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
                  >
                    Ajouter la rubrique
                  </button>
                </div>
              </form>
            </section>

            <section className="space-y-4">
              <h2 className="px-1 text-lg font-bold text-slate-950">
                Rubriques existantes
              </h2>

              {sections.map((section) => (
                <div
                  key={section.id}
                  className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {section.section_key}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Ordre {section.order_index}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {photoRequirementLabel(section.photo_requirement)}
                    </span>
                    {section.required && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        Obligatoire
                      </span>
                    )}
                  </div>

                  <form
                    action={updateChecklistSection}
                    className="mt-4 grid gap-4 md:grid-cols-2"
                  >
                    <input type="hidden" name="property_id" value={propertyId} />
                    <input type="hidden" name="section_id" value={section.id} />

                    <div>
                      <label className="block text-sm font-semibold text-slate-800">
                        Titre
                      </label>
                      <input
                        name="title"
                        defaultValue={section.title ?? ""}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800">
                        Case principale
                      </label>
                      <input
                        name="high_level_check_label"
                        defaultValue={section.high_level_check_label ?? ""}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800">
                        Ordre
                      </label>
                      <input
                        name="order_index"
                        type="number"
                        defaultValue={section.order_index ?? 100}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800">
                        Photos
                      </label>
                      <PhotoRequirementSelect
                        defaultValue={section.photo_requirement ?? "none"}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-800">
                        Points à vérifier
                      </label>
                      <textarea
                        name="detail_items"
                        rows={6}
                        defaultValue={detailItemsText(section.detail_items)}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Un point par ligne. Les tirets sont acceptés.
                      </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="required"
                        defaultChecked={section.required}
                      />
                      Rubrique obligatoire
                    </label>

                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
                      >
                        Enregistrer cette rubrique
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
