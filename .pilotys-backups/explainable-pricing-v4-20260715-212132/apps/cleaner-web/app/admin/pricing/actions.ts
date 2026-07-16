"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, fallback: number) => {
  const value = Number(text(f, k).replace(",", "."));
  return Number.isFinite(value) ? value : fallback;
};
const optionalNum = (f: FormData, k: string) => {
  const raw = text(f, k);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
};

export async function savePricingSettings(formData: FormData) {
  await requireAdmin();
  const propertyId = text(formData, "property_id");
  if (!propertyId) throw new Error("Bien manquant.");
  const payload = {
    property_id: propertyId,
    enabled: formData.get("enabled") === "on",
    mode: text(formData, "mode") === "apply" ? "apply" : "shadow",
    default_price: num(formData, "default_price", 100),
    default_weekend_price: optionalNum(formData, "default_weekend_price"),
    floor_price: num(formData, "floor_price", 50),
    ceiling_price: optionalNum(formData, "ceiling_price"),
    default_min_stay: Math.max(1, Math.trunc(num(formData, "default_min_stay", 2))),
    weekly_decay_amount: Math.max(0, num(formData, "weekly_decay_amount", 2)),
    weekly_decay_max_steps: Math.max(0, Math.trunc(num(formData, "weekly_decay_max_steps", 5))),
    decay_starts_days_before_arrival: Math.max(0, Math.trunc(num(formData, "decay_starts_days_before_arrival", 120))),
    one_night_gap_multiplier: Math.max(1, num(formData, "one_night_gap_multiplier", 1.5)),
    one_night_release_days: Math.max(0, Math.trunc(num(formData, "one_night_release_days", 21))),
    protect_weekends: formData.get("protect_weekends") === "on",
    planning_horizon_days: Math.max(30, Math.trunc(num(formData, "planning_horizon_days", 540))),
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabaseAdmin().from("pricing_property_settings").upsert(payload, { onConflict: "property_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
}

export async function saveSeason(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const payload = {
    property_id: text(formData, "property_id"),
    name: text(formData, "name"),
    start_date: text(formData, "start_date"),
    end_date: text(formData, "end_date"),
    weekday_price: num(formData, "weekday_price", 100),
    weekend_price: optionalNum(formData, "weekend_price"),
    floor_price: optionalNum(formData, "floor_price"),
    ceiling_price: optionalNum(formData, "ceiling_price"),
    min_stay: Math.max(1, Math.trunc(num(formData, "min_stay", 2))),
    priority: Math.trunc(num(formData, "priority", 100)),
    active: true,
    updated_at: new Date().toISOString(),
  };
  if (!payload.property_id || !payload.name || !payload.start_date || !payload.end_date) throw new Error("Saison incomplète.");
  const db = getSupabaseAdmin();
  const result = id ? await db.from("pricing_seasons").update(payload).eq("id", id) : await db.from("pricing_seasons").insert(payload);
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/admin/pricing");
}

export async function deleteSeason(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const { error } = await getSupabaseAdmin().from("pricing_seasons").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pricing");
}
