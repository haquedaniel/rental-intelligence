"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fullDateTimeLabel } from "@/lib/missionReadyDays";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function siteBaseUrl(): string {
  return (
    process.env.CLEANER_WEB_BASE_URL ||
    process.env.PAYMENT_REQUEST_BASE_URL ||
    "https://missions.leclosdelavoilerie.com"
  );
}

async function enqueueSms({
  body,
  phone,
  cleaningRequestId,
  cleanerId,
  ownerId,
  testScenarioId,
  eventKey,
}: {
  body: string;
  phone?: string | null;
  cleaningRequestId: string;
  cleanerId?: string | null;
  ownerId?: string | null;
  testScenarioId?: string | null;
  eventKey: string;
}) {
  if (!phone) return;

  const supabase = getSupabaseAdmin();
  const isTest = Boolean(testScenarioId);

  const { error } = await supabase.from("outbound_messages").insert({
    channel: "sms",
    message_type: "mission_ready_day_confirmed",
    recipient_phone: phone,
    body,
    status: isTest ? "sent" : "pending",
    provider: isTest ? "test_lab" : "twilio",
    cleaning_request_id: cleaningRequestId,
    cleaner_id: cleanerId ?? null,
    owner_id: ownerId ?? null,
    is_test: isTest,
    test_scenario_id: testScenarioId ?? null,
    event_key: eventKey,
  });

  if (error) {
    throw new Error(`Impossible de créer le SMS de confirmation : ${error.message}`);
  }
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

  const [{ data: property }, { data: cleaner }] = await Promise.all([
    request.property_id
      ? supabase.from("properties").select("id,name,owner_id").eq("id", request.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
    request.assigned_cleaner_id
      ? supabase.from("cleaners").select("id,first_name,last_name,phone").eq("id", request.assigned_cleaner_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: owner } = property?.owner_id
    ? await supabase.from("owners").select("id,display_name,phone").eq("id", property.owner_id).maybeSingle()
    : { data: null };

  const propertyName = property?.name ?? "Logement";
  const cleanerName = [cleaner?.first_name, cleaner?.last_name].filter(Boolean).join(" ") || "Intervenante";
  const readyLabel = fullDateTimeLabel(option.ready_by_at);
  const baseUrl = siteBaseUrl();

  await enqueueSms({
    phone: cleaner?.phone,
    cleaningRequestId: request.id,
    cleanerId: cleaner?.id,
    ownerId: owner?.id,
    testScenarioId: request.test_scenario_id,
    eventKey: `mission_accept_cleaner:${request.id}:${option.id}`,
    body: [
      request.test_scenario_id ? "TEST · Mission confirmée" : "Mission confirmée",
      `${propertyName}`,
      `Logement prévu prêt avant 16h le ${readyLabel}.`,
      `Rapport: ${baseUrl}/mission/${token}/report`,
    ].join("\n"),
  });

  await enqueueSms({
    phone: owner?.phone,
    cleaningRequestId: request.id,
    cleanerId: cleaner?.id,
    ownerId: owner?.id,
    testScenarioId: request.test_scenario_id,
    eventKey: `mission_accept_owner:${request.id}:${option.id}`,
    body: [
      request.test_scenario_id ? "TEST · Mission acceptée" : "Mission acceptée",
      `${cleanerName} a accepté la mission ${propertyName}.`,
      `Logement prévu prêt avant 16h le ${readyLabel}.`,
    ].join("\n"),
  });

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
