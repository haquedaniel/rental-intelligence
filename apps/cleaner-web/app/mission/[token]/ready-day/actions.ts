"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function acceptMissionReadyDay(formData: FormData) {
  const supabase = getSupabaseAdmin();

  const token = textValue(formData, "token");
  const optionId = textValue(formData, "option_id");

  if (!token || !optionId) {
    throw new Error("Mission ou jour choisi manquant.");
  }

  const { data: request, error: requestError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (requestError || !request) {
    throw new Error("Mission introuvable.");
  }

  if (request.schedule_status === "planning_changed") {
    throw new Error("Le planning a changé. Merci d’attendre une confirmation.");
  }

  const { data: option, error: optionError } = await supabase
    .from("cleaning_request_ready_day_options")
    .select("*")
    .eq("id", optionId)
    .eq("cleaning_request_id", request.id)
    .maybeSingle();

  if (optionError || !option) {
    throw new Error("Jour choisi introuvable.");
  }

  if (!option.is_available) {
    throw new Error("Ce jour n’est plus disponible.");
  }

  if (request.work_window_end_at && new Date(option.ready_by_at) > new Date(request.work_window_end_at)) {
    throw new Error("Ce jour dépasse la date limite de préparation.");
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("cleaning_requests")
    .update({
      status: "accepted",
      accepted_at: request.accepted_at ?? now,
      ready_by_at: option.ready_by_at,
      ready_by_date: option.ready_by_date,
      schedule_status: "scheduled",
      scheduled_end_at: option.ready_by_at,
      updated_at: now,
    })
    .eq("id", request.id);

  if (updateError) {
    throw new Error(`Impossible d’accepter la mission : ${updateError.message}`);
  }

  await supabase
    .from("cleaning_request_ready_day_options")
    .update({ selected_at: null })
    .eq("cleaning_request_id", request.id);

  await supabase
    .from("cleaning_request_ready_day_options")
    .update({ selected_at: now })
    .eq("id", option.id);

  revalidatePath(`/mission/${token}/ready-day`);
}

export async function refuseMissionFromReadyDay(formData: FormData) {
  const supabase = getSupabaseAdmin();

  const token = textValue(formData, "token");
  const refusalReason = textValue(formData, "refusal_reason");

  if (!token) {
    throw new Error("Mission manquante.");
  }

  if (!refusalReason) {
    throw new Error("Merci d’indiquer une raison.");
  }

  const { error } = await supabase
    .from("cleaning_requests")
    .update({
      status: "refused",
      refused_at: new Date().toISOString(),
      refusal_reason: refusalReason,
      schedule_status: "refused",
      updated_at: new Date().toISOString(),
    })
    .eq("public_token", token);

  if (error) {
    throw new Error(`Impossible de refuser la mission : ${error.message}`);
  }

  revalidatePath(`/mission/${token}/ready-day`);
}
