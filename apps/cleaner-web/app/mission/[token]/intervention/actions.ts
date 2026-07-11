"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logCleaningRequestEvent } from "@/lib/operationalEventLog";

const BASE_URL =
  process.env.CLEANER_WEB_BASE_URL ||
  process.env.PAYMENT_REQUEST_BASE_URL ||
  "https://missions.leclosdelavoilerie.com";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function isReservationCancelled(reservation: Record<string, any>): boolean {
  if (reservation.cancelled_at || reservation.canceled_at) return true;

  const statusText = [
    reservation.status,
    reservation.booking_status,
    reservation.reservation_status,
    reservation.source_status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return statusText.includes("cancel") || statusText.includes("annul");
}

function overlaps(start: Date, end: Date, reservation: Record<string, any>): boolean {
  if (!reservation.checkin_at || !reservation.checkout_at) return false;

  const checkin = new Date(reservation.checkin_at);
  const checkout = new Date(reservation.checkout_at);

  return start < checkout && end > checkin;
}

function fullDateTimeLabel(value?: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
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
  const selectedStartRaw = textValue(formData, "selected_start_at");

  if (!token) throw new Error("Lien mission manquant.");
  if (!selectedStartRaw) throw new Error("Merci de choisir un créneau d’intervention.");

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

  const selectedStart = new Date(selectedStartRaw);
  if (Number.isNaN(selectedStart.getTime())) {
    throw new Error("Créneau invalide.");
  }

  const estimatedHours = Math.max(Number(request.estimated_hours ?? 1), 0.25);
  const selectedEnd = addHours(selectedStart, estimatedHours);

  const windowStart = new Date(
    request.work_window_start_at ||
      request.scheduled_start_at ||
      request.created_at,
  );

  const deadline = new Date(
    request.work_window_end_at ||
      request.completion_deadline_at ||
      request.scheduled_end_at,
  );

  if (selectedStart < windowStart) {
    throw new Error("Le créneau choisi est avant le début autorisé.");
  }

  if (selectedEnd > deadline) {
    throw new Error("Le créneau choisi dépasse l’échéance de l’intervention.");
  }

  if (!request.allow_occupied_intervention) {
    const { data: reservations } = await supabase
      .from("reservations")
      .select("*")
      .eq("property_id", request.property_id)
      .lt("checkin_at", selectedEnd.toISOString())
      .gt("checkout_at", selectedStart.toISOString());

    const blocking = ((reservations ?? []) as any[])
      .filter((reservation) => !isReservationCancelled(reservation))
      .filter((reservation) => overlaps(selectedStart, selectedEnd, reservation));

    if (blocking.length > 0) {
      throw new Error(
        "Ce créneau tombe pendant une période occupée. Le propriétaire n’a pas autorisé les interventions pendant occupation.",
      );
    }
  }

  const now = new Date().toISOString();
  const selectedStartIso = selectedStart.toISOString();
  const selectedEndIso = selectedEnd.toISOString();

  const { error: updateError } = await supabase
    .from("cleaning_requests")
    .update({
      status: "accepted",
      accepted_at: now,
      scheduled_start_at: selectedStartIso,
      scheduled_end_at: selectedEndIso,
      ready_by_at: selectedEndIso,
      ready_by_date: selectedEndIso.slice(0, 10),
      schedule_status: "confirmed",
      updated_at: now,
    })
    .eq("id", request.id);

  if (updateError) {
    throw new Error(`Impossible d’accepter : ${updateError.message}`);
  }

  await logCleaningRequestEvent(supabase, request.id, {
    eventType: "intervention_accepted",
    severity: "info",
    source: "intervention_action",
    actorType: "cleaner",
    actorId: request.assigned_cleaner_id,
    statusBefore: request.status,
    statusAfter: "accepted",
    reasonCode: "intervenant_selected_slot",
    reason: "Intervenant accepted the intervention and selected a slot.",
    title: "Intervention acceptée",
    summary: request.title,
    eventKey: `intervention:${request.id}:accepted:${selectedStartIso}`,
    context: {
      token,
      selected_start_at: selectedStartIso,
      selected_end_at: selectedEndIso,
      estimated_hours: estimatedHours,
      allow_occupied_intervention: request.allow_occupied_intervention ?? null,
    },
  });

  await enqueueOwnerSms(
    request,
    [
      "Intervention acceptée",
      `${request.cleaners?.first_name ?? "L’intervenant"} a accepté : ${request.title}`,
      `Créneau : ${fullDateTimeLabel(selectedStartIso)} → ${fullDateTimeLabel(selectedEndIso)}`,
      `Mission : ${BASE_URL.replace(/\/$/, "")}/mission/${token}/intervention`,
    ].join("\n"),
  );

  revalidatePath(`/mission/${token}/intervention`);
  redirect(`/mission/${token}/intervention`);
}


export async function changeInterventionSlot(formData: FormData) {
  const token = textValue(formData, "token");
  const selectedStartRaw = textValue(formData, "selected_start_at");

  if (!token) throw new Error("Lien mission manquant.");
  if (!selectedStartRaw) throw new Error("Merci de choisir un nouveau créneau.");

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

  if (request.status !== "accepted") {
    throw new Error("Le créneau ne peut être modifié que pour une intervention acceptée.");
  }

  const selectedStart = new Date(selectedStartRaw);
  if (Number.isNaN(selectedStart.getTime())) {
    throw new Error("Créneau invalide.");
  }

  const estimatedHours = Math.max(Number(request.estimated_hours ?? 1), 0.25);
  const selectedEnd = addHours(selectedStart, estimatedHours);

  const windowStart = new Date(
    request.work_window_start_at ||
      request.scheduled_start_at ||
      request.created_at,
  );

  const deadline = new Date(
    request.work_window_end_at ||
      request.completion_deadline_at ||
      request.scheduled_end_at,
  );

  if (selectedStart < windowStart) {
    throw new Error("Le créneau choisi est avant le début autorisé.");
  }

  if (selectedEnd > deadline) {
    throw new Error("Le créneau choisi dépasse l’échéance de l’intervention.");
  }

  if (!request.allow_occupied_intervention) {
    const { data: reservations } = await supabase
      .from("reservations")
      .select("*")
      .eq("property_id", request.property_id)
      .lt("checkin_at", selectedEnd.toISOString())
      .gt("checkout_at", selectedStart.toISOString());

    const blocking = ((reservations ?? []) as any[])
      .filter((reservation) => !isReservationCancelled(reservation))
      .filter((reservation) => overlaps(selectedStart, selectedEnd, reservation));

    if (blocking.length > 0) {
      throw new Error(
        "Ce créneau tombe pendant une période occupée. Le propriétaire n’a pas autorisé les interventions pendant occupation.",
      );
    }
  }

  const now = new Date().toISOString();
  const selectedStartIso = selectedStart.toISOString();
  const selectedEndIso = selectedEnd.toISOString();

  const { error: updateError } = await supabase
    .from("cleaning_requests")
    .update({
      scheduled_start_at: selectedStartIso,
      scheduled_end_at: selectedEndIso,
      ready_by_at: selectedEndIso,
      ready_by_date: selectedEndIso.slice(0, 10),
      schedule_status: "confirmed",
      updated_at: now,
    })
    .eq("id", request.id);

  if (updateError) {
    throw new Error(`Impossible de modifier le créneau : ${updateError.message}`);
  }

  await logCleaningRequestEvent(supabase, request.id, {
    eventType: "intervention_slot_changed",
    severity: "info",
    source: "intervention_action",
    actorType: "cleaner",
    actorId: request.assigned_cleaner_id,
    statusBefore: request.status,
    statusAfter: request.status,
    reasonCode: "intervenant_changed_slot",
    reason: "Intervenant changed the accepted intervention slot.",
    title: "Créneau intervention modifié",
    summary: request.title,
    eventKey: `intervention:${request.id}:slot_changed:${selectedStartIso}`,
    context: {
      token,
      previous_scheduled_start_at: request.scheduled_start_at ?? null,
      previous_scheduled_end_at: request.scheduled_end_at ?? null,
      selected_start_at: selectedStartIso,
      selected_end_at: selectedEndIso,
      estimated_hours: estimatedHours,
    },
  });

  await enqueueOwnerSms(
    request,
    [
      "Créneau d’intervention modifié",
      `${request.cleaners?.first_name ?? "L’intervenant"} a modifié le créneau : ${request.title}`,
      `Nouveau créneau : ${fullDateTimeLabel(selectedStartIso)} → ${fullDateTimeLabel(selectedEndIso)}`,
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

  await logCleaningRequestEvent(supabase, request.id, {
    eventType: "intervention_refused",
    severity: "warning",
    source: "intervention_action",
    actorType: "cleaner",
    actorId: request.assigned_cleaner_id,
    statusBefore: request.status,
    statusAfter: "refused",
    reasonCode: "intervenant_refused",
    reason: reason || "No reason provided.",
    title: "Intervention refusée",
    summary: request.title,
    eventKey: `intervention:${request.id}:refused:${now}`,
    context: {
      token,
      refusal_reason: reason || null,
      no_backup_escalation: request.no_backup_escalation ?? null,
    },
  });

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
