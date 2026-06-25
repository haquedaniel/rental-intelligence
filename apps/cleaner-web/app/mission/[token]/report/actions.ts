"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCleanerLocale, type CleanerLocale } from "@/lib/cleanerI18n";
import { loadTranslatedChecklistSections } from "@/lib/checklistSectionTranslations";

function textValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function boolValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}


function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "photo.jpg";
}

async function uploadSectionPhotos({
  supabase,
  formData,
  sections,
  cleaningRequestId,
  cleaningReportId,
}: {
  supabase: ReturnType<typeof import("@/lib/supabaseAdmin").getSupabaseAdmin>;
  formData: FormData;
  sections: Array<{ section_key: string; photo_requirement?: string }>;
  cleaningRequestId: string;
  cleaningReportId: string;
}) {
  const bucket = "cleaning-report-photos";
  const rows = [];

  for (const section of sections) {
    if (section.photo_requirement === "none") continue;

    const value = formData.get(`photo_${section.section_key}`);

    if (!(value instanceof File)) continue;
    if (value.size === 0) continue;

    const originalName = value.name || "photo.jpg";
    const filename = safeFilename(originalName);
    const storagePath = [
      "reports",
      cleaningRequestId,
      cleaningReportId,
      section.section_key,
      `${Date.now()}-${randomUUID()}-${filename}`,
    ].join("/");

    const arrayBuffer = await value.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: value.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Impossible d'envoyer la photo ${section.section_key} : ${uploadError.message}`
      );
    }
    
    
    rows.push({
      cleaning_report_id: cleaningReportId,
      cleaning_request_id: cleaningRequestId,
      section_key: section.section_key,
      photo_type: "proof",
      storage_bucket: bucket,
      storage_path: storagePath,
      original_filename: originalName,
      content_type: value.type || null,
      size_bytes: value.size,
      caption: null,
    });
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("cleaning_report_photos")
      .insert(rows);

    if (insertError) {
      throw new Error(
        `Photos envoyées, mais métadonnées non enregistrées : ${insertError.message}`
      );
    }
  }

  return rows.length;
}


export async function submitCleaningReport(formData: FormData) {
  const token = textValue(formData, "token");

  if (!token) {
    throw new Error("Lien de mission invalide.");
  }

  const supabase = getSupabaseAdmin();

  const { data: mission, error: missionError } = await supabase
    .from("cleaning_requests")
    .select(
      "id,status,property_id,cleaning_profile_id,checklist_template_id,assigned_cleaner_id,public_token_expires_at"
    )
    .eq("public_token", token)
    .single();

  if (missionError || !mission) {
    throw new Error("Mission introuvable.");
  }

  if (
    mission.public_token_expires_at &&
    new Date(mission.public_token_expires_at) < new Date()
  ) {
    throw new Error("Ce lien de mission a expiré.");
  }

  const allowedStatuses = [
    "accepted",
    "in_progress",
    "report_submitted",
    "problem_reported",
  ];

  if (!allowedStatuses.includes(mission.status)) {
    throw new Error("Le rapport ne peut être complété qu'après acceptation de la mission.");
  }

  let locale: CleanerLocale = "fr";

  if (mission.assigned_cleaner_id) {
    const { data: cleanerRow, error: cleanerError } = await supabase
      .from("cleaners")
      .select("preferred_language")
      .eq("id", mission.assigned_cleaner_id)
      .maybeSingle();

    if (cleanerError) {
      console.error("Cleaner language query failed", cleanerError);
    }

    locale = getCleanerLocale(cleanerRow?.preferred_language);
  }

  let template = null;

  if (mission.checklist_template_id) {
    const { data: frozenTemplate, error: frozenTemplateError } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version,estimated_minutes")
      .eq("id", mission.checklist_template_id)
      .maybeSingle();

    if (frozenTemplateError) {
      console.error("Frozen checklist template query failed", frozenTemplateError);
    }

    template = frozenTemplate ?? null;
  }

  if (!template && mission.cleaning_profile_id) {
    const { data: exactTemplates, error: exactTemplateError } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version,estimated_minutes")
      .eq("property_id", mission.property_id)
      .eq("cleaning_profile_id", mission.cleaning_profile_id)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1);

    if (exactTemplateError) {
      console.error("Exact checklist template query failed", exactTemplateError);
    }

    template = exactTemplates?.[0] ?? null;
  }

  if (!template) {
    const { data: defaultTemplates, error: defaultTemplateError } = await supabase
      .from("cleaning_checklist_templates")
      .select("id,name,version,estimated_minutes")
      .eq("property_id", mission.property_id)
      .is("cleaning_profile_id", null)
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1);

    if (defaultTemplateError) {
      console.error("Default checklist template query failed", defaultTemplateError);
    }

    template = defaultTemplates?.[0] ?? null;
  }

if (!template) {
  const { data: propertyTemplates, error: propertyTemplateError } = await supabase
    .from("cleaning_checklist_templates")
    .select("id,name,version,estimated_minutes")
    .eq("property_id", mission.property_id)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1);

  if (propertyTemplateError) {
    console.error("Property checklist template query failed", propertyTemplateError);
  }

  template = propertyTemplates?.[0] ?? null;
}

if (!template) {
  throw new Error("Aucune checklist active n'est configurée pour cette mission.");
}

  const { data: sections, error: sectionsError } = await supabase
    .from("cleaning_checklist_sections")
    .select(
      "id,section_key,title,high_level_check_label,detail_items,sort_order,order_index,required,photo_requirement"
    )
    .eq("template_id", template.id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("order_index", { ascending: true });

  if (sectionsError || !sections || sections.length === 0) {
    throw new Error("La checklist de cette mission est vide.");
  }

  const translatedSections = await loadTranslatedChecklistSections({
    supabase,
    sections,
    locale,
  });

  const checkedSections = new Set(
    formData.getAll("checkedSections").map((value) => String(value))
  );

  const viewedSections = new Set(
    formData.getAll("viewedSections").map((value) => String(value))
  );

  const requiredSections = translatedSections.filter((section) => section.required);

  const missingRequired = requiredSections.filter(
    (section) => !checkedSections.has(section.section_key)
  );

  if (missingRequired.length > 0) {
    throw new Error(
      `Sections obligatoires non validées : ${missingRequired
        .map((section) => section.title)
        .join(", ")}`
    );
  }

  const checkedWithoutViewing = requiredSections.filter(
    (section) =>
      checkedSections.has(section.section_key) &&
      !viewedSections.has(section.section_key)
  );

  if (checkedWithoutViewing.length > 0) {
    throw new Error(
      `Merci d'ouvrir les détails avant de valider : ${checkedWithoutViewing
        .map((section) => section.title)
        .join(", ")}`
    );
  }

  const damageFound = boolValue(formData, "damage_found");
  const missingItems = boolValue(formData, "missing_items");
  const guestLeftItems = boolValue(formData, "guest_left_items");
  const linenProblem = boolValue(formData, "linen_problem");
  const consumablesProblem = boolValue(formData, "consumables_problem");

  const hasProblem =
    damageFound ||
    missingItems ||
    guestLeftItems ||
    linenProblem ||
    consumablesProblem;

  const now = new Date().toISOString();

  const checklistSnapshot = {
    template_id: template.id,
    template_name: template.name,
    template_version: template.version,
    sections: translatedSections.map((section) => ({
      section_key: section.section_key,
      title: section.title,
      high_level_check_label: section.high_level_check_label,
      detail_items: section.detail_items,
      required: section.required,
      photo_requirement: section.photo_requirement,
      sort_order: section.sort_order,
      order_index: section.order_index,
    })),
  };

  if (!mission.assigned_cleaner_id) {
    throw new Error("Aucune intervenante n'est associée à cette mission.");
  }

  const { data: report, error: reportError } = await supabase
    .from("cleaning_reports")
    .upsert(
      {
        cleaning_request_id: mission.id,
        cleaner_id: mission.assigned_cleaner_id,

        checklist_template_id: template.id,
        checklist_version: template.version,
        checklist_snapshot: checklistSnapshot,
        status: hasProblem ? "problem_reported" : "submitted",
        submitted_at: now,
        ready_for_guests: !hasProblem,

      // rest unchanged...

        damage_found: damageFound,
        damage_notes: textValue(formData, "damage_notes"),

        missing_items: missingItems,
        missing_items_notes: textValue(formData, "missing_items_notes"),

        guest_left_items: guestLeftItems,
        guest_left_items_notes: textValue(formData, "guest_left_items_notes"),

        linen_problem: linenProblem,
        linen_notes: textValue(formData, "linen_notes"),

        consumables_problem: consumablesProblem,
        consumables_notes: textValue(formData, "consumables_notes"),

        general_notes: textValue(formData, "general_notes"),
        updated_at: now,
      },
      { onConflict: "cleaning_request_id" }
    )
    .select("id")
    .single();

  if (reportError || !report) {
    throw new Error(`Impossible d'enregistrer le rapport : ${reportError?.message}`);
  }

  const sectionRows = translatedSections.map((section) => {
    const checked = checkedSections.has(section.section_key);
    const viewed = viewedSections.has(section.section_key);

    return {
      cleaning_report_id: report.id,
      section_key: section.section_key,
      title: section.title,
      high_level_check_label: section.high_level_check_label,
      detail_items_snapshot: section.detail_items ?? [],
      details_viewed_at: viewed ? now : null,
      checked,
      checked_at: checked ? now : null,
      notes: textValue(formData, `section_notes_${section.section_key}`),
    };
  });

  const { error: checksError } = await supabase
    .from("cleaning_report_section_checks")
    .upsert(sectionRows, { onConflict: "cleaning_report_id,section_key" });

  if (checksError) {
    throw new Error(`Impossible d'enregistrer la checklist : ${checksError.message}`);
  }

  await uploadSectionPhotos({
    supabase,
    formData,
    sections: translatedSections,
    cleaningRequestId: mission.id,
    cleaningReportId: report.id,
  });

  const { error: requestUpdateError } = await supabase
    .from("cleaning_requests")
    .update({
      status: hasProblem ? "problem_reported" : "report_submitted",
      updated_at: now,
    })
    .eq("id", mission.id);

  if (requestUpdateError) {
    throw new Error(
      `Rapport enregistré, mais statut mission non mis à jour : ${requestUpdateError.message}`
    );
  }

  redirect(`/mission/${token}/report?submitted=1`);
}