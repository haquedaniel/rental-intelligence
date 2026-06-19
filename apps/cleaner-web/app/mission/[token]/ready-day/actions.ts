"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fullDateTimeLabel } from "@/lib/missionReadyDays";
import {
  backupMissionOfferMessage,
  missionAcceptedCleanerMessage,
  missionAcceptedOwnerMessage,
  missionRefusedCleanerMessage,
  missionRefusedOwnerNoBackupMessage,
  missionRefusedOwnerWithBackupMessage,
} from "@/lib/messageTemplates";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function makeToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function siteBaseUrl(): string {
  return (
    process.env.CLEANER_WEB_BASE_URL ||
    process.env.PAYMENT_REQUEST_BASE_URL ||
    "https://missions.leclosdelavoilerie.com"
  );
}

function displayName(person?: Record<string, any> | null, fallback = "Intervenante"): string {
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim();
  return name || person?.display_name || person?.legal_name || fallback;
}

async function enqueueSms({
  body,
  phone,
  cleaningRequestId,
  cleanerId,
  ownerId,
  testScenarioId,
  eventKey,
  messageType = "mission_update",
}: {
  body: string;
  phone?: string | null;
  cleaningRequestId: string;
  cleanerId?: string | null;
  ownerId?: string | null;
  testScenarioId?: string | null;
  eventKey: string;
  messageType?: string;
}) {
  if (!phone) return;

  const supabase = getSupabaseAdmin();
  const isTest = Boolean(testScenarioId);

  const payload = {
    channel: "sms",
    message_type: messageType,
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
  };

  const { error } = await supabase.from("outbound_messages").insert(payload);

  if (error) {
    throw new Error(`Impossible de créer le SMS : ${error.message}`);
  }
}

async function findFallbackBackupCleaner(propertyId: string, currentCleanerId?: string | null) {
  const supabase = getSupabaseAdmin();

  const { data: assignments, error } = await supabase
    .from("property_cleaner_assignments")
    .select("*")
    .eq("property_id", propertyId)
    .eq("active", true)
    .order("priority", { ascending: true });

  if (error) {
    throw new Error(`Impossible de trouver les intervenantes assignées : ${error.message}`);
  }

  const rows = assignments ?? [];
  const currentAssignment = rows.find((assignment) => assignment.cleaner_id === currentCleanerId);

  // Only auto-fallback when the primary refuses.
  // If the backup refuses, we stop and ask for manual resolution.
  if (currentAssignment && currentAssignment.role !== "primary") {
    return null;
  }

  const backupAssignment =
    rows.find(
      (assignment) =>
        assignment.role === "backup" &&
        assignment.cleaner_id &&
        assignment.cleaner_id !== currentCleanerId,
    ) ??
    rows.find(
      (assignment) =>
        assignment.cleaner_id &&
        assignment.cleaner_id !== currentCleanerId,
    );

  if (!backupAssignment?.cleaner_id) return null;

  const { data: cleaner, error: cleanerError } = await supabase
    .from("cleaners")
    .select("*")
    .eq("id", backupAssignment.cleaner_id)
    .maybeSingle();

  if (cleanerError) {
    throw new Error(`Impossible de charger l’intervenante backup : ${cleanerError.message}`);
  }

  return cleaner;
}

async function copyReadyDayOptionsToBackup({
  originalRequestId,
  newRequestId,
  backupCleanerId,
  testScenarioId,
}: {
  originalRequestId: string;
  newRequestId: string;
  backupCleanerId: string;
  testScenarioId?: string | null;
}) {
  const supabase = getSupabaseAdmin();

  const { data: oldOptions, error } = await supabase
    .from("cleaning_request_ready_day_options")
    .select("*")
    .eq("cleaning_request_id", originalRequestId)
    .eq("is_available", true)
    .order("ready_by_at", { ascending: true });

  if (error) {
    throw new Error(`Impossible de copier les jours proposés : ${error.message}`);
  }

  if (!oldOptions || oldOptions.length === 0) return;

  const { error: insertError } = await supabase
    .from("cleaning_request_ready_day_options")
    .insert(
      oldOptions.map((option) => ({
        cleaning_request_id: newRequestId,
        cleaner_id: backupCleanerId,
        ready_by_date: option.ready_by_date,
        ready_by_at: option.ready_by_at,
        label: option.label,
        is_available: true,
        disabled_reason: null,
        test_scenario_id: testScenarioId ?? null,
      })),
    );

  if (insertError) {
    throw new Error(`Impossible de créer les jours pour le backup : ${insertError.message}`);
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
  const cleanerName = displayName(cleaner);
  const readyLabel = fullDateTimeLabel(option.ready_by_at);
  const baseUrl = siteBaseUrl();

  await enqueueSms({
    phone: cleaner?.phone,
    cleaningRequestId: request.id,
    cleanerId: cleaner?.id,
    ownerId: owner?.id,
    testScenarioId: request.test_scenario_id,
    eventKey: `mission_accept_cleaner:${request.id}:${option.id}`,
    messageType: "mission_ready_day_confirmed_cleaner",
    body: missionAcceptedCleanerMessage({
      propertyName,
      readyByLabel: readyLabel,
      reportUrl: `${baseUrl}/mission/${token}/report`,
      isTest: Boolean(request.test_scenario_id),
    }),
  });

  await enqueueSms({
    phone: owner?.phone,
    cleaningRequestId: request.id,
    cleanerId: cleaner?.id,
    ownerId: owner?.id,
    testScenarioId: request.test_scenario_id,
    eventKey: `mission_accept_owner:${request.id}:${option.id}`,
    messageType: "mission_ready_day_confirmed_owner",
    body: missionAcceptedOwnerMessage({
      propertyName,
      cleanerName,
      readyByLabel: readyLabel,
      isTest: Boolean(request.test_scenario_id),
    }),
  });

  revalidatePath(`/mission/${token}/ready-day`);
  revalidatePath("/admin/test-lab");
  revalidatePath("/admin/operations");
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

  const { data: request, error: requestError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (requestError || !request) {
    throw new Error("Mission introuvable.");
  }

  const now = new Date().toISOString();

  const [{ data: property }, { data: primaryCleaner }] = await Promise.all([
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
  const primaryName = displayName(primaryCleaner);
  const backupCleaner = request.property_id
    ? await findFallbackBackupCleaner(request.property_id, request.assigned_cleaner_id)
    : null;

  const originalScheduleStatus = backupCleaner ? "refused" : "needs_manual_reassignment";

  const { error: refuseError } = await supabase
    .from("cleaning_requests")
    .update({
      status: "refused",
      refused_at: now,
      refusal_reason: refusalReason,
      schedule_status: originalScheduleStatus,
      admin_notes: [
        request.admin_notes,
        `Refus le ${now}. Raison : ${refusalReason}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      updated_at: now,
    })
    .eq("id", request.id);

  if (refuseError) {
    throw new Error(`Impossible de refuser la mission : ${refuseError.message}`);
  }

  await enqueueSms({
    phone: primaryCleaner?.phone,
    cleaningRequestId: request.id,
    cleanerId: primaryCleaner?.id,
    ownerId: owner?.id,
    testScenarioId: request.test_scenario_id,
    eventKey: `mission_refused_primary:${request.id}:${now}`,
    messageType: "mission_refused_cleaner",
    body: missionRefusedCleanerMessage({
      propertyName,
      refusalReason,
      isTest: Boolean(request.test_scenario_id),
    }),
  });

  if (backupCleaner) {
    const backupToken = makeToken();

    const { data: backupRequest, error: backupInsertError } = await supabase
      .from("cleaning_requests")
      .insert({
        property_id: request.property_id,
        reservation_id: request.reservation_id,
        cleaning_profile_id: request.cleaning_profile_id,
        assigned_cleaner_id: backupCleaner.id,

        scheduled_start_at: request.scheduled_start_at,
        scheduled_end_at: request.scheduled_end_at,
        work_window_start_at: request.work_window_start_at,
        work_window_end_at: request.work_window_end_at,
        completion_deadline_at: request.completion_deadline_at,

        status: "sent",
        schedule_status: "waiting_for_ready_day",
        urgent: request.urgent,
        response_deadline_at: request.response_deadline_at,

        number_of_guests: request.number_of_guests,
        linen_required: request.linen_required,
        laundry_required: request.laundry_required,

        estimated_hours: request.estimated_hours,
        cleaning_cost_eur: request.cleaning_cost_eur,
        travel_distance_km: request.travel_distance_km,
        billable_travel_km: request.billable_travel_km,
        travel_cost_eur: request.travel_cost_eur,
        urgency_bonus_percent: request.urgency_bonus_percent,
        urgency_bonus_eur: request.urgency_bonus_eur,
        total_cost_eur: request.total_cost_eur,

        public_token: backupToken,
        mission_origin: request.mission_origin,
        service_type: request.service_type,
        title: request.title || "Ménage après séjour",

        assignment_reason: `backup_after_refusal:${request.id}`,
        admin_notes: `Mission créée automatiquement après refus de ${primaryName}.`,
        test_scenario_id: request.test_scenario_id,
      })
      .select("*")
      .single();

    if (backupInsertError || !backupRequest) {
      throw new Error(`Impossible de créer la mission backup : ${backupInsertError?.message}`);
    }

    await copyReadyDayOptionsToBackup({
      originalRequestId: request.id,
      newRequestId: backupRequest.id,
      backupCleanerId: backupCleaner.id,
      testScenarioId: request.test_scenario_id,
    });

    const baseUrl = siteBaseUrl();
    const backupName = displayName(backupCleaner);

    await enqueueSms({
      phone: backupCleaner.phone,
      cleaningRequestId: backupRequest.id,
      cleanerId: backupCleaner.id,
      ownerId: owner?.id,
      testScenarioId: request.test_scenario_id,
      eventKey: `mission_offer_backup_after_refusal:${backupRequest.id}:${now}`,
      messageType: "mission_offer_backup_after_refusal",
      body: backupMissionOfferMessage({
        propertyName,
        missionUrl: `${baseUrl}/mission/${backupToken}/ready-day`,
        cleanerFirstName: backupCleaner.first_name,
        isTest: Boolean(request.test_scenario_id),
      }),
    });

    await enqueueSms({
      phone: owner?.phone,
      cleaningRequestId: request.id,
      cleanerId: primaryCleaner?.id,
      ownerId: owner?.id,
      testScenarioId: request.test_scenario_id,
      eventKey: `mission_refused_owner_backup_sent:${request.id}:${backupRequest.id}:${now}`,
      messageType: "mission_refused_owner_backup_sent",
      body: missionRefusedOwnerWithBackupMessage({
        propertyName,
        primaryCleanerName: primaryName,
        backupCleanerName: backupName,
        refusalReason,
        isTest: Boolean(request.test_scenario_id),
      }),
    });
  } else {
    await enqueueSms({
      phone: owner?.phone,
      cleaningRequestId: request.id,
      cleanerId: primaryCleaner?.id,
      ownerId: owner?.id,
      testScenarioId: request.test_scenario_id,
      eventKey: `mission_refused_owner_no_backup:${request.id}:${now}`,
      messageType: "mission_refused_owner_no_backup",
      body: missionRefusedOwnerNoBackupMessage({
        propertyName,
        primaryCleanerName: primaryName,
        refusalReason,
        isTest: Boolean(request.test_scenario_id),
      }),
    });
  }

  revalidatePath(`/mission/${token}/ready-day`);
  revalidatePath("/admin/test-lab");
  revalidatePath("/admin/operations");
}
