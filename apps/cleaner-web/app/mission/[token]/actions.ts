"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Buffer } from "node:buffer";

async function getRequestByToken(token: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("cleaning_requests")
    .select("id, status, public_token_expires_at")
    .eq("public_token", token)
    .single();

  if (error || !data) {
    throw new Error("Mission introuvable.");
  }

  if (data.public_token_expires_at) {
    const expiresAt = new Date(data.public_token_expires_at);
    if (expiresAt < new Date()) {
      throw new Error("Ce lien a expiré.");
    }
  }

  return data;
}

function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

async function uploadSectionPhotos({
  supabase,
  formData,
  sections,
  cleaningRequestId,
  cleaningReportId,
}: {
  supabase: ReturnType<typeof import("@/lib/supabaseAdmin").getSupabaseAdmin>;
  formData: FormData;
  sections: Array<{ section_key: string; photo_requirement?: string }>;
  cleaningRequestId: string;
  cleaningReportId: string;
}) {
  const bucket = "cleaning-report-photos";
  const rows = [];

  for (const section of sections) {
    if (section.photo_requirement === "none") continue;

    const value = formData.get(`photo_${section.section_key}`);

    if (!(value instanceof File)) continue;
    if (value.size === 0) continue;

    const originalName = value.name || "photo.jpg";
    const filename = safeFilename(originalName);
    const storagePath = [
      "reports",
      cleaningRequestId,
      cleaningReportId,
      section.section_key,
      `${Date.now()}-${crypto.randomUUID()}-${filename}`,
    ].join("/");

    const arrayBuffer = await value.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: value.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Impossible d'envoyer la photo ${section.section_key} : ${uploadError.message}`
      );
    }


    rows.push({
      cleaning_report_id: cleaningReportId,
      cleaning_request_id: cleaningRequestId,
      section_key: section.section_key,
      photo_type: "proof",
      storage_bucket: bucket,
      storage_path: storagePath,
      original_filename: originalName,
      content_type: value.type || null,
      size_bytes: value.size,
      caption: null,
    });
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("cleaning_report_photos")
      .insert(rows);

    if (insertError) {
      throw new Error(
        `Photos envoyées, mais métadonnées non enregistrées : ${insertError.message}`
      );
    }
  }

  return rows.length;
}

export async function acceptMission(formData: FormData) {
  const token = String(formData.get("token") || "");

  if (!token) {
    throw new Error("Token manquant.");
  }

  const request = await getRequestByToken(token);

  if (request.status !== "sent") {
    throw new Error("Cette mission ne peut plus être acceptée.");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("cleaning_requests")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/mission/${token}`);
}

export async function refuseMission(formData: FormData) {
  const token = String(formData.get("token") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!token) {
    throw new Error("Token manquant.");
  }

  if (!reason) {
    throw new Error("Merci d’indiquer une raison de refus.");
  }

  const request = await getRequestByToken(token);

  if (request.status !== "sent") {
    throw new Error("Cette mission ne peut plus être refusée.");
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("cleaning_requests")
    .update({
      status: "refused",
      refusal_reason: reason,
      refused_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/mission/${token}`);
}
