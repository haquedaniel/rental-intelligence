"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function loadRequestByToken(token: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("monthly_payment_requests")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Demande de paiement introuvable.");
  }

  return data;
}

export async function markPaymentRequestPaid(formData: FormData) {
  const token = textValue(formData, "token");

  if (!token) {
    throw new Error("Lien de paiement manquant.");
  }

  const supabase = getSupabaseAdmin();
  const request = await loadRequestByToken(token);

  if (["refused", "cancelled", "withdrawn"].includes(String(request.status))) {
    throw new Error("Cette demande ne peut plus être marquée comme payée.");
  }

  if (request.status === "paid") {
    revalidatePath(`/owner/payments/${token}`);
    return;
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("monthly_payment_requests")
    .update({
      status: "paid",
      paid_at: now,
      updated_at: now,
    })
    .eq("id", request.id);

  if (error) {
    throw new Error(`Impossible de marquer la demande comme payée : ${error.message}`);
  }

  revalidatePath(`/owner/payments/${token}`);
  revalidatePath("/admin/payments");
}

export async function refusePaymentRequest(formData: FormData) {
  const token = textValue(formData, "token");
  const reason = textValue(formData, "reason");

  if (!token) {
    throw new Error("Lien de paiement manquant.");
  }

  if (!reason) {
    throw new Error("Merci d’indiquer un motif de refus.");
  }

  const supabase = getSupabaseAdmin();
  const request = await loadRequestByToken(token);

  if (["paid", "cancelled", "withdrawn"].includes(String(request.status))) {
    throw new Error("Cette demande ne peut plus être refusée.");
  }

  if (request.status === "refused") {
    revalidatePath(`/owner/payments/${token}`);
    return;
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("monthly_payment_requests")
    .update({
      status: "refused",
      refused_at: now,
      owner_refusal_reason: reason,
      updated_at: now,
    })
    .eq("id", request.id);

  if (error) {
    throw new Error(`Impossible de refuser la demande : ${error.message}`);
  }

  revalidatePath(`/owner/payments/${token}`);
  revalidatePath("/admin/payments");
}
