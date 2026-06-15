"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string, fallback: number): number {
  const raw = textValue(formData, key);
  if (!raw) return fallback;

  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function nullableNumberValue(formData: FormData, key: string): number | null {
  const raw = textValue(formData, key);
  if (!raw) return null;

  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function boolValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function redirectToAssignments(propertyId?: string): never {
  revalidatePath("/admin/cleaner-assignments");
  const suffix = propertyId ? `?property=${propertyId}` : "";
  redirect(`/admin/cleaner-assignments${suffix}`);
}

async function syncPreferredCleaner(propertyId: string) {
  const supabase = getSupabaseAdmin();

  const { data: primary } = await supabase
    .from("property_cleaner_assignments")
    .select("cleaner_id")
    .eq("property_id", propertyId)
    .eq("role", "primary")
    .eq("active", true)
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("properties")
    .update({
      preferred_cleaner_id: primary?.cleaner_id ?? null,
    })
    .eq("id", propertyId);
}

export async function saveAssignment(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const cleanerId = textValue(formData, "cleaner_id");
  const role = textValue(formData, "role") || "backup";
  const active = boolValue(formData, "active");

  if (!propertyId || !cleanerId) {
    throw new Error("Logement ou intervenante manquant");
  }

  if (role !== "primary" && role !== "backup") {
    throw new Error("Rôle invalide");
  }

  if (role === "primary" && active) {
    const { error: deactivateError } = await supabase
      .from("property_cleaner_assignments")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("property_id", propertyId)
      .eq("role", "primary")
      .neq("cleaner_id", cleanerId);

    if (deactivateError) {
      throw new Error(
        `Impossible de remplacer l'intervenante principale : ${deactivateError.message}`,
      );
    }
  }

  const { error } = await supabase
    .from("property_cleaner_assignments")
    .upsert(
      {
        property_id: propertyId,
        cleaner_id: cleanerId,
        role,
        priority: numberValue(formData, "priority", role === "primary" ? 1 : 2),
        travel_distance_km: nullableNumberValue(formData, "travel_distance_km"),
        familiar: boolValue(formData, "familiar"),
        active,
        notes: textValue(formData, "notes") || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "property_id,cleaner_id",
      },
    );

  if (error) {
    throw new Error(`Impossible d'enregistrer l'affectation : ${error.message}`);
  }

  await syncPreferredCleaner(propertyId);

  redirectToAssignments(propertyId);
}

export async function deactivateAssignment(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const assignmentId = textValue(formData, "assignment_id");
  const propertyId = textValue(formData, "property_id");

  if (!assignmentId || !propertyId) {
    throw new Error("Affectation manquante");
  }

  const { error } = await supabase
    .from("property_cleaner_assignments")
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);

  if (error) {
    throw new Error(`Impossible de désactiver l'affectation : ${error.message}`);
  }

  await syncPreferredCleaner(propertyId);

  redirectToAssignments(propertyId);
}
