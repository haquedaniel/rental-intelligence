"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BASE_URL =
  process.env.CLEANER_WEB_BASE_URL ||
  process.env.PAYMENT_REQUEST_BASE_URL ||
  "https://missions.leclosdelavoilerie.com";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function ownerPhonesForProperty(propertyId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cleaning_sms_recipients")
    .select("*")
    .eq("property_id", propertyId)
    .eq("enabled", true);

  if (error || !data) {
    return [];
  }

  return data
    .map((row: any) => row.recipient_phone || row.phone || row.mobile)
    .filter(Boolean);
}

async function enqueueOwnerSms(request: any, body: string) {
  const phones = await ownerPhonesForProperty(String(request.property_id));

  await Promise.all(
    phones.map((phone) =>
      getSupabaseAdmin()
        .from("outbound_messages")
        .insert({
          channel: "sms",
          message_type: "intervention_owner_update",
          recipient_phone: phone,
          body,
          status: "pending",
          provider: "twilio",
          cleaning_request_id: request.id,
          event_key: `intervention_owner_update:${request.id}:${Date.now()}:${phone}`,
          created_at: new Date().toISOString(),
        }),
    ),
  );
}

export async function acceptIntervention(formData: FormData) {
  const token = textValue(formData, "token");

  if (!token) throw new Error("Lien mission manquant.");

  const supabase = getSupabaseAdmin();

  const { data: request, error } = await supabase
    .from("cleaning_requests")
    .select("*,cleaners(*),properties(*)")
    .eq("public_token", token)
    .eq("mission_type", "intervention")
    .maybeSingle();

  if (error || !request) {
    throw new Error(`Mission introuvable : ${error?.message ?? ""}`);
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("cleaning_requests")
    .update({
      status: "accepted",
      accepted_at: now,
      updated_at: now,
    })
    .eq("id", request.id);

  if (updateError) {
    throw new Error(`Impossible d’accepter : ${updateError.message}`);
  }

  await enqueueOwnerSms(
    request,
    [
      "Intervention acceptée",
      `${request.cleaners?.first_name ?? "L’intervenant"} a accepté : ${request.title}`,
      `Mission : ${BASE_URL.replace(/\/$/, "")}/mission/${token}/intervention`,
    ].join("\n"),
  );

  revalidatePath(`/mission/${token}/intervention`);
  redirect(`/mission/${token}/intervention`);
}

export async function refuseIntervention(formData: FormData) {
  const token = textValue(formData, "token");
  const reason = textValue(formData, "reason");

  if (!token) throw new Error("Lien mission manquant.");

  const supabase = getSupabaseAdmin();

  const { data: request, error } = await supabase
    .from("cleaning_requests")
    .select("*,cleaners(*),properties(*)")
    .eq("public_token", token)
    .eq("mission_type", "intervention")
    .maybeSingle();

  if (error || !request) {
    throw new Error(`Mission introuvable : ${error?.message ?? ""}`);
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("cleaning_requests")
    .update({
      status: "refused",
      intervention_refusal_reason: reason || null,
      updated_at: now,
    })
    .eq("id", request.id);

  if (updateError) {
    throw new Error(`Impossible de refuser : ${updateError.message}`);
  }

  await enqueueOwnerSms(
    request,
    [
      "Intervention refusée",
      `${request.cleaners?.first_name ?? "L’intervenant"} a refusé : ${request.title}`,
      reason ? `Raison : ${reason}` : null,
      "Aucun remplaçant automatique n’a été sollicité.",
    ].filter(Boolean).join("\n"),
  );

  revalidatePath(`/mission/${token}/intervention`);
  redirect(`/mission/${token}/intervention`);
}
