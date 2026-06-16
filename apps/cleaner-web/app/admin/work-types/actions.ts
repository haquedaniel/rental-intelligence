"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value || null;
}

function boolValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function createWorkType(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const label = textValue(formData, "label");
  const serviceType = textValue(formData, "service_type") || "standard_cleaning";
  const estimatedHours = numberValue(textValue(formData, "estimated_hours"), 2);

  if (!propertyId || !label) {
    throw new Error("Logement et nom du type de mission obligatoires.");
  }

  const code = textValue(formData, "code") || slugify(label);

  const payload = {
    property_id: propertyId,
    code,
    label,
    service_type: serviceType,
    description: nullableText(formData, "description"),
    estimated_hours: estimatedHours,
    default_linen_required: boolValue(formData, "default_linen_required"),
    default_laundry_required: boolValue(formData, "default_laundry_required"),
    active: boolValue(formData, "active"),
    sort_order: numberValue(textValue(formData, "sort_order"), 100),
  };

  const { error } = await supabase
    .from("property_cleaning_profiles")
    .insert(payload);

  if (error) {
    throw new Error(`Impossible de créer le type de mission : ${error.message}`);
  }

  revalidatePath("/admin/work-types");
  revalidatePath("/admin/operations/create-cleaning-request");
}

export async function updateWorkType(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const id = textValue(formData, "id");
  const label = textValue(formData, "label");
  const serviceType = textValue(formData, "service_type") || "standard_cleaning";
  const estimatedHours = numberValue(textValue(formData, "estimated_hours"), 2);

  if (!id || !label) {
    throw new Error("Identifiant et nom du type de mission obligatoires.");
  }

  const code = textValue(formData, "code") || slugify(label);

  const payload = {
    code,
    label,
    service_type: serviceType,
    description: nullableText(formData, "description"),
    estimated_hours: estimatedHours,
    default_linen_required: boolValue(formData, "default_linen_required"),
    default_laundry_required: boolValue(formData, "default_laundry_required"),
    active: boolValue(formData, "active"),
    sort_order: numberValue(textValue(formData, "sort_order"), 100),
  };

  const { error } = await supabase
    .from("property_cleaning_profiles")
    .update(payload)
    .eq("id", id);

  if (error) {
    throw new Error(`Impossible d’enregistrer le type de mission : ${error.message}`);
  }

  revalidatePath("/admin/work-types");
  revalidatePath("/admin/operations/create-cleaning-request");
}

export async function archiveWorkType(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const id = textValue(formData, "id");

  if (!id) {
    throw new Error("Identifiant manquant.");
  }

  const { error } = await supabase
    .from("property_cleaning_profiles")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw new Error(`Impossible de désactiver le type de mission : ${error.message}`);
  }

  revalidatePath("/admin/work-types");
  revalidatePath("/admin/operations/create-cleaning-request");
}
