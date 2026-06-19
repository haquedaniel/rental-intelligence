import { missionOfferCleanerMessage } from "@/lib/messageTemplates";\n"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { missionOfferCleanerMessage } from "@/lib/messageTemplates";

import {
  addDaysToDateKey,
  buildReadyDayOptions,
  parisDateKey,
  parisLocalDateTimeToUtcIso,
} from "@/lib/missionReadyDays";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function token(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function tomorrowPlus(days: number): string {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, 12, 0, 0));
  return parisDateKey(base);
}

async function loadAssignedCleaners(propertyId: string) {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("property_cleaner_assignments")
    .select("*")
    .eq("property_id", propertyId)
    .eq("active", true)
    .order("priority", { ascending: true });

  const assignments = data ?? [];
  const primary = assignments.find((row) => row.role === "primary") ?? assignments[0] ?? null;
  const backup =
    assignments.find((row) => row.role === "backup") ??
    assignments.find((row) => row.cleaner_id !== primary?.cleaner_id) ??
    primary;

  return { primary, backup };
}

async function insertReadyOptions({
  cleaningRequestId,
  cleanerId,
  checkoutAt,
  deadlineAt,
  testScenarioId,
}: {
  cleaningRequestId: string;
  cleanerId: string;
  checkoutAt: string;
  deadlineAt: string;
  testScenarioId: string;
}) {
  const supabase = getSupabaseAdmin();

  const options = buildReadyDayOptions({
    checkoutAt,
    deadlineAt,
    maxDays: 3,
  });

  if (options.length === 0) return;

  await supabase.from("cleaning_request_ready_day_options").insert(
    options.map((option) => ({
      cleaning_request_id: cleaningRequestId,
      cleaner_id: cleanerId,
      ready_by_date: option.dateKey,
      ready_by_at: option.readyByAt,
      label: option.label,
      is_available: true,
      test_scenario_id: testScenarioId,
    })),
  );
}

async function fakeSms({
  testScenarioId,
  cleaningRequestId,
  cleanerId,
  body,
  phone,
}: {
  testScenarioId: string;
  cleaningRequestId?: string;
  cleanerId?: string;
  body: string;
  phone?: string | null;
}) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("outbound_messages").insert({
    channel: "sms",
    message_type: "test_lab",
    recipient_phone: phone || "+33000000000",
    body,
    status: "sent",
    provider: "test_lab",
    cleaning_request_id: cleaningRequestId ?? null,
    cleaner_id: cleanerId ?? null,
    is_test: true,
    test_scenario_id: testScenarioId,
    event_key: `test_lab:${testScenarioId}:${crypto.randomUUID()}`,
  });

  if (error) {
    throw new Error(`Impossible de créer le faux SMS : ${error.message}`);
  }
}

export async function createTestScenario(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const propertyId = textValue(formData, "property_id");
  const scenarioType = textValue(formData, "scenario_type");

  if (!propertyId || !scenarioType) {
    throw new Error("Bien ou scénario manquant.");
  }

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    throw new Error("Bien introuvable.");
  }

  const { primary, backup } = await loadAssignedCleaners(propertyId);

  if (!primary?.cleaner_id && !backup?.cleaner_id) {
    throw new Error("Aucune intervenante assignée à ce bien.");
  }

  const assignedCleanerId =
    scenarioType === "primary_unavailable_backup"
      ? backup?.cleaner_id
      : primary?.cleaner_id ?? backup?.cleaner_id;

  const assignmentReason =
    scenarioType === "primary_unavailable_backup"
      ? "simulation_primary_unavailable_backup_used"
      : "simulation_primary_available";

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("*")
    .eq("id", assignedCleanerId)
    .maybeSingle();

  if (!cleaner) {
    throw new Error("Intervenante introuvable.");
  }

  const scenarioName =
    scenarioType === "primary_unavailable_backup"
      ? "Simulation · primaire indisponible → backup"
      : scenarioType === "planning_change"
        ? "Simulation · nouvelle réservation pendant la fenêtre"
        : "Simulation · primaire disponible";

  const { data: scenario, error: scenarioError } = await supabase
    .from("test_scenarios")
    .insert({
      name: scenarioName,
      scenario_type: scenarioType,
      notes: `Bien: ${property.name ?? propertyId}`,
    })
    .select("*")
    .single();

  if (scenarioError || !scenario) {
    throw new Error(`Impossible de créer le scénario : ${scenarioError?.message}`);
  }

  const checkoutDateKey = tomorrowPlus(7);
  const checkinDateKey = addDaysToDateKey(checkoutDateKey, -3);

  const checkinAt = parisLocalDateTimeToUtcIso(checkinDateKey, 16, 0);
  const checkoutAt = parisLocalDateTimeToUtcIso(checkoutDateKey, 10, 0);
  const deadlineDateKey = addDaysToDateKey(checkoutDateKey, 3);
  const deadlineAt = parisLocalDateTimeToUtcIso(deadlineDateKey, 16, 0);

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .insert({
      property_id: propertyId,
      source_system: "simulation",
      source_booking_id: `SIM-${scenario.id}`,
      guest_name: "Client Test",
      checkin_at: checkinAt,
      checkout_at: checkoutAt,
      number_of_guests: 4,
      nights: 3,
      status: "confirmed",
      linen_required: true,
      laundry_required: true,
      test_scenario_id: scenario.id,
    })
    .select("*")
    .single();

  if (reservationError || !reservation) {
    throw new Error(`Impossible de créer la réservation test : ${reservationError?.message}`);
  }

  const { data: profile } = await supabase
    .from("property_cleaning_profiles")
    .select("*")
    .eq("property_id", propertyId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const missionToken = token();

  const { data: cleaningRequest, error: requestError } = await supabase
    .from("cleaning_requests")
    .insert({
      property_id: propertyId,
      reservation_id: reservation.id,
      cleaning_profile_id: profile?.id ?? null,
      assigned_cleaner_id: assignedCleanerId,
      scheduled_start_at: checkoutAt,
      scheduled_end_at: deadlineAt,
      status: "sent",
      urgent: false,
      response_deadline_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      number_of_guests: 4,
      linen_required: true,
      laundry_required: true,
      estimated_hours: Number(profile?.estimated_hours ?? 2),
      cleaning_cost_eur: Number(profile?.estimated_hours ?? 2) * Number(cleaner.hourly_rate_eur ?? 16),
      travel_cost_eur: 0,
      urgency_bonus_eur: 0,
      total_cost_eur: Number(profile?.estimated_hours ?? 2) * Number(cleaner.hourly_rate_eur ?? 16),
      public_token: missionToken,
      mission_origin: "turnover",
      service_type: profile?.service_type ?? "standard_cleaning",
      title: "Ménage après séjour · simulation",
      completion_deadline_at: deadlineAt,
      work_window_start_at: checkoutAt,
      work_window_end_at: deadlineAt,
      schedule_status: scenarioType === "planning_change" ? "planning_changed" : "waiting_for_ready_day",
      planning_changed_at: scenarioType === "planning_change" ? new Date().toISOString() : null,
      assignment_reason: assignmentReason,
      test_scenario_id: scenario.id,
    })
    .select("*")
    .single();

  if (requestError || !cleaningRequest) {
    throw new Error(`Impossible de créer la mission test : ${requestError?.message}`);
  }

  await insertReadyOptions({
    cleaningRequestId: cleaningRequest.id,
    cleanerId: assignedCleanerId,
    checkoutAt,
    deadlineAt,
    testScenarioId: scenario.id,
  });

  const baseUrl =
    process.env.CLEANER_WEB_BASE_URL ||
    process.env.PAYMENT_REQUEST_BASE_URL ||
    "https://missions.leclosdelavoilerie.com";

  await fakeSms({
    testScenarioId: scenario.id,
    cleaningRequestId: cleaningRequest.id,
    cleanerId: assignedCleanerId,
    phone: cleaner.phone,
    body: missionOfferCleanerMessage({
      propertyName: property.name ?? "Logement",
      missionUrl: `${baseUrl}/mission/${missionToken}/ready-day`,
      isTest: true,
    }),
  });

  if (scenarioType === "planning_change") {
    const newCheckinDateKey = addDaysToDateKey(checkoutDateKey, 1);

    await supabase.from("reservations").insert({
      property_id: propertyId,
      source_system: "simulation",
      source_booking_id: `SIM-${scenario.id}-NEW`,
      guest_name: "Nouvelle réservation Test",
      checkin_at: parisLocalDateTimeToUtcIso(newCheckinDateKey, 16, 0),
      checkout_at: parisLocalDateTimeToUtcIso(addDaysToDateKey(newCheckinDateKey, 2), 10, 0),
      number_of_guests: 2,
      nights: 2,
      status: "confirmed",
      linen_required: true,
      laundry_required: true,
      test_scenario_id: scenario.id,
    });

    await fakeSms({
      testScenarioId: scenario.id,
      cleaningRequestId: cleaningRequest.id,
      cleanerId: assignedCleanerId,
      phone: cleaner.phone,
      body: [
        `TEST · Planning modifié`,
        `Une nouvelle réservation affecte la mission ${property.name ?? "logement"}.`,
        `Organisation à vérifier manuellement.`,
      ].join("\n"),
    });
  }

  revalidatePath("/admin/test-lab");
}

export async function resetTestScenario(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();
  const scenarioId = textValue(formData, "scenario_id");

  if (!scenarioId) {
    throw new Error("Scénario manquant.");
  }

  await supabase.from("outbound_messages").delete().eq("test_scenario_id", scenarioId);
  await supabase.from("cleaning_request_ready_day_options").delete().eq("test_scenario_id", scenarioId);
  await supabase.from("cleaning_requests").delete().eq("test_scenario_id", scenarioId);
  await supabase.from("reservations").delete().eq("test_scenario_id", scenarioId);
  await supabase.from("test_scenarios").delete().eq("id", scenarioId);

  revalidatePath("/admin/test-lab");
}

export async function resetAllTestScenarios() {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  await supabase.from("outbound_messages").delete().eq("is_test", true);
  await supabase.from("cleaning_request_ready_day_options").delete().not("test_scenario_id", "is", null);
  await supabase.from("cleaning_requests").delete().not("test_scenario_id", "is", null);
  await supabase.from("reservations").delete().not("test_scenario_id", "is", null);
  await supabase.from("test_scenarios").delete().neq("status", "__never__");

  revalidatePath("/admin/test-lab");
}
