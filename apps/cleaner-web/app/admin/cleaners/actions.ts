"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PHOTO_BUCKET = "cleaner-profile-photos";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value || null;
}

function numberValue(
  formData: FormData,
  key: string,
  fallback: number | null = null,
): number | null {
  const raw = textValue(formData, key);
  if (!raw) return fallback;

  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : fallback;
}

function integerValue(
  formData: FormData,
  key: string,
  fallback: number | null = null,
): number | null {
  const value = numberValue(formData, key, fallback);
  return value === null ? null : Math.round(value);
}

function serviceValues(formData: FormData): string[] {
  return formData
    .getAll("services")
    .map((value) => String(value))
    .filter(Boolean);
}

function activeFromStatus(status: string): boolean {
  return status === "active" || status === "temporarily_unavailable";
}

function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

async function uploadProfilePhoto(
  formData: FormData,
  cleanerId: string,
): Promise<{ bucket: string; path: string } | null> {
  const file = formData.get("profile_photo");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const supabase = getSupabaseAdmin();

  const extensionSource = file.name.includes(".")
    ? file.name.split(".").pop()
    : "jpg";

  const filename = `${randomUUID()}-${safeFilename(
    file.name || `profile.${extensionSource}`,
  )}`;

  const path = `${cleanerId}/${filename}`;

  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(`Impossible d'envoyer la photo : ${error.message}`);
  }

  return {
    bucket: PHOTO_BUCKET,
    path,
  };
}

function cleanerPayload(formData: FormData) {
  const status = textValue(formData, "status") || "active";

  return {
    first_name: textValue(formData, "first_name"),
    last_name: nullableText(formData, "last_name"),
    phone: nullableText(formData, "phone"),
    email: nullableText(formData, "email"),
    address: nullableText(formData, "address"),
    latitude: numberValue(formData, "latitude"),
    longitude: numberValue(formData, "longitude"),
    status,
    active: activeFromStatus(status),
    services: serviceValues(formData),
    hourly_rate_eur: numberValue(formData, "hourly_rate_eur", 18),
    included_radius_km: numberValue(formData, "included_radius_km", 0),
    travel_rate_per_km_eur: numberValue(
      formData,
      "travel_rate_per_km_eur",
      0,
    ),
    urgency_bonus_percent: numberValue(
      formData,
      "urgency_bonus_percent",
      15,
    ),
    preferred_towns: nullableText(formData, "preferred_towns"),
    max_travel_distance_km: numberValue(
      formData,
      "max_travel_distance_km",
    ),
    payment_method: nullableText(formData, "payment_method"),
    payment_details: nullableText(formData, "payment_details"),
    internal_rating: integerValue(formData, "internal_rating"),
    quality_notes: nullableText(formData, "quality_notes"),
    worker_type:
      textValue(formData, "worker_type") || "individual_payment_request",
    legal_name: nullableText(formData, "legal_name"),
    trading_name: nullableText(formData, "trading_name"),
    siret: nullableText(formData, "siret"),
    business_address: nullableText(formData, "business_address"),
    billing_email: nullableText(formData, "billing_email"),
    vat_status: nullableText(formData, "vat_status"),
    invoice_note: nullableText(formData, "invoice_note"),
    payment_terms: nullableText(formData, "payment_terms"),
    iban: nullableText(formData, "iban"),
    notes: nullableText(formData, "notes"),
    updated_at: new Date().toISOString(),
  };
}

function redirectToCleaners(): never {
  revalidatePath("/admin/cleaners");
  redirect("/admin/cleaners");
}

export async function createCleaner(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();
  const payload = cleanerPayload(formData);

  if (!payload.first_name) {
    throw new Error("Le prénom est obligatoire");
  }

  const { data, error } = await supabase
    .from("cleaners")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Impossible de créer l'intervenante : ${error.message}`);
  }

  const uploadedPhoto = await uploadProfilePhoto(formData, data.id);

  if (uploadedPhoto) {
    const { error: photoError } = await supabase
      .from("cleaners")
      .update({
        profile_photo_bucket: uploadedPhoto.bucket,
        profile_photo_path: uploadedPhoto.path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (photoError) {
      throw new Error(
        `Photo envoyée, mais impossible de l'associer : ${photoError.message}`,
      );
    }
  }

  redirectToCleaners();
}

export async function updateCleaner(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const cleanerId = textValue(formData, "cleaner_id");
  const payload: Record<string, unknown> = cleanerPayload(formData);

  if (!cleanerId || !payload.first_name) {
    throw new Error("Intervenante incomplète");
  }

  const uploadedPhoto = await uploadProfilePhoto(formData, cleanerId);

  if (uploadedPhoto) {
    payload.profile_photo_bucket = uploadedPhoto.bucket;
    payload.profile_photo_path = uploadedPhoto.path;
  }

  const { error } = await supabase
    .from("cleaners")
    .update(payload)
    .eq("id", cleanerId);

  if (error) {
    throw new Error(`Impossible de modifier l'intervenante : ${error.message}`);
  }

  redirectToCleaners();
}
