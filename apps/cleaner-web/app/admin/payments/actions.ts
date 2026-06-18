
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function markPaymentPaid(formData: FormData) {
  await requireAdmin();

  const id = textValue(formData, "id");
  if (!id) throw new Error("Demande manquante.");

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("monthly_payment_requests")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Impossible de marquer comme payé : ${error.message}`);
  }

  revalidatePath("/admin/payments");
}
