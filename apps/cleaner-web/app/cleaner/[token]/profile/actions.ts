"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const SUPPORTED_LANGUAGES = new Set(["fr", "en", "ru"]);

export async function updateCleanerPreferredLanguage(
  token: string,
  formData: FormData,
) {
  const raw = String(formData.get("preferred_language") ?? "fr");
  const preferredLanguage = SUPPORTED_LANGUAGES.has(raw) ? raw : "fr";

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("cleaners")
    .update({ preferred_language: preferredLanguage })
    .eq("public_token", token);

  if (error) {
    throw new Error(`Impossible d'enregistrer la langue : ${error.message}`);
  }

  redirect(`/cleaner/${token}/profile?updated=1`);
}
