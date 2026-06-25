import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

type PageProps = {
  params: Promise<{ requestId: string }>;
};

const PARIS_TZ = "Europe/Paris";

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value?: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function fullName(cleaner?: Row | null): string {
  if (!cleaner) return "Intervenante";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || cleaner.name || "Intervenante";
}

function sectionLabel(sectionKey?: string | null, sectionsByKey?: Record<string, Row>): string {
  if (!sectionKey) return "Photo";

  const section = sectionsByKey?.[sectionKey];
  if (section?.title) return section.title;

  return String(sectionKey)
    .replaceAll("_", " ")
    .replace(/^\w/, (char) => char.toUpperCase());
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function reportIssues(report?: Row | null): { label: string; detail?: string | null }[] {
  if (!report) return [];

  const issues: { label: string; detail?: string | null }[] = [];

  if (bool(report.damage_found)) {
    issues.push({ label: "Dégât constaté", detail: report.damage_notes });
  }

  if (bool(report.missing_items)) {
    issues.push({ label: "Objet ou équipement manquant", detail: report.missing_items_notes });
  }

  if (bool(report.guest_left_items)) {
    issues.push({ label: "Objet oublié par un voyageur", detail: report.guest_left_items_notes });
  }

  if (bool(report.linen_problem)) {
    issues.push({ label: "Problème de linge", detail: report.linen_notes });
  }

  if (bool(report.consumables_problem)) {
    issues.push({ label: "Produits d’accueil manquants", detail: report.consumables_notes });
  }

  if (report.problem_description) {
    issues.push({ label: "Commentaire problème", detail: report.problem_description });
  }

  return issues;
}

function statusCopy({
  request,
  report,
  issues,
}: {
  request: Row;
  report?: Row | null;
  issues: { label: string; detail?: string | null }[];
}) {
  const hasIssue = request.status === "problem_reported" || issues.length > 0;

  if (hasIssue) {
    return {
      tone: "issue",
      title: "Point à vérifier",
      subtitle: "L’intervenante a signalé un élément à contrôler.",
      badge: "Action recommandée",
    };
  }

  if (report?.ready_for_guests === false) {
    return {
      tone: "issue",
      title: "Pas encore prêt",
      subtitle: "Le rapport indique que le logement n’est pas prêt pour les voyageurs.",
      badge: "À vérifier",
    };
  }

  return {
    tone: "ok",
    title: "Logement prêt pour les voyageurs",
    subtitle: "Le ménage a été déclaré terminé et aucun problème n’a été signalé.",
    badge: "Rassurant",
  };
}

async function signedPhotoRows(supabase: ReturnType<typeof getSupabaseAdmin>, photos: Row[]) {
  return Promise.all(
    photos.map(async (photo) => {
      if (!photo.storage_bucket || !photo.storage_path) {
        return { ...photo, signedUrl: null };
      }

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

async function findChecklistTemplate(supabase: ReturnType<typeof getSupabaseAdmin>, request: Row) {
  if (request.checklist_template_id) {
    const { data: frozenTemplate } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version")
      .eq("id", request.checklist_template_id)
      .maybeSingle();

    if (frozenTemplate) return frozenTemplate;
  }

  if (request.cleaning_profile_id) {
    const { data } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version")
      .eq("property_id", request.property_id)
      .eq("cleaning_profile_id", request.cleaning_profile_id)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1);

    if (data?.[0]) return data[0];
  }

  const { data: defaultTemplates } = await supabase
    .from("cleaning_checklist_templates")
    .select("id,name,version")
    .eq("property_id", request.property_id)
    .is("cleaning_profile_id", null)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1);

  if (defaultTemplates?.[0]) return defaultTemplates[0];

  const { data: propertyTemplates } = await supabase
    .from("cleaning_checklist_templates")
    .select("id,name,version")
    .eq("property_id", request.property_id)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1);

  return propertyTemplates?.[0] ?? null;
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


export default async function OwnerReportPage({ params }: PageProps) {
  await requireAdmin();

  const { requestId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: request, error: requestError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-black text-slate-950">Rapport introuvable</h1>
          <p className="mt-2 text-slate-600">Impossible de trouver cette mission.</p>
        </div>
      </main>
    );
  }

  const [{ data: property }, { data: cleaner }, { data: report }] = await Promise.all([
    supabase
      .from("properties")
      .select("id,name,address")
      .eq("id", request.property_id)
      .maybeSingle(),
    request.assigned_cleaner_id
      ? supabase
          .from("cleaners")
          .select("id,first_name,last_name,name")
          .eq("id", request.assigned_cleaner_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("cleaning_reports")
      .select("*")
      .eq("cleaning_request_id", request.id)
      .maybeSingle(),
  ]);

  if (!report) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Link href="/owner/cockpit" className="text-sm font-bold text-slate-600">
            ← Retour cockpit
          </Link>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h1 className="text-2xl font-black text-slate-950">Rapport non reçu</h1>
            <p className="mt-2 text-slate-600">
              La mission existe, mais aucun rapport de ménage n’a encore été envoyé.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const template = await findChecklistTemplate(supabase, request);

  const { data: sectionRows } = template
    ? await supabase
        .from("cleaning_checklist_sections")
        .select("section_key,title,high_level_check_label,detail_items,order_index,sort_order,order_index")
        .eq("template_id", template.id)
        .eq("active", true)
        .order("order_index", { ascending: true })
    : { data: [] };

  const sectionsByKey = Object.fromEntries((sectionRows ?? []).map((section: Row) => [section.section_key, section]));

  const [{ data: checksData }, { data: photoRows }] = await Promise.all([
    supabase
      .from("cleaning_report_section_checks")
      .select("*")
      .eq("cleaning_report_id", report.id),
    supabase
      .from("cleaning_report_photos")
      .select("*")
      .eq("cleaning_request_id", request.id)
      .order("uploaded_at", { ascending: true }),
  ]);

  const checks = checksData ?? [];
  const photos = await signedPhotoRows(supabase, photoRows ?? []);
  const issues = reportIssues(report);
  const status = statusCopy({ request, report, issues });

  const cleanerComments = [
    report.general_notes && { label: "Note générale", text: report.general_notes },
    report.problem_description && { label: "Commentaire problème", text: report.problem_description },
    ...issues
      .filter((issue) => issue.detail)
      .map((issue) => ({ label: issue.label, text: issue.detail })),
  ].filter(Boolean) as { label: string; text: string }[];

  const validatedCount = checks.filter((check: Row) => bool(check.checked)).length;
  const totalSections = Math.max(checks.length, sectionRows?.length ?? 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/owner/cockpit" className="text-sm font-bold text-slate-600">
            ← Retour cockpit
          </Link>

          <Link
            href="/owner/payments"
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            Paiements
          </Link>
        </div>

        <section
          className={`overflow-hidden rounded-[2rem] shadow-sm ring-1 ${
            status.tone === "ok"
              ? "bg-emerald-950 text-white ring-emerald-900"
              : "bg-orange-950 text-white ring-orange-900"
          }`}
        >
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-white/60">
                  Rapport de ménage
                </p>

                <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                  {status.title}
                </h1>

                <p className="mt-3 max-w-2xl text-base font-semibold text-white/75">
                  {status.subtitle}
                </p>
              </div>

              <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">
                {status.badge}
              </span>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-4">
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase text-white/50">Logement</p>
                <p className="mt-1 text-lg font-black">{property?.name ?? "Logement"}</p>
              </div>

              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase text-white/50">Intervenante</p>
                <p className="mt-1 text-lg font-black">{fullName(cleaner)}</p>
              </div>

              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase text-white/50">Rapport envoyé</p>
                <p className="mt-1 text-lg font-black">{formatShortDate(report.updated_at || report.created_at)}</p>
              </div>

              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase text-white/50">Photos</p>
                <p className="mt-1 text-lg font-black">{photos.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Commentaires intervenante
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    À lire en priorité
                  </h2>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    issues.length ? "bg-orange-100 text-orange-900" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {issues.length ? `${issues.length} point(s)` : "Aucun problème"}
                </span>
              </div>

              {cleanerComments.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
                  <p className="font-black">Aucun commentaire particulier.</p>
                  <p className="mt-1 text-sm">
                    L’intervenante n’a pas signalé de problème sur ce rapport.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {cleanerComments.map((comment, index) => (
                    <div
                      key={`${comment.label}-${index}`}
                      className="rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-100"
                    >
                      <p className="text-xs font-black uppercase tracking-wide text-orange-600">
                        {comment.label}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-orange-950">
                        {comment.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Photos de preuve
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    Vérification visuelle
                  </h2>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {photos.length} photo(s)
                </span>
              </div>

              {photos.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  Aucune photo de preuve n’a été jointe à ce rapport.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo: Row) => (
                    <a
                      key={photo.id}
                      href={photo.signedUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-3xl bg-slate-100 ring-1 ring-slate-200"
                    >
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt={sectionLabel(photo.section_key, sectionsByKey)}
                          className="h-40 w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-40 items-center justify-center text-sm font-semibold text-slate-400">
                          Photo indisponible
                        </div>
                      )}

                      <div className="p-3">
                        <p className="truncate text-sm font-black text-slate-950">
                          {sectionLabel(photo.section_key, sectionsByKey)}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          {formatDateTime(photo.uploaded_at)}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Résumé checklist
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">
                {validatedCount}/{totalSections || validatedCount} rubriques validées
              </h2>

              <div className="mt-4 space-y-2">
                {checks.map((check: Row) => (
                  <div
                    key={check.id}
                    className={`rounded-2xl p-3 ring-1 ${
                      check.checked
                        ? "bg-emerald-50 text-emerald-900 ring-emerald-100"
                        : "bg-slate-50 text-slate-700 ring-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black">
                        {sectionLabel(check.section_key, sectionsByKey)}
                      </p>
                      <span>{check.checked ? "✅" : "—"}</span>
                    </div>

                    {check.notes && (
                      <p className="mt-2 whitespace-pre-wrap text-xs font-semibold">
                        {check.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Détails
              </p>

              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="font-bold text-slate-400">Mission prévue</dt>
                  <dd className="font-black text-slate-950">{formatDateTime(request.ready_by_at || request.scheduled_start_at)}</dd>
                </div>

                <div>
                  <dt className="font-bold text-slate-400">Statut</dt>
                  <dd className="font-black text-slate-950">{request.status}</dd>
                </div>

                <div>
                  <dt className="font-bold text-slate-400">Adresse</dt>
                  <dd className="font-semibold text-slate-700">{property?.address ?? "—"}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
