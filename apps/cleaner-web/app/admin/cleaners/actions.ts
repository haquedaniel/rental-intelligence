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
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : fallback;
}

function boolValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function redirectToCleaners(): never {
  revalidatePath("/admin/cleaners");
  redirect("/admin/cleaners");
}

export async function createCleaner(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const firstName = textValue(formData, "first_name");
  const lastName = textValue(formData, "last_name");

  if (!firstName) {
    throw new Error("Le prénom est obligatoire");
  }

  const { error } = await supabase.from("cleaners").insert({
    first_name: firstName,
    last_name: lastName || null,
    phone: textValue(formData, "phone") || null,
    email: textValue(formData, "email") || null,
    hourly_rate_eur: numberValue(formData, "hourly_rate_eur", 18),
    included_radius_km: numberValue(formData, "included_radius_km", 0),
    travel_rate_per_km_eur: numberValue(formData, "travel_rate_per_km_eur", 0),
    active: true,
    notes: textValue(formData, "notes") || null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Impossible de créer l'intervenante : ${error.message}`);
  }

  redirectToCleaners();
}

export async function updateCleaner(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const cleanerId = textValue(formData, "cleaner_id");
  const firstName = textValue(formData, "first_name");
  const lastName = textValue(formData, "last_name");

  if (!cleanerId || !firstName) {
    throw new Error("Intervenante incomplète");
  }

  const { error } = await supabase
    .from("cleaners")
    .update({
      first_name: firstName,
      last_name: lastName || null,
      phone: textValue(formData, "phone") || null,
      email: textValue(formData, "email") || null,
      hourly_rate_eur: numberValue(formData, "hourly_rate_eur", 18),
      included_radius_km: numberValue(formData, "included_radius_km", 0),
      travel_rate_per_km_eur: numberValue(formData, "travel_rate_per_km_eur", 0),
      active: boolValue(formData, "active"),
      notes: textValue(formData, "notes") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cleanerId);

  if (error) {
    throw new Error(`Impossible de modifier l'intervenante : ${error.message}`);
  }

  redirectToCleaners();
}

export async function updatePropertyCleaner(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const cleanerId = textValue(formData, "preferred_cleaner_id");

  if (!propertyId) {
    throw new Error("Logement manquant");
  }

  const { error } = await supabase
    .from("properties")
    .update({
      preferred_cleaner_id: cleanerId || null,
    })
    .eq("id", propertyId);

  if (error) {
    throw new Error(`Impossible d'affecter l'intervenante : ${error.message}`);
  }

  redirectToCleaners();
}
