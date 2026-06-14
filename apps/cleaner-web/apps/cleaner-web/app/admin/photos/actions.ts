"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function safeFilename(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "photo.jpg"
  );
}

function redirectToPhotos(propertyId: string): never {
  revalidatePath("/admin/photos");
  redirect(`/admin/photos?property_id=${propertyId}`);
}

export async function uploadReferencePhoto(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const placement = textValue(formData, "placement");
  const title = textValue(formData, "title") || "Photo modèle";
  const displayOrderRaw = textValue(formData, "display_order");
  const displayOrder = displayOrderRaw ? Number(displayOrderRaw) : 100;

  const file = formData.get("photo");

  if (!propertyId) {
    throw new Error("Property missing");
  }

  if (!placement) {
    throw new Error("Placement missing");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Aucune photo sélectionnée");
  }

  const isCover = placement === "cover";
  const sectionKey = isCover ? null : placement;
  const bucket = "cleaning-reference-photos";
  const filename = safeFilename(file.name || "photo.jpg");
  const folder = isCover ? "cover" : sectionKey;

  const storagePath = [
    "properties",
    propertyId,
    folder,
    `${Date.now()}-${randomUUID()}-${filename}`,
  ].join("/");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Impossible d'envoyer la photo : ${uploadError.message}`);
  }

  if (isCover) {
    const { error: clearCoverError } = await supabase
      .from("property_reference_photos")
      .update({
        is_cover: false,
        updated_at: new Date().toISOString(),
      })
      .eq("property_id", propertyId);

    if (clearCoverError) {
      throw new Error(`Impossible de réinitialiser la couverture : ${clearCoverError.message}`);
    }
  }

  const { error: insertError } = await supabase
    .from("property_reference_photos")
    .insert({
      property_id: propertyId,
      section_key: sectionKey,
      title,
      storage_bucket: bucket,
      storage_path: storagePath,
      is_cover: isCover,
      display_order: isCover ? 0 : displayOrder,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

  if (insertError) {
    throw new Error(`Impossible d'enregistrer la photo : ${insertError.message}`);
  }

  redirectToPhotos(propertyId);
}

export async function updateReferencePhoto(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const photoId = textValue(formData, "photo_id");
  const placement = textValue(formData, "placement");
  const title = textValue(formData, "title") || "Photo modèle";
  const displayOrderRaw = textValue(formData, "display_order");
  const displayOrder = displayOrderRaw ? Number(displayOrderRaw) : 100;
  const isActive = formData.get("is_active") === "on";

  if (!propertyId || !photoId || !placement) {
    throw new Error("Données photo incomplètes");
  }

  const isCover = placement === "cover";
  const sectionKey = isCover ? null : placement;

  if (isCover) {
    const { error: clearCoverError } = await supabase
      .from("property_reference_photos")
      .update({
        is_cover: false,
        updated_at: new Date().toISOString(),
      })
      .eq("property_id", propertyId)
      .neq("id", photoId);

    if (clearCoverError) {
      throw new Error(`Impossible de changer la couverture : ${clearCoverError.message}`);
    }
  }

  const { error: updateError } = await supabase
    .from("property_reference_photos")
    .update({
      title,
      section_key: sectionKey,
      is_cover: isCover,
      display_order: isCover ? 0 : displayOrder,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .eq("property_id", propertyId);

  if (updateError) {
    throw new Error(`Impossible de modifier la photo : ${updateError.message}`);
  }

  redirectToPhotos(propertyId);
}

export async function deactivateReferencePhoto(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const photoId = textValue(formData, "photo_id");

  if (!propertyId || !photoId) {
    throw new Error("Données photo incomplètes");
  }

  const { error } = await supabase
    .from("property_reference_photos")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .eq("property_id", propertyId);

  if (error) {
    throw new Error(`Impossible de désactiver la photo : ${error.message}`);
  }

  redirectToPhotos(propertyId);
}
