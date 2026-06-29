"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function completeCleanerOnboarding(formData: FormData) {
  const token = String(formData.get("cleaner_token") ?? "").trim();

  if (!token) {
    throw new Error("Lien intervenante manquant.");
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("cleaners")
    .update({
      app_onboarded_at: now,
      app_first_opened_at: now,
      updated_at: now,
    })
    .eq("public_token", token);

  if (error) {
    throw new Error(`Impossible de terminer l’accueil : ${error.message}`);
  }

  revalidatePath(`/cleaner/${token}`);
  redirect(`/cleaner/${token}`);
}
