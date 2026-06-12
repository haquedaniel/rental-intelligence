"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
