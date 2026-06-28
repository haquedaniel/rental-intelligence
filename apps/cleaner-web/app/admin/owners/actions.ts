"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";


function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "owner-photo.jpg";
}

async function uploadOwnerProfilePhoto({
  supabase,
  ownerId,
  formData,
}: {
  supabase: ReturnType<typeof import("@/lib/supabaseAdmin").getSupabaseAdmin>;
  ownerId: string;
  formData: FormData;
}) {
  const value = formData.get("profile_photo");

  if (!(value instanceof File)) return null;
  if (value.size === 0) return null;

  const bucket = "owner-profile-photos";
  const filename = safeFilename(value.name || "owner-photo.jpg");
  const storagePath = [
    "owners",
    ownerId,
    `${Date.now()}-${randomUUID()}-${filename}`,
  ].join("/");

  const buffer = Buffer.from(await value.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: value.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Impossible d’envoyer la photo propriétaire : ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from("owners")
    .update({
      profile_photo_bucket: bucket,
      profile_photo_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ownerId);

  if (updateError) {
    throw new Error(`Photo envoyée, mais profil non mis à jour : ${updateError.message}`);
  }

  return storagePath;
}

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value || null;
}

function integerValue(formData: FormData, key: string, fallback: number): number {
  const parsed = Number.parseInt(textValue(formData, key), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function saveOwner(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const ownerId = optionalText(formData, "owner_id");
  const propertyIds = formData
    .getAll("property_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const displayName = textValue(formData, "display_name");

  if (!displayName) {
    throw new Error("Le nom affiché est obligatoire.");
  }

  const payload = {
    display_name: displayName,
    legal_name: optionalText(formData, "legal_name"),
    billing_email: optionalText(formData, "billing_email"),
    phone: optionalText(formData, "phone"),
    billing_address: optionalText(formData, "billing_address"),
    siren: optionalText(formData, "siren"),
    siret: optionalText(formData, "siret"),
    vat_number: optionalText(formData, "vat_number"),
    vat_status: optionalText(formData, "vat_status"),
    e_invoicing_platform: optionalText(formData, "e_invoicing_platform"),
    payment_request_channel: textValue(formData, "payment_request_channel") || "sms",
    payment_due_days: integerValue(formData, "payment_due_days", 5),
    active: formData.get("active") === "on",
    notes: optionalText(formData, "notes"),
    updated_at: new Date().toISOString(),
  };

  let savedOwnerId = ownerId;

  if (ownerId) {
    const { error } = await supabase
      .from("owners")
      .update(payload)
      .eq("id", ownerId);

    if (error) {
      throw new Error(`Impossible de mettre à jour le propriétaire : ${error.message}`);
    }
  } else {
    const { data, error } = await supabase
      .from("owners")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Impossible de créer le propriétaire : ${error?.message}`);
    }

    savedOwnerId = data.id;
  }

  if (!savedOwnerId) {
    throw new Error("Propriétaire introuvable après sauvegarde.");
  }

  await uploadOwnerProfilePhoto({
    supabase,
    ownerId: savedOwnerId,
    formData,
  });

  await supabase
    .from("properties")
    .update({ owner_id: null })
    .eq("owner_id", savedOwnerId);

  if (propertyIds.length > 0) {
    const { error: propertyError } = await supabase
      .from("properties")
      .update({ owner_id: savedOwnerId })
      .in("id", propertyIds);

    if (propertyError) {
      throw new Error(`Impossible d’assigner les biens : ${propertyError.message}`);
    }
  }

  revalidatePath("/admin/owners");
}

export async function deactivateOwner(formData: FormData) {
  await requireAdmin();

  const ownerId = textValue(formData, "owner_id");
  if (!ownerId) throw new Error("Propriétaire manquant.");

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("owners")
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ownerId);

  if (error) {
    throw new Error(`Impossible de désactiver le propriétaire : ${error.message}`);
  }

  revalidatePath("/admin/owners");
}
