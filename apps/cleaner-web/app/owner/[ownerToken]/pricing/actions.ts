"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const num = (formData: FormData, key: string, fallback: number) => {
  const value = Number(text(formData, key).replace(",", "."));
  return Number.isFinite(value) ? value : fallback;
};
const optionalNum = (formData: FormData, key: string) => {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
};
const normaliseToken = (value: string) => decodeURIComponent(value || "").trim();

async function requireOwnedProperty(ownerTokenRaw: string, propertyId: string) {
  const ownerToken = normaliseToken(ownerTokenRaw);
  if (!ownerToken || !propertyId) notFound();

  const db = getSupabaseAdmin();
  const { data: owner, error: ownerError } = await db
    .from("owners")
    .select("id,public_token,active")
    .eq("public_token", ownerToken)
    .eq("active", true)
    .maybeSingle();

  if (ownerError) throw new Error(`Impossible de vérifier le propriétaire : ${ownerError.message}`);
  if (!owner) notFound();

  const { data: property, error: propertyError } = await db
    .from("properties")
    .select("id,owner_id,status")
    .eq("id", propertyId)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (propertyError) throw new Error(`Impossible de vérifier le logement : ${propertyError.message}`);
  if (!property) notFound();

  return { db, ownerToken };
}

function ownerPricingPath(ownerToken: string, propertyId?: string) {
  const base = `/owner/${encodeURIComponent(ownerToken)}/pricing`;
  return propertyId ? `${base}?property=${encodeURIComponent(propertyId)}` : base;
}

export async function saveOwnerPricingSettings(formData: FormData) {
  const propertyId = text(formData, "property_id");
  const { db, ownerToken } = await requireOwnedProperty(text(formData, "owner_token"), propertyId);
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
  const { error } = await db.from("pricing_property_settings").upsert(payload, { onConflict: "property_id" });
  if (error) throw new Error(error.message);
  revalidatePath(ownerPricingPath(ownerToken));
}

export async function saveOwnerSeason(formData: FormData) {
  const propertyId = text(formData, "property_id");
  const { db, ownerToken } = await requireOwnedProperty(text(formData, "owner_token"), propertyId);
  const id = text(formData, "id");
  const payload = {
    property_id: propertyId,
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
  if (!payload.name || !payload.start_date || !payload.end_date) throw new Error("Saison incomplète.");

  let result;
  if (id) {
    result = await db.from("pricing_seasons").update(payload).eq("id", id).eq("property_id", propertyId);
  } else {
    result = await db.from("pricing_seasons").insert(payload);
  }
  if (result.error) throw new Error(result.error.message);
  revalidatePath(ownerPricingPath(ownerToken));
}

export async function deleteOwnerSeason(formData: FormData) {
  const propertyId = text(formData, "property_id");
  const { db, ownerToken } = await requireOwnedProperty(text(formData, "owner_token"), propertyId);
  const id = text(formData, "id");
  if (!id) throw new Error("Saison manquante.");

  const { error } = await db
    .from("pricing_seasons")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("property_id", propertyId);
  if (error) throw new Error(error.message);
  revalidatePath(ownerPricingPath(ownerToken));
}
