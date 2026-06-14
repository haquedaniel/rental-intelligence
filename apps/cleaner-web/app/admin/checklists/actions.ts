"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string, fallback: number): number {
  const raw = textValue(formData, key);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function boolValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function parseDetailItems(value: string): string[] {
  return value
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^[-*•]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return slug || "rubrique";
}

function redirectToChecklists(propertyId: string): never {
  revalidatePath("/admin/checklists");
  redirect(`/admin/checklists?property_id=${propertyId}`);
}

const STANDARD_SECTIONS = [
  {
    section_key: "premieres_taches",
    title: "Premières tâches",
    high_level_check_label: "Premières tâches effectuées",
    detail_items: [
      "Radiateurs coupés",
      "Fenêtres ouvertes pendant le ménage",
      "Appareils inutiles coupés ou débranchés",
      "Poubelles et linge sale retirés",
    ],
    order_index: 10,
    required: true,
    photo_requirement: "none",
  },
  {
    section_key: "sanitaires",
    title: "Sanitaires",
    high_level_check_label: "Sanitaires nettoyés et vérifiés",
    detail_items: [
      "WC, lunette et brosse propres",
      "Lavabo, douche ou baignoire propres",
      "Bondes vidées",
      "Surfaces vitrées propres",
    ],
    order_index: 20,
    required: true,
    photo_requirement: "optional",
  },
  {
    section_key: "cuisine",
    title: "Cuisine",
    high_level_check_label: "Cuisine nettoyée et vérifiée",
    detail_items: [
      "Frigo vidé et propre",
      "Four et micro-ondes vérifiés",
      "Plans de travail propres",
      "Poubelle vidée",
    ],
    order_index: 30,
    required: true,
    photo_requirement: "optional",
  },
  {
    section_key: "poussieres_sols",
    title: "Poussières et sols",
    high_level_check_label: "Poussières et sols faits",
    detail_items: [
      "Poussières faites sur les meubles visibles",
      "Coussins remis en place",
      "Aspirateur passé",
      "Serpillière passée",
    ],
    order_index: 40,
    required: true,
    photo_requirement: "none",
  },
  {
    section_key: "linge",
    title: "Linge",
    high_level_check_label: "Linge remis en place",
    detail_items: [
      "Lits faits selon le nombre de voyageurs",
      "Serviettes préparées",
      "Linge sale isolé",
    ],
    order_index: 50,
    required: true,
    photo_requirement: "optional",
  },
  {
    section_key: "produits_accueil",
    title: "Produits d’accueil",
    high_level_check_label: "Produits d’accueil réapprovisionnés",
    detail_items: [
      "Papier toilette vérifié",
      "Savon et produits utiles vérifiés",
      "Accueil conforme aux consignes",
    ],
    order_index: 60,
    required: true,
    photo_requirement: "none",
  },
  {
    section_key: "mise_en_place",
    title: "Mise en place",
    high_level_check_label: "Mobilier et logement remis en ordre",
    detail_items: [
      "Mobilier remis à sa place",
      "Décoration et coussins remis en ordre",
      "Logement conforme aux photos modèles",
    ],
    order_index: 70,
    required: true,
    photo_requirement: "optional",
  },
  {
    section_key: "controle_final",
    title: "Contrôle final",
    high_level_check_label: "Logement prêt pour les voyageurs",
    detail_items: [
      "Fenêtres fermées",
      "Chauffage coupé",
      "Lumières éteintes",
      "Logement refermé",
      "Prêt pour les voyageurs",
    ],
    order_index: 80,
    required: true,
    photo_requirement: "optional",
  },
];

export async function createStandardChecklist(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();
  const propertyId = textValue(formData, "property_id");

  if (!propertyId) {
    throw new Error("Logement manquant");
  }

  const { data: template, error: templateError } = await supabase
    .from("cleaning_checklist_templates")
    .insert({
      property_id: propertyId,
      name: "Ménage standard",
      version: 1,
      estimated_minutes: 120,
      active: true,
    })
    .select("id")
    .single();

  if (templateError || !template) {
    throw new Error(
      `Impossible de créer la checklist : ${templateError?.message ?? "erreur inconnue"}`,
    );
  }

  const rows = STANDARD_SECTIONS.map((section) => ({
    ...section,
    template_id: template.id,
  }));

  const { error: sectionsError } = await supabase
    .from("cleaning_checklist_sections")
    .insert(rows);

  if (sectionsError) {
    throw new Error(
      `Checklist créée, mais rubriques non créées : ${sectionsError.message}`,
    );
  }

  redirectToChecklists(propertyId);
}

export async function updateChecklistTemplate(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const templateId = textValue(formData, "template_id");
  const name = textValue(formData, "name") || "Ménage standard";
  const estimatedMinutes = numberValue(formData, "estimated_minutes", 120);

  if (!propertyId || !templateId) {
    throw new Error("Checklist manquante");
  }

  const { error } = await supabase
    .from("cleaning_checklist_templates")
    .update({
      name,
      estimated_minutes: estimatedMinutes,
      active: boolValue(formData, "active"),
    })
    .eq("id", templateId)
    .eq("property_id", propertyId);

  if (error) {
    throw new Error(`Impossible de modifier la checklist : ${error.message}`);
  }

  redirectToChecklists(propertyId);
}

export async function updateChecklistSection(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const sectionId = textValue(formData, "section_id");
  const title = textValue(formData, "title");
  const highLevelCheckLabel = textValue(formData, "high_level_check_label");
  const detailItems = parseDetailItems(textValue(formData, "detail_items"));

  if (!propertyId || !sectionId || !title || !highLevelCheckLabel) {
    throw new Error("Rubrique incomplète");
  }

  const { error } = await supabase
    .from("cleaning_checklist_sections")
    .update({
      title,
      high_level_check_label: highLevelCheckLabel,
      detail_items: detailItems,
      order_index: numberValue(formData, "order_index", 100),
      required: boolValue(formData, "required"),
      photo_requirement: textValue(formData, "photo_requirement") || "none",
    })
    .eq("id", sectionId);

  if (error) {
    throw new Error(`Impossible de modifier la rubrique : ${error.message}`);
  }

  redirectToChecklists(propertyId);
}

export async function addChecklistSection(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const templateId = textValue(formData, "template_id");
  const title = textValue(formData, "title");
  const highLevelCheckLabel =
    textValue(formData, "high_level_check_label") || `${title} validé`;
  const detailItems = parseDetailItems(textValue(formData, "detail_items"));

  if (!propertyId || !templateId || !title) {
    throw new Error("Nouvelle rubrique incomplète");
  }

  const sectionKey = `custom_${slugify(title)}_${Date.now().toString().slice(-6)}`;

  const { error } = await supabase.from("cleaning_checklist_sections").insert({
    template_id: templateId,
    section_key: sectionKey,
    title,
    high_level_check_label: highLevelCheckLabel,
    detail_items: detailItems,
    order_index: numberValue(formData, "order_index", 100),
    required: boolValue(formData, "required"),
    photo_requirement: textValue(formData, "photo_requirement") || "none",
  });

  if (error) {
    throw new Error(`Impossible d'ajouter la rubrique : ${error.message}`);
  }

  redirectToChecklists(propertyId);
}
