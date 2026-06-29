"use server";

import { randomUUID } from "crypto";
import { Buffer } from "node:buffer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BASE_URL =
  process.env.CLEANER_WEB_BASE_URL ||
  process.env.PAYMENT_REQUEST_BASE_URL ||
  "https://missions.leclosdelavoilerie.com";

const REFERENCE_BUCKET = "intervention-reference-photos";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string, fallback = 0): number {
  const raw = textValue(formData, key).replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function boolValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function toIsoOrNull(raw: string): string | null {
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function displayName(row: Record<string, any> | null | undefined): string {
  if (!row) return "Intervenant";
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.trading_name || "Intervenant";
}

function propertyName(row: Record<string, any> | null | undefined): string {
  if (!row) return "Logement";
  return row.name || row.title || row.display_name || row.internal_name || "Logement";
}

async function uploadReferencePhoto(
  formData: FormData,
  requestId: string,
): Promise<{ bucket: string; path: string } | null> {
  const file = formData.get("reference_photo");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const filename = `${Date.now()}-${randomUUID()}-${safeFilename(file.name || "reference.jpg")}`;
  const path = `${requestId}/${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(REFERENCE_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(`Impossible d’envoyer la photo : ${error.message}`);
  }

  return { bucket: REFERENCE_BUCKET, path };
}

async function enqueueCleanerOfferSms({
  requestId,
  publicToken,
  cleaner,
  property,
  title,
  deadlineIso,
}: {
  requestId: string;
  publicToken: string;
  cleaner: Record<string, any>;
  property: Record<string, any>;
  title: string;
  deadlineIso: string | null;
}) {
  const phone = String(cleaner.phone ?? "").trim();

  if (!phone) {
    return;
  }

  const link = `${BASE_URL.replace(/\/$/, "")}/mission/${publicToken}/intervention`;
  const deadline = deadlineIso
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(new Date(deadlineIso))
    : "à convenir";

  const body = [
    `Bonjour ${displayName(cleaner)} 👋`,
    "",
    "Nouvelle intervention proposée.",
    `🏠 ${propertyName(property)}`,
    `🛠️ ${title}`,
    `⏱️ À faire avant : ${deadline}`,
    "",
    "Répondre ici :",
    link,
  ].join("\n");

  const { error } = await getSupabaseAdmin()
    .from("outbound_messages")
    .insert({
      channel: "sms",
      message_type: "intervention_offer",
      recipient_phone: phone,
      body,
      status: "pending",
      provider: "twilio",
      cleaning_request_id: requestId,
      event_key: `intervention_offer:${requestId}:${Date.now()}`,
      created_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Intervention créée, mais SMS non préparé : ${error.message}`);
  }
}

export async function createInterventionMission(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const cleanerId = textValue(formData, "cleaner_id");
  const title = textValue(formData, "title");
  const missionDescription = textValue(formData, "mission_description");
  const scheduledStartAt = toIsoOrNull(textValue(formData, "scheduled_start_at"));
  const deadlineAt = toIsoOrNull(textValue(formData, "deadline_at"));
  const estimatedHours = numberValue(formData, "estimated_hours", 1);
  const hourlyRate = numberValue(formData, "hourly_rate_eur", 0);
  const proofPhotoRequirement = textValue(formData, "proof_photo_requirement") || "optional";

  if (!propertyId || !cleanerId || !title || !deadlineAt) {
    throw new Error("Logement, intervenant, titre et échéance sont obligatoires.");
  }

  const [{ data: cleaner, error: cleanerError }, { data: property, error: propertyError }] =
    await Promise.all([
      supabase.from("cleaners").select("*").eq("id", cleanerId).maybeSingle(),
      supabase.from("properties").select("*").eq("id", propertyId).maybeSingle(),
    ]);

  if (cleanerError || !cleaner) {
    throw new Error(`Intervenant introuvable : ${cleanerError?.message ?? ""}`);
  }

  if (propertyError || !property) {
    throw new Error(`Logement introuvable : ${propertyError?.message ?? ""}`);
  }

  const publicToken = randomUUID().replaceAll("-", "");
  const totalCost = Math.round(estimatedHours * hourlyRate * 100) / 100;
  const now = new Date().toISOString();

  const { data: request, error } = await supabase
    .from("cleaning_requests")
    .insert({
      mission_type: "intervention",
      mission_category: textValue(formData, "mission_category") || "other",
      title,
      mission_description: missionDescription || null,
      property_id: propertyId,
      assigned_cleaner_id: cleanerId,
      public_token: publicToken,
      status: "sent",
      scheduled_start_at: scheduledStartAt || deadlineAt,
      scheduled_end_at: deadlineAt,
      ready_by_at: deadlineAt,
      estimated_hours: estimatedHours,
      hourly_rate_eur_snapshot: hourlyRate,
      total_cost_eur: totalCost,
      proof_photo_requirement: proofPhotoRequirement,
      allow_actual_hours_edit: true,
      allow_material_expenses: boolValue(formData, "allow_material_expenses"),
      no_backup_escalation: true,
      occupied_warning_acknowledged_at: boolValue(formData, "occupied_warning_acknowledged")
        ? now
        : null,
      created_at: now,
      updated_at: now,
    })
    .select("id,public_token")
    .single();

  if (error) {
    throw new Error(`Impossible de créer l’intervention : ${error.message}`);
  }

  const uploadedReference = await uploadReferencePhoto(formData, request.id);

  if (uploadedReference) {
    await supabase
      .from("cleaning_requests")
      .update({
        reference_photo_bucket: uploadedReference.bucket,
        reference_photo_path: uploadedReference.path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);
  }

  await enqueueCleanerOfferSms({
    requestId: request.id,
    publicToken,
    cleaner,
    property,
    title,
    deadlineIso: deadlineAt,
  });

  revalidatePath("/admin/interventions");
  redirect("/admin/interventions?created=1");
}
