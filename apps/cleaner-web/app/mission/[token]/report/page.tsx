import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ReportForm } from "./ReportForm";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ submitted?: string }>;
};

async function withSignedReferencePhotoUrls(
  supabase: ReturnType<typeof import("@/lib/supabaseAdmin").getSupabaseAdmin>,
  photos: any[],
) {
  return Promise.all(
    photos.map(async (photo) => {
      const { data, error } = await supabase.storage
        .from(photo.storage_bucket)
        .createSignedUrl(photo.storage_path, 60 * 60);

      return {
        ...photo,
        signedUrl: error ? null : data?.signedUrl ?? null,
      };
    }),
  );
}


function sortChecklistSections<T extends { sort_order?: unknown; order_index?: unknown; title?: unknown }>(sections: T[]) {
  return [...sections].sort((a, b) => {
    const aSort = Number(a.sort_order ?? 999999);
    const bSort = Number(b.sort_order ?? 999999);

    if (aSort !== bSort) return aSort - bSort;

    const aIndex = Number(a.order_index ?? 999999);
    const bIndex = Number(b.order_index ?? 999999);

    if (aIndex !== bIndex) return aIndex - bIndex;

    return String(a.title ?? "").localeCompare(String(b.title ?? ""), "fr");
  });
}


export default async function CleaningReportPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const submitted = resolvedSearchParams?.submitted === "1";

  const supabase = getSupabaseAdmin();

  const { data: mission, error: missionError } = await supabase
    .from("cleaning_requests")
    .select(
      "id,status,property_id,cleaning_profile_id,checklist_template_id,scheduled_start_at,public_token_expires_at",
    )
    .eq("public_token", token)
    .single();

  if (missionError || !mission) {
    return <Message title="Mission introuvable" />;
  }

  if (
    mission.public_token_expires_at &&
    new Date(mission.public_token_expires_at) < new Date()
  ) {
    return <Message title="Lien expiré" />;
  }

  const allowedStatuses = [
    "accepted",
    "in_progress",
    "report_submitted",
    "problem_reported",
  ];

  if (!allowedStatuses.includes(mission.status)) {
    return (
      <Message
        title="Mission pas encore acceptée"
        body="Le rapport de ménage sera disponible une fois la mission acceptée."
      />
    );
  }

  const { data: property } = await supabase
    .from("properties")
    .select("name,address")
    .eq("id", mission.property_id)
    .maybeSingle();

  let template: any = null;

  if (mission.checklist_template_id) {
    const { data: frozenTemplate } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version,estimated_minutes")
      .eq("id", mission.checklist_template_id)
      .maybeSingle();

    template = frozenTemplate ?? null;
  }

  if (!template && mission.cleaning_profile_id) {
    const { data: exactTemplates } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version,estimated_minutes")
      .eq("property_id", mission.property_id)
      .eq("cleaning_profile_id", mission.cleaning_profile_id)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1);

    template = exactTemplates?.[0] ?? null;
  }

  if (!template) {
    const { data: defaultTemplates } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version,estimated_minutes")
      .eq("property_id", mission.property_id)
      .is("cleaning_profile_id", null)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1);

    template = defaultTemplates?.[0] ?? null;
  }

  if (!template) {
    const { data: propertyTemplates } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version,estimated_minutes")
      .eq("property_id", mission.property_id)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1);

    template = propertyTemplates?.[0] ?? null;
  }

  if (!template) {
    return (
      <Message
        title="Checklist manquante"
        body="Aucune checklist active n'est configurée pour ce logement."
      />
    );
  }

  const { data: referencePhotoRows, error: referencePhotosError } =
    await supabase
      .from("property_reference_photos")
      .select(
        "id,property_id,section_key,title,storage_bucket,storage_path,is_cover,display_order,is_active",
      )
      .eq("property_id", mission.property_id)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

  if (referencePhotosError) {
    throw new Error(
      `Impossible de charger les photos modèles : ${referencePhotosError.message}`,
    );
  }

  const referencePhotos = await withSignedReferencePhotoUrls(
    supabase,
    referencePhotoRows ?? [],
  );

  const { data: sectionsData } = await supabase
    .from("cleaning_checklist_sections")
    .select(
      "section_key,title,high_level_check_label,detail_items,sort_order,order_index,required,photo_requirement,active",
    )
    .eq("template_id", template.id)
    .eq("active", true)
    .order("sort_order", { ascending: true }).order("order_index", { ascending: true });

  const sections = sortChecklistSections(sectionsData ?? []);

  const { data: report } = await supabase
    .from("cleaning_reports")
    .select("*")
    .eq("cleaning_request_id", mission.id)
    .maybeSingle();

  const { data: existingChecks } = report
    ? await supabase
        .from("cleaning_report_section_checks")
        .select("*")
        .eq("cleaning_report_id", report.id)
    : { data: [] };

  const checksByKey = Object.fromEntries(
    (existingChecks ?? []).map((check: any) => [check.section_key, check]),
  );

  const referencePhotoCounts = referencePhotos.reduce(
    (acc: Record<string, number>, photo: any) => {
      if (photo.is_cover) {
        return acc;
      }

      const key = photo.section_key ?? "general";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const normalizedSections = sections.map((section: any) => {
    const existing = checksByKey[section.section_key];

    return {
      section_key: section.section_key,
      title: section.title,
      high_level_check_label: section.high_level_check_label,
      detail_items: Array.isArray(section.detail_items)
        ? section.detail_items
        : [],
      required: Boolean(section.required),
      photo_requirement: section.photo_requirement ?? "optional",
      reference_photo_count: referencePhotoCounts[section.section_key] ?? 0,
      existing_checked: Boolean(existing?.checked),
      existing_details_viewed: Boolean(existing?.details_viewed_at),
      existing_notes: existing?.notes ?? null,
    };
  });

  const alreadySubmitted =
    mission.status === "report_submitted" ||
    mission.status === "problem_reported";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5">
      <div className="mx-auto max-w-xl space-y-5">
        <Link
          href={`/mission/${token}`}
          className="text-sm font-medium text-slate-600"
        >
          ← Retour à la mission
        </Link>

        <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm">
          <p className="text-sm uppercase tracking-wide text-slate-300">
            Rapport de ménage
          </p>

          <h1 className="mt-2 text-2xl font-bold">
            {property?.name ?? "Logement"}
          </h1>

          {property?.address && (
            <p className="mt-1 text-sm text-slate-300">{property.address}</p>
          )}

          <p className="mt-4 text-sm text-slate-300">
            Checklist : {template.name} · version {template.version}
          </p>
        </section>

        {submitted && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <h2 className="font-semibold">Rapport envoyé ✅</h2>
            <p className="mt-1 text-sm">
              Merci, le propriétaire peut maintenant vérifier les informations.
            </p>
          </section>
        )}

        {alreadySubmitted && !submitted && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <h2 className="font-semibold">Rapport déjà envoyé ✅</h2>
            <p className="mt-1 text-sm">
              Ce rapport est conservé comme preuve de fin de mission.
            </p>
          </section>
        )}

        <ReportForm
          token={token}
          sections={normalizedSections}
          alreadySubmitted={alreadySubmitted}
          referencePhotos={referencePhotos}
        />
      </div>
    </main>
  );
}

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {body && <p className="mt-2 text-slate-600">{body}</p>}
      </div>
    </main>
  );
}