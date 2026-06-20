"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Row = Record<string, any>;

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function boolValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function linesValue(formData: FormData, key: string): string[] {
  return textValue(formData, key)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

async function deactivateOtherTemplates(propertyId: string, profileId: string) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("cleaning_checklist_templates")
    .update({ active: false })
    .eq("property_id", propertyId)
    .eq("cleaning_profile_id", profileId);

  if (error) {
    throw new Error(`Impossible de désactiver les anciennes checklists : ${error.message}`);
  }
}

export async function createBlankChecklistForProfile(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const profileId = textValue(formData, "cleaning_profile_id");
  const name = textValue(formData, "name") || "Nouvelle checklist";
  const estimatedMinutes = numberValue(textValue(formData, "estimated_minutes"), 120);

  if (!propertyId || !profileId) {
    throw new Error("Logement ou type de mission manquant.");
  }

  await deactivateOtherTemplates(propertyId, profileId);

  const { error } = await supabase.from("cleaning_checklist_templates").insert({
    property_id: propertyId,
    cleaning_profile_id: profileId,
    name,
    estimated_minutes: estimatedMinutes,
    active: true,
  });

  if (error) {
    throw new Error(`Impossible de créer la checklist : ${error.message}`);
  }

  revalidatePath("/admin/checklists");
}

export async function createStandardChecklistForProfile(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const profileId = textValue(formData, "cleaning_profile_id");
  const name = textValue(formData, "name") || "Ménage standard";
  const estimatedMinutes = numberValue(textValue(formData, "estimated_minutes"), 120);

  if (!propertyId || !profileId) {
    throw new Error("Logement ou type de mission manquant.");
  }

  await deactivateOtherTemplates(propertyId, profileId);

  const { data: template, error: templateError } = await supabase
    .from("cleaning_checklist_templates")
    .insert({
      property_id: propertyId,
      cleaning_profile_id: profileId,
      name,
      estimated_minutes: estimatedMinutes,
      active: true,
    })
    .select("*")
    .single();

  if (templateError || !template) {
    throw new Error(`Impossible de créer la checklist standard : ${templateError?.message}`);
  }

  const sections = [
    {
      section_key: "premieres_taches",
      title: "Premières tâches",
      high_level_check_label: "Premières tâches effectuées",
      sort_order: 10,
      photo_requirement: "none",
      detail_items: [
        "Couper les radiateurs",
        "Ouvrir toutes les fenêtres pour aérer",
        "Couper et débrancher les appareils inutiles",
        "Vider le logement des poubelles et du linge sale",
      ],
      required: true,
      visible_to_cleaner: true,
      active: true,
    },
    {
      section_key: "sanitaires",
      title: "Sanitaires",
      high_level_check_label: "Sanitaires propres",
      sort_order: 20,
      photo_requirement: "none",
      detail_items: [
        "WC, lunette et brosse propres",
        "Lavabo, douche ou baignoire propres",
        "Bondes d’évacuation vidées",
        "Surfaces vitrées propres",
      ],
      required: true,
      visible_to_cleaner: true,
      active: true,
    },
    {
      section_key: "cuisine",
      title: "Cuisine",
      high_level_check_label: "Cuisine propre",
      sort_order: 30,
      photo_requirement: "none",
      detail_items: [
        "Frigo vidé et propre",
        "Four et micro-ondes propres",
        "Placards intérieurs et extérieurs vérifiés",
        "Plans de travail propres",
        "Poubelle nettoyée",
      ],
      required: true,
      visible_to_cleaner: true,
      active: true,
    },
    {
      section_key: "sols_poussieres",
      title: "Sols et poussières",
      high_level_check_label: "Sols et surfaces propres",
      sort_order: 40,
      photo_requirement: "none",
      detail_items: [
        "TV, meubles et étagères dépoussiérés",
        "Coussins secoués et remis en place",
        "Traces grossières sur les vitres retirées",
        "Aspirateur et serpillière passés",
      ],
      required: true,
      visible_to_cleaner: true,
      active: true,
    },
    {
      section_key: "preparation",
      title: "Préparation",
      high_level_check_label: "Logement préparé",
      sort_order: 50,
      photo_requirement: "none",
      detail_items: [
        "Lits faits si linge prévu",
        "Serviettes et torchons en place",
        "Produits d’accueil réapprovisionnés",
        "Mobilier repositionné avec soin",
      ],
      required: true,
      visible_to_cleaner: true,
      active: true,
    },
    {
      section_key: "controle_final",
      title: "Contrôle final",
      high_level_check_label: "Logement prêt",
      sort_order: 60,
      photo_requirement: "optional",
      detail_items: [
        "Fenêtres fermées",
        "Chauffage coupé",
        "Lumières éteintes",
        "Logement aéré puis refermé",
        "Logement prêt pour l’arrivée des voyageurs",
      ],
      required: true,
      visible_to_cleaner: true,
      active: true,
    },
  ];

  const { error: sectionsError } = await supabase
    .from("cleaning_checklist_sections")
    .insert(sections.map((section) => ({ ...section, template_id: template.id })));

  if (sectionsError) {
    throw new Error(`Impossible de créer les rubriques standard : ${sectionsError.message}`);
  }

  revalidatePath("/admin/checklists");
}

export async function copyTemplateToProfile(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const sourceTemplateId = textValue(formData, "source_template_id");
  const propertyId = textValue(formData, "property_id");
  const profileId = textValue(formData, "cleaning_profile_id");

  if (!sourceTemplateId || !propertyId || !profileId) {
    throw new Error("Checklist source, logement ou type de mission manquant.");
  }

  const { data: sourceTemplate, error: sourceTemplateError } = await supabase
    .from("cleaning_checklist_templates")
    .select("*")
    .eq("id", sourceTemplateId)
    .maybeSingle();

  if (sourceTemplateError || !sourceTemplate) {
    throw new Error("Checklist source introuvable.");
  }

  const { data: sourceSections, error: sourceSectionsError } = await supabase
    .from("cleaning_checklist_sections")
    .select("*")
    .eq("template_id", sourceTemplateId)
    .order("sort_order", { ascending: true });

  if (sourceSectionsError) {
    throw new Error(`Impossible de charger les rubriques source : ${sourceSectionsError.message}`);
  }

  await deactivateOtherTemplates(propertyId, profileId);

  const { data: newTemplate, error: newTemplateError } = await supabase
    .from("cleaning_checklist_templates")
    .insert({
      property_id: propertyId,
      cleaning_profile_id: profileId,
      name: sourceTemplate.name,
      estimated_minutes: sourceTemplate.estimated_minutes,
      active: true,
    })
    .select("*")
    .single();

  if (newTemplateError || !newTemplate) {
    throw new Error(`Impossible de copier la checklist : ${newTemplateError?.message}`);
  }

  const clonedSections = (sourceSections ?? []).map((section: Row) => {
    const clone = { ...section };
    delete clone.id;
    delete clone.created_at;
    delete clone.updated_at;
    clone.template_id = newTemplate.id;
    return clone;
  });

  if (clonedSections.length > 0) {
    const { error: insertSectionsError } = await supabase
      .from("cleaning_checklist_sections")
      .insert(clonedSections);

    if (insertSectionsError) {
      throw new Error(`Impossible de copier les rubriques : ${insertSectionsError.message}`);
    }
  }

  revalidatePath("/admin/checklists");
}

export async function updateChecklistTemplate(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const id = textValue(formData, "id");
  const name = textValue(formData, "name");
  const estimatedMinutes = numberValue(textValue(formData, "estimated_minutes"), 120);
  const active = boolValue(formData, "active");

  if (!id || !name) {
    throw new Error("Checklist ou nom manquant.");
  }

  const { data: template } = await supabase
    .from("cleaning_checklist_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    throw new Error("Checklist introuvable.");
  }

  if (active && template.property_id && template.cleaning_profile_id) {
    await deactivateOtherTemplates(template.property_id, template.cleaning_profile_id);
  }

  const { error } = await supabase
    .from("cleaning_checklist_templates")
    .update({
      name,
      estimated_minutes: estimatedMinutes,
      active,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Impossible d’enregistrer la checklist : ${error.message}`);
  }

  revalidatePath("/admin/checklists");
}

export async function addChecklistSection(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const templateId = textValue(formData, "template_id");
  const title = textValue(formData, "title");
  const primaryCheckLabel = textValue(formData, "high_level_check_label");
  const sortOrder = numberValue(textValue(formData, "sort_order"), 100);

  if (!templateId || !title || !primaryCheckLabel) {
    throw new Error("Checklist, titre ou case principale manquante.");
  }

  const sectionKey = `${slugify(title)}_${Math.floor(Math.random() * 900000 + 100000)}`;

  const { error } = await supabase.from("cleaning_checklist_sections").insert({
    template_id: templateId,
    section_key: sectionKey,
    title,
    high_level_check_label: primaryCheckLabel,
    sort_order: sortOrder,
    photo_requirement: textValue(formData, "photo_requirement") || "none",
    detail_items: linesValue(formData, "detail_items"),
    required: boolValue(formData, "required"),
    visible_to_cleaner: boolValue(formData, "visible_to_cleaner"),
    active: true,
  });

  if (error) {
    throw new Error(`Impossible d’ajouter la rubrique : ${error.message}`);
  }

  revalidatePath("/admin/checklists");
}

export async function updateChecklistSection(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const id = textValue(formData, "id");
  const title = textValue(formData, "title");
  const primaryCheckLabel = textValue(formData, "high_level_check_label");
  const sortOrder = numberValue(textValue(formData, "sort_order"), 100);

  if (!id || !title || !primaryCheckLabel) {
    throw new Error("Rubrique, titre ou case principale manquante.");
  }

  const { error } = await supabase
    .from("cleaning_checklist_sections")
    .update({
      title,
      high_level_check_label: primaryCheckLabel,
      sort_order: sortOrder,
      photo_requirement: textValue(formData, "photo_requirement") || "none",
      detail_items: linesValue(formData, "detail_items"),
      required: boolValue(formData, "required"),
      visible_to_cleaner: boolValue(formData, "visible_to_cleaner"),
      active: boolValue(formData, "active"),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Impossible d’enregistrer la rubrique : ${error.message}`);
  }

  revalidatePath("/admin/checklists");
}

export async function archiveChecklistSection(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const id = textValue(formData, "id");

  if (!id) {
    throw new Error("Rubrique manquante.");
  }

  const { error } = await supabase
    .from("cleaning_checklist_sections")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw new Error(`Impossible de masquer la rubrique : ${error.message}`);
  }

  revalidatePath("/admin/checklists");
}


const MASTER_CLEANING_SECTIONS = [
  {
    section_key: "premieres_taches",
    title: "Premières tâches",
    high_level_check_label: "Premières tâches effectuées",
    sort_order: 10,
    photo_requirement: "none",
    detail_items: [
      "Couper les radiateurs",
      "Ouvrir toutes les fenêtres pour aérer",
      "Couper et débrancher tous les appareils inutiles",
      "Vider le logement des poubelles et du linge sale",
    ],
    required: true,
    visible_to_cleaner: true,
    active: true,
  },
  {
    section_key: "sanitaires",
    title: "Sanitaires",
    high_level_check_label: "Sanitaires propres",
    sort_order: 20,
    photo_requirement: "none",
    detail_items: [
      "WC, lunette et brosse propres",
      "Lavabo, douche ou baignoire propres",
      "Bondes d’évacuation vidées",
      "Surfaces vitrées propres",
    ],
    required: true,
    visible_to_cleaner: true,
    active: true,
  },
  {
    section_key: "cuisine",
    title: "Cuisine",
    high_level_check_label: "Cuisine propre",
    sort_order: 30,
    photo_requirement: "none",
    detail_items: [
      "Frigo vidé et propre",
      "Four et micro-ondes propres",
      "Placards intérieurs et extérieurs vérifiés",
      "Plans de travail propres",
      "Poubelle nettoyée",
    ],
    required: true,
    visible_to_cleaner: true,
    active: true,
  },
  {
    section_key: "poussieres_sols",
    title: "Poussières / sols",
    high_level_check_label: "Sols et surfaces propres",
    sort_order: 40,
    photo_requirement: "none",
    detail_items: [
      "TV, meubles et étagères dépoussiérés",
      "Coussins du canapé secoués",
      "Traces grossières sur les vitres retirées",
      "Aspirateur passé",
      "Serpillière passée",
    ],
    required: true,
    visible_to_cleaner: true,
    active: true,
  },
  {
    section_key: "preparation",
    title: "Préparation",
    high_level_check_label: "Logement préparé",
    sort_order: 50,
    photo_requirement: "none",
    detail_items: [
      "Lits faits si linge prévu",
      "Serviettes de toilette en place",
      "Torchons en place",
      "Produits d’accueil réapprovisionnés",
      "Mobilier repositionné avec soin",
    ],
    required: true,
    visible_to_cleaner: true,
    active: true,
  },
  {
    section_key: "controle_final",
    title: "Contrôle final",
    high_level_check_label: "Logement prêt",
    sort_order: 60,
    photo_requirement: "optional",
    detail_items: [
      "Toutes les fenêtres fermées",
      "Chauffage coupé",
      "Lumières éteintes",
      "Logement aéré puis refermé",
      "Logement prêt pour l’arrivée des voyageurs",
    ],
    required: true,
    visible_to_cleaner: true,
    active: true,
  },
];

export async function createSimpleChecklist(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const label = textValue(formData, "label") || "Nouvelle checklist";
  const code = textValue(formData, "code") || slugify(label);
  const serviceType = textValue(formData, "service_type") || "standard_cleaning";
  const estimatedHours = numberValue(textValue(formData, "estimated_hours"), 2);
  const sortOrder = numberValue(textValue(formData, "sort_order"), 100);
  const useMaster = boolValue(formData, "use_master");

  if (!propertyId) {
    throw new Error("Logement manquant.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("property_cleaning_profiles")
    .insert({
      property_id: propertyId,
      label,
      code,
      service_type: serviceType,
      estimated_hours: estimatedHours,
      sort_order: sortOrder,
      default_linen_required: boolValue(formData, "default_linen_required"),
      default_laundry_required: boolValue(formData, "default_laundry_required"),
      active: true,
    })
    .select("*")
    .single();

  if (profileError || !profile) {
    throw new Error(`Impossible de créer la checklist : ${profileError?.message}`);
  }

  const { data: template, error: templateError } = await supabase
    .from("cleaning_checklist_templates")
    .insert({
      property_id: propertyId,
      cleaning_profile_id: profile.id,
      name: label,
      estimated_minutes: Math.round(estimatedHours * 60),
      active: true,
    })
    .select("*")
    .single();

  if (templateError || !template) {
    throw new Error(`Impossible de créer le contenu de checklist : ${templateError?.message}`);
  }

  if (useMaster) {
    const { error: sectionsError } = await supabase
      .from("cleaning_checklist_sections")
      .insert(
        MASTER_CLEANING_SECTIONS.map((section) => ({
          ...section,
          template_id: template.id,
        })),
      );

    if (sectionsError) {
      throw new Error(`Impossible de créer les sections : ${sectionsError.message}`);
    }
  }

  revalidatePath("/admin/checklists");
}

export async function updateSimpleChecklist(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const profileId = textValue(formData, "profile_id");
  const templateId = textValue(formData, "template_id");
  const label = textValue(formData, "label");
  const code = textValue(formData, "code") || slugify(label);
  const estimatedHours = numberValue(textValue(formData, "estimated_hours"), 2);

  if (!profileId || !templateId || !label) {
    throw new Error("Checklist, contenu ou nom manquant.");
  }

  const { error: profileError } = await supabase
    .from("property_cleaning_profiles")
    .update({
      label,
      code,
      service_type: textValue(formData, "service_type") || "standard_cleaning",
      estimated_hours: estimatedHours,
      sort_order: numberValue(textValue(formData, "sort_order"), 100),
      default_linen_required: boolValue(formData, "default_linen_required"),
      default_laundry_required: boolValue(formData, "default_laundry_required"),
      active: boolValue(formData, "active"),
    })
    .eq("id", profileId);

  if (profileError) {
    throw new Error(`Impossible d’enregistrer la checklist : ${profileError.message}`);
  }

  const { error: templateError } = await supabase
    .from("cleaning_checklist_templates")
    .update({
      name: label,
      estimated_minutes: Math.round(estimatedHours * 60),
      active: boolValue(formData, "active"),
    })
    .eq("id", templateId);

  if (templateError) {
    throw new Error(`Impossible d’enregistrer le contenu : ${templateError.message}`);
  }

  revalidatePath("/admin/checklists");
}

export async function archiveSimpleChecklist(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const profileId = textValue(formData, "profile_id");
  const templateId = textValue(formData, "template_id");

  if (!profileId) {
    throw new Error("Checklist manquante.");
  }

  const { error: profileError } = await supabase
    .from("property_cleaning_profiles")
    .update({ active: false })
    .eq("id", profileId);

  if (profileError) {
    throw new Error(`Impossible de désactiver la checklist : ${profileError.message}`);
  }

  if (templateId) {
    await supabase
      .from("cleaning_checklist_templates")
      .update({ active: false })
      .eq("id", templateId);
  }

  revalidatePath("/admin/checklists");
}
