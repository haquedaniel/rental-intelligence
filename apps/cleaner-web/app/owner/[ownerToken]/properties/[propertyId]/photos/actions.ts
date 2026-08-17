"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PHOTO_BUCKET = "property-listing-photos";
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const CATEGORIES = new Set([
  "living_room",
  "bedroom",
  "kitchen",
  "bathroom",
  "outdoor",
  "view",
  "dining",
  "other",
]);

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

function photosPath(ownerToken: string, propertyId: string) {
  return `/owner/${ownerToken}/properties/${propertyId}/photos`;
}

async function requireOwnedProperty(ownerToken: string, propertyId: string) {
  const token = decodeURIComponent(ownerToken || "").trim();
  if (!token || !propertyId) throw new Error("Logement introuvable");

  const supabase = getSupabaseAdmin();
  const { data: owner, error: ownerError } = await supabase
    .from("owners")
    .select("id")
    .eq("public_token", token)
    .eq("active", true)
    .maybeSingle();

  if (ownerError || !owner) throw new Error("Accès propriétaire invalide");

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id,name")
    .eq("id", propertyId)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (propertyError || !property) throw new Error("Logement introuvable");

  return { supabase, property };
}

function refresh(ownerToken: string, propertyId: string) {
  revalidatePath(photosPath(ownerToken, propertyId));
  revalidatePath(`/owner/${ownerToken}/properties`);
}

export async function uploadListingPhotos(
  ownerToken: string,
  propertyId: string,
  formData: FormData,
) {
  const { supabase } = await requireOwnedProperty(ownerToken, propertyId);
  const files = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) throw new Error("Sélectionnez au moins une photo");

  const { data: lastPhoto } = await supabase
    .from("property_listing_photos")
    .select("sort_order")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextOrder = Number(lastPhoto?.sort_order ?? 0) + 10;

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error(`${file.name}: le fichier n'est pas une image`);
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name}: la photo dépasse 15 Mo`);
    }

    const filename = safeFilename(file.name || "photo.jpg");
    const storagePath = [
      "properties",
      propertyId,
      "listing",
      `${Date.now()}-${randomUUID()}-${filename}`,
    ].join("/");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Impossible d'envoyer ${file.name}: ${uploadError.message}`);
    }

    const { error: insertError } = await supabase
      .from("property_listing_photos")
      .insert({
        property_id: propertyId,
        caption: "",
        category: "other",
        storage_bucket: PHOTO_BUCKET,
        storage_path: storagePath,
        sort_order: nextOrder,
        is_active: true,
        sync_status: "draft",
        sync_error: null,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
      throw new Error(`Impossible d'enregistrer ${file.name}: ${insertError.message}`);
    }

    nextOrder += 10;
  }

  refresh(ownerToken, propertyId);
}

export async function updateListingPhoto(
  ownerToken: string,
  propertyId: string,
  photoId: string,
  formData: FormData,
) {
  const { supabase } = await requireOwnedProperty(ownerToken, propertyId);
  const caption = String(formData.get("caption") ?? "").trim();
  const rawCategory = String(formData.get("category") ?? "other");
  const category = CATEGORIES.has(rawCategory) ? rawCategory : "other";

  const { error } = await supabase
    .from("property_listing_photos")
    .update({
      caption,
      category,
      airbnb_enabled: formData.get("airbnb_enabled") === "on",
      vrbo_enabled: formData.get("vrbo_enabled") === "on",
      booking_enabled: formData.get("booking_enabled") === "on",
      direct_enabled: formData.get("direct_enabled") === "on",
      sync_status: "draft",
      sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", photoId)
    .eq("property_id", propertyId);

  if (error) throw new Error(`Impossible de modifier la photo: ${error.message}`);
  refresh(ownerToken, propertyId);
}

export async function saveListingPhotoOrder(
  ownerToken: string,
  propertyId: string,
  orderedIds: string[],
) {
  const { supabase } = await requireOwnedProperty(ownerToken, propertyId);
  if (orderedIds.length === 0) return;

  const { data: existing, error: existingError } = await supabase
    .from("property_listing_photos")
    .select("id")
    .eq("property_id", propertyId)
    .eq("is_active", true);

  if (existingError) throw new Error(`Impossible de vérifier les photos: ${existingError.message}`);

  const existingIds = new Set((existing ?? []).map((row) => String(row.id)));
  if (
    existingIds.size !== orderedIds.length ||
    orderedIds.some((id) => !existingIds.has(id))
  ) {
    throw new Error("La galerie a changé. Rechargez la page avant de réordonner.");
  }

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("property_listing_photos")
      .update({
        sort_order: (index + 1) * 10,
        sync_status: "draft",
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("property_id", propertyId);

    if (error) throw new Error(`Impossible de réordonner les photos: ${error.message}`);
  }

  refresh(ownerToken, propertyId);
}

export async function deleteListingPhoto(
  ownerToken: string,
  propertyId: string,
  photoId: string,
) {
  const { supabase } = await requireOwnedProperty(ownerToken, propertyId);
  const { data: photo, error: photoError } = await supabase
    .from("property_listing_photos")
    .select("storage_bucket,storage_path")
    .eq("id", photoId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (photoError || !photo) throw new Error("Photo introuvable");

  const { error: deleteError } = await supabase
    .from("property_listing_photos")
    .delete()
    .eq("id", photoId)
    .eq("property_id", propertyId);

  if (deleteError) throw new Error(`Impossible de supprimer la photo: ${deleteError.message}`);

  await supabase.storage
    .from(photo.storage_bucket || PHOTO_BUCKET)
    .remove([photo.storage_path]);

  refresh(ownerToken, propertyId);
}

export async function prepareListingPhotoSync(
  ownerToken: string,
  propertyId: string,
) {
  const { supabase } = await requireOwnedProperty(ownerToken, propertyId);
  const { data: photos, error } = await supabase
    .from("property_listing_photos")
    .select("id,caption,airbnb_enabled,vrbo_enabled,booking_enabled,direct_enabled")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Impossible de vérifier la galerie: ${error.message}`);
  if (!photos?.length) throw new Error("Ajoutez au moins une photo avant de préparer la diffusion");

  const missingCaption = photos.some(
    (photo) =>
      !String(photo.caption ?? "").trim() &&
      (photo.airbnb_enabled || photo.vrbo_enabled || photo.booking_enabled),
  );

  const now = new Date().toISOString();
  const syncStatus = missingCaption ? "error" : "blocked_api";
  const syncError = missingCaption
    ? "Ajoutez une légende aux photos destinées aux plateformes."
    : "Galerie prête. La publication des photos n'est pas encore disponible dans l'API Beds24 V2.";

  const { error: updateError } = await supabase
    .from("property_listing_photos")
    .update({
      sync_status: syncStatus,
      sync_error: syncError,
      last_sync_at: now,
      updated_at: now,
    })
    .eq("property_id", propertyId)
    .eq("is_active", true);

  if (updateError) throw new Error(`Impossible de préparer la diffusion: ${updateError.message}`);
  refresh(ownerToken, propertyId);
}
