"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type SavePreferencesState = {
  status: "idle" | "saved" | "error";
  message?: string;
  savedAt?: string;
};

export type PreviewState = {
  status: "idle" | "queued" | "error";
  message?: string;
};

async function owner(token: string) {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("owners")
    .select("id")
    .eq("public_token", decodeURIComponent(token))
    .eq("active", true)
    .maybeSingle();

  if (!data) throw new Error("Owner not found");
  return { db, id: data.id };
}

export async function saveBriefingPreferences(
  _previous: SavePreferencesState,
  formData: FormData,
): Promise<SavePreferencesState> {
  try {
    const token = String(formData.get("owner_token") || "");
    const { db, id } = await owner(token);
    const propertyIds = formData.getAll("property_ids").map(String);
    const payload = {
      owner_id: id,
      enabled: formData.get("enabled") === "on",
      frequency: String(formData.get("frequency") || "morning"),
      timezone: String(formData.get("timezone") || "Europe/Paris"),
      delivery_hour: Number(formData.get("delivery_hour") || 8),
      weekly_day: Number(formData.get("weekly_day") || 1),
      recipient_1_phone: String(formData.get("recipient_1_phone") || "") || null,
      recipient_2_phone: String(formData.get("recipient_2_phone") || "") || null,
      included_property_ids: propertyIds.length ? propertyIds : null,
      include_reservations: formData.get("include_reservations") === "on",
      include_cleaning_completed: formData.get("include_cleaning_completed") === "on",
      include_cleaner_accepted: formData.get("include_cleaner_accepted") === "on",
      include_cleaner_refused: formData.get("include_cleaner_refused") === "on",
      include_cleaning_rescheduled:
        formData.get("include_cleaning_rescheduled") === "on",
      include_pricing: formData.get("include_pricing") === "on",
      include_min_stay: formData.get("include_min_stay") === "on",
      pricing_threshold_type: String(
        formData.get("pricing_threshold_type") || "pct",
      ),
      pricing_threshold_value: Number(
        formData.get("pricing_threshold_value") || 2,
      ),
      include_temporal_daily: formData.get("include_temporal_daily") === "on",
      updated_at: new Date().toISOString(),
    };

    const { error } = await db
      .from("ops_briefing_preferences")
      .upsert(payload, { onConflict: "owner_id" });
    if (error) throw error;

    return {
      status: "saved",
      message: "Préférences enregistrées.",
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Enregistrement impossible.",
    };
  }
}

export async function requestBriefingPreview(
  _previous: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  try {
    const token = String(formData.get("owner_token") || "");
    const { db, id } = await owner(token);
    const { error } = await db.from("ops_briefing_requests").insert({
      owner_id: id,
      requested_by: "owner_ui",
      lookback_hours: Number(formData.get("lookback_hours") || 24),
      status: "pending",
    });
    if (error) throw error;
    return {
      status: "queued",
      message:
        "Prévisualisation demandée. Elle apparaîtra ici après le prochain passage automatique.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Demande impossible.",
    };
  }
}
