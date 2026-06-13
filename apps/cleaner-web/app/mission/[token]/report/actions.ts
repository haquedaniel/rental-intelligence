"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function textValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function boolValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
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
      "id,status,property_id,cleaning_profile_id,public_token_expires_at"
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

  let templateQuery = supabase
    .from("cleaning_checklist_templates")
    .select("id,name,version,estimated_minutes")
    .eq("property_id", mission.property_id)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1);

  if (mission.cleaning_profile_id) {
    templateQuery = templateQuery.eq(
      "cleaning_profile_id",
      mission.cleaning_profile_id
    );
  }

  const { data: templates, error: templateError } = await templateQuery;

  if (templateError || !templates || templates.length === 0) {
    throw new Error("Aucune checklist active n'est configurée pour cette mission.");
  }

  const template = templates[0];

  const { data: sections, error: sectionsError } = await supabase
    .from("cleaning_checklist_sections")
    .select(
      "section_key,title,high_level_check_label,detail_items,order_index,required,photo_requirement"
    )
    .eq("template_id", template.id)
    .order("order_index", { ascending: true });

  if (sectionsError || !sections || sections.length === 0) {
    throw new Error("La checklist de cette mission est vide.");
  }

  const checkedSections = new Set(
    formData.getAll("checkedSections").map((value) => String(value))
  );

  const viewedSections = new Set(
    formData.getAll("viewedSections").map((value) => String(value))
  );

  const requiredSections = sections.filter((section) => section.required);

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
    sections: sections.map((section) => ({
      section_key: section.section_key,
      title: section.title,
      high_level_check_label: section.high_level_check_label,
      detail_items: section.detail_items,
      required: section.required,
      photo_requirement: section.photo_requirement,
      order_index: section.order_index,
    })),
  };

  const { data: report, error: reportError } = await supabase
    .from("cleaning_reports")
    .upsert(
      {
        cleaning_request_id: mission.id,
        checklist_template_id: template.id,
        checklist_version: template.version,
        checklist_snapshot: checklistSnapshot,
        status: hasProblem ? "problem_reported" : "submitted",
        submitted_at: now,
        ready_for_guests: !hasProblem,

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

  const sectionRows = sections.map((section) => {
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