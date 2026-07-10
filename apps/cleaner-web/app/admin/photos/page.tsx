import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import {
  uploadReferencePhoto,
  updateReferencePhoto,
  deactivateReferencePhoto,
} from "./actions";
export const dynamic = "force-dynamic";
type PageProps = {
  searchParams?: Promise<{ property_id?: string; template_id?: string }>;
};

async function signedUrl(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bucket: string,
  path: string,
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (error) return null;
  return data?.signedUrl ?? null;
}

function photosUrl(propertyId: string, templateId?: string | null): string {
  const params = new URLSearchParams();
  params.set("property_id", propertyId);
  if (templateId) params.set("template_id", templateId);
  return `/admin/photos?${params.toString()}`;
}

export default async function AdminPhotosPage({ searchParams }: PageProps) {
  await requireAdmin();

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedPropertyId = resolvedSearchParams?.property_id;
  const requestedTemplateId = resolvedSearchParams?.template_id;

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

  let templates: any[] = [];
  let selectedTemplate: any | null = null;
  let sections: any[] = [];
  let photos: any[] = [];

  if (propertyId) {
    const { data: templateRows } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version,active,cleaning_profile_id,created_at")
      .eq("property_id", propertyId)
      .eq("active", true)
      .order("version", { ascending: false })
      .order("created_at", { ascending: false });

    templates = templateRows ?? [];
    selectedTemplate =
      templates.find((template) => template.id === requestedTemplateId) ??
      templates[0] ??
      null;

    if (selectedTemplate) {
      const { data: sectionRows } = await supabase
        .from("cleaning_checklist_sections")
        .select("section_key,title,sort_order,order_index,active")
        .eq("template_id", selectedTemplate.id)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("order_index", { ascending: true });

      sections = sectionRows ?? [];
    }

    const { data: photoRows } = await supabase
      .from("property_reference_photos")
      .select(
        "id,property_id,section_key,title,storage_bucket,storage_path,is_cover,display_order,is_active,created_at",
      )
      .eq("property_id", propertyId)
      .order("display_order", { ascending: true });

    photos = await Promise.all(
      (photoRows ?? []).map(async (photo) => ({
        ...photo,
        signedUrl: await signedUrl(
          supabase,
          photo.storage_bucket,
          photo.storage_path,
        ),
      })),
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-4 py-6">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8"><span className="h-2 w-2 rounded-full bg-[#E0680E]" />Pilotys · opération</div>
        <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-[#112532]/62">
            ← Back office
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-[#112532]">
            Photos modèles
          </h1>
          <p className="mt-1 text-sm text-[#112532]/62">
            Gérez la photo de couverture du logement et les photos modèles par
            rubrique de checklist.
          </p>
        </div>

        <section className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8">
          <h2 className="font-bold text-[#112532]">Logement</h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {(properties ?? []).map((property) => (
              <Link
                key={property.id}
                href={photosUrl(property.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  property.id === propertyId
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-[#112532]/76"
                }`}
              >
                {property.name}
              </Link>
            ))}
          </div>
        </section>

        {propertyId && (
          <section className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8">
            <h2 className="font-bold text-[#112532]">
              Checklist d’affectation
            </h2>

            <p className="mt-1 text-sm text-[#112532]/62">
              Choisissez la checklist dont les sections seront proposées dans le menu d’affectation.
              Les photos restent liées au logement et à la clé stable de section.
            </p>

            {templates.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-[#FFF5DD] p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-100">
                Aucune checklist active pour ce logement. Activez ou créez une checklist avant d’affecter les photos aux sections.
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Link
                    key={template.id}
                    href={photosUrl(propertyId, template.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      template.id === selectedTemplate?.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-[#112532]/76"
                    }`}
                  >
                    {template.name} · v{template.version ?? "—"}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {propertyId && (
          <section className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8">
            <h2 className="font-bold text-[#112532]">
              Ajouter une photo
            </h2>

            <form
              action={uploadReferencePhoto}
              encType="multipart/form-data"
              className="mt-4 grid gap-4 md:grid-cols-2"
            >
              <input type="hidden" name="property_id" value={propertyId} />
              <input type="hidden" name="template_id" value={selectedTemplate?.id ?? ""} />

              <div>
                <label className="block text-sm font-semibold text-[#112532]/86">
                  Photo
                </label>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#112532]/86">
                  Affectation
                </label>
                <select
                  name="placement"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-300 p-3 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choisir…
                  </option>
                  <option value="cover">Photo de couverture</option>
                  {sections.map((section) => (
                    <option key={section.section_key} value={section.section_key}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#112532]/86">
                  Titre
                </label>
                <input
                  name="title"
                  placeholder="Ex : Modèle cuisine"
                  className="mt-2 w-full rounded-2xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#112532]/86">
                  Ordre d’affichage
                </label>
                <input
                  name="display_order"
                  type="number"
                  defaultValue={100}
                  className="mt-2 w-full rounded-2xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
                >
                  Envoyer la photo
                </button>
              </div>
            </form>
          </section>
        )}

        {propertyId && (
          <section className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8">
            <h2 className="font-bold text-[#112532]">Photos existantes</h2>

            {photos.length === 0 ? (
              <p className="mt-3 text-sm text-[#112532]/62">
                Aucune photo pour ce logement.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`overflow-hidden rounded-3xl border bg-white ${
                      photo.is_active
                        ? "border-[#112532]/10"
                        : "border-red-200 opacity-60"
                    }`}
                  >
                    {photo.signedUrl ? (
                      <img
                        src={photo.signedUrl}
                        alt={photo.title ?? "Photo modèle"}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-slate-100 text-sm text-[#112532]/48">
                        Photo non disponible
                      </div>
                    )}

                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap gap-2">
                        {photo.is_cover && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                            Couverture
                          </span>
                        )}
                        {!photo.is_active && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                            Masquée
                          </span>
                        )}
                        {photo.section_key && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#112532]/76">
                            {photo.section_key}
                          </span>
                        )}
                      </div>

                      <form action={updateReferencePhoto} className="space-y-3">
                        <input
                          type="hidden"
                          name="property_id"
                          value={propertyId}
                        />
                        <input type="hidden" name="template_id" value={selectedTemplate?.id ?? ""} />
                        <input type="hidden" name="photo_id" value={photo.id} />

                        <div>
                          <label className="block text-xs font-semibold text-[#112532]/48">
                            Titre
                          </label>
                          <input
                            name="title"
                            defaultValue={photo.title ?? ""}
                            className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#112532]/48">
                            Affectation
                          </label>
                          <select
                            name="placement"
                            defaultValue={
                              photo.is_cover
                                ? "cover"
                                : photo.section_key ?? ""
                            }
                            className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                          >
                            <option value="cover">Photo de couverture</option>
                            {photo.section_key &&
                              !sections.some((section) => section.section_key === photo.section_key) && (
                                <option value={photo.section_key}>
                                  Section actuelle : {photo.section_key}
                                </option>
                              )}
                            {sections.map((section) => (
                              <option
                                key={section.section_key}
                                value={section.section_key}
                              >
                                {section.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#112532]/48">
                            Ordre
                          </label>
                          <input
                            name="display_order"
                            type="number"
                            defaultValue={photo.display_order ?? 100}
                            className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                          />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-[#112532]/76">
                          <input
                            type="checkbox"
                            name="is_active"
                            defaultChecked={photo.is_active}
                          />
                          Visible
                        </label>

                        <button
                          type="submit"
                          className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Enregistrer
                        </button>
                      </form>

                      <form action={deactivateReferencePhoto}>
                        <input
                          type="hidden"
                          name="property_id"
                          value={propertyId}
                        />
                        <input type="hidden" name="template_id" value={selectedTemplate?.id ?? ""} />
                        <input type="hidden" name="photo_id" value={photo.id} />
                        <button
                          type="submit"
                          className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
                        >
                          Masquer cette photo
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
