
"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function markOwnerPaymentPaid(formData: FormData) {
  const token = textValue(formData, "token");
  if (!token) throw new Error("Demande introuvable.");

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("monthly_payment_requests")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("public_token", token)
    .neq("status", "paid");

  if (error) {
    throw new Error(`Impossible de marquer la demande comme payée : ${error.message}`);
  }

  revalidatePath(`/owner/payments/${token}`);
}
