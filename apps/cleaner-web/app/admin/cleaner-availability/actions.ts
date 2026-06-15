"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function redirectToAvailability(cleanerId?: string): never {
  revalidatePath("/admin/cleaner-availability");
  const suffix = cleanerId ? `?cleaner=${cleanerId}` : "";
  redirect(`/admin/cleaner-availability${suffix}`);
}

export async function saveWeeklyAvailability(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const cleanerId = textValue(formData, "cleaner_id");

  if (!cleanerId) {
    throw new Error("Intervenante manquante");
  }

  const rows = Array.from({ length: 7 }, (_, index) => {
    const weekday = index + 1;

    return {
      cleaner_id: cleanerId,
      weekday,
      available: boolValue(formData, `available_${weekday}`),
      start_time: nullableText(formData, `start_time_${weekday}`),
      end_time: nullableText(formData, `end_time_${weekday}`),
      notes: nullableText(formData, `notes_${weekday}`),
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("cleaner_weekly_availability")
    .upsert(rows, { onConflict: "cleaner_id,weekday" });

  if (error) {
    throw new Error(`Impossible d'enregistrer les disponibilités : ${error.message}`);
  }

  redirectToAvailability(cleanerId);
}

export async function addUnavailabilityPeriod(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const cleanerId = textValue(formData, "cleaner_id");
  const startsOn = textValue(formData, "starts_on");
  const endsOn = textValue(formData, "ends_on") || startsOn;
  const reason = nullableText(formData, "reason");

  if (!cleanerId || !startsOn) {
    throw new Error("Intervenante ou date manquante");
  }

  if (endsOn < startsOn) {
    throw new Error("La date de fin doit être après la date de début");
  }

  const { error } = await supabase
    .from("cleaner_unavailability_periods")
    .insert({
      cleaner_id: cleanerId,
      starts_on: startsOn,
      ends_on: endsOn,
      reason,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Impossible d'ajouter l'indisponibilité : ${error.message}`);
  }

  redirectToAvailability(cleanerId);
}

export async function deleteUnavailabilityPeriod(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const periodId = textValue(formData, "period_id");
  const cleanerId = textValue(formData, "cleaner_id");

  if (!periodId || !cleanerId) {
    throw new Error("Indisponibilité manquante");
  }

  const { error } = await supabase
    .from("cleaner_unavailability_periods")
    .delete()
    .eq("id", periodId);

  if (error) {
    throw new Error(`Impossible de supprimer l'indisponibilité : ${error.message}`);
  }

  redirectToAvailability(cleanerId);
}
