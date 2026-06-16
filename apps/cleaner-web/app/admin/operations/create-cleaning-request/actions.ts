"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PARIS_TZ = "Europe/Paris";

const SERVICE_LABELS: Record<string, string> = {
  standard_cleaning: "Ménage standard",
  deep_cleaning: "Grand ménage",
  linen_laundry: "Linge / lessive",
  inventory_check: "Contrôle inventaire",
  garden_lawn: "Jardin / tonte",
  maintenance_check: "Petite maintenance",
  other: "Mission ponctuelle",
};

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value || null;
}

function boolValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function parisDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;

  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function parisLocalToUtc(dateKey: string, timeText: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeText.split(":").map(Number);

  const firstGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(firstGuess);

  const actualYear = Number(parts.find((part) => part.type === "year")?.value);
  const actualMonth = Number(parts.find((part) => part.type === "month")?.value);
  const actualDay = Number(parts.find((part) => part.type === "day")?.value);
  const actualHour = Number(parts.find((part) => part.type === "hour")?.value);
  const actualMinute = Number(parts.find((part) => part.type === "minute")?.value);

  const desiredUtcMinutes = Date.UTC(year, month - 1, day, hour, minute, 0) / 60000;
  const actualUtcMinutes =
    Date.UTC(actualYear, actualMonth - 1, actualDay, actualHour, actualMinute, 0) /
    60000;

  return new Date(firstGuess.getTime() + (desiredUtcMinutes - actualUtcMinutes) * 60000);
}

async function findNextCheckin(propertyId: string, afterIso: string, excludeReservationId?: string) {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("reservations")
    .select("checkin_at")
    .eq("property_id", propertyId)
    .eq("status", "confirmed")
    .gte("checkin_at", afterIso)
    .order("checkin_at", { ascending: true })
    .limit(1);

  if (excludeReservationId) {
    query = query.neq("id", excludeReservationId);
  }

  const { data } = await query.maybeSingle();

  return data?.checkin_at ?? null;
}

export async function createOrUpdateCleaningRequest(formData: FormData) {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const reservationId = textValue(formData, "reservation_id");
  const propertyIdFromForm = textValue(formData, "property_id");
  const cleanerId = textValue(formData, "cleaner_id");
  const profileId = textValue(formData, "profile_id");

  const scheduledDate = textValue(formData, "scheduled_date");
  const scheduledTime = textValue(formData, "scheduled_time") || "14:00";
  const deadlineDate = textValue(formData, "deadline_date") || scheduledDate;
  const deadlineTime = textValue(formData, "deadline_time") || "18:00";

  const serviceType = textValue(formData, "service_type") || "standard_cleaning";
  const explicitTitle = nullableText(formData, "title");
  const adminNotes = nullableText(formData, "admin_notes");

  if (!cleanerId || !profileId || !scheduledDate) {
    throw new Error("Intervenante, profil ménage ou date manquante.");
  }

  let reservation: Record<string, any> | null = null;
  let propertyId = propertyIdFromForm;
  let missionOrigin = "manual";

  if (reservationId) {
    const { data: reservationData, error: reservationError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .maybeSingle();

    if (reservationError || !reservationData) {
      throw new Error("Réservation introuvable.");
    }

    reservation = reservationData;
    propertyId = reservationData.property_id;
    missionOrigin = "turnover";
  }

  if (!propertyId) {
    throw new Error("Logement manquant.");
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError || !property) {
    throw new Error("Logement introuvable.");
  }

  const { data: cleaner, error: cleanerError } = await supabase
    .from("cleaners")
    .select("*")
    .eq("id", cleanerId)
    .maybeSingle();

  if (cleanerError || !cleaner) {
    throw new Error("Intervenante introuvable.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("property_cleaning_profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("Profil ménage introuvable.");
  }

  let existingRequest: Record<string, any> | null = null;

  if (reservation) {
    const { data: existingRequests, error: existingRequestError } = await supabase
      .from("cleaning_requests")
      .select("*")
      .eq("reservation_id", reservation.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingRequestError) {
      throw new Error(
        `Impossible de vérifier les missions existantes : ${existingRequestError.message}`,
      );
    }

    existingRequest = (existingRequests ?? [])[0] ?? null;

    if (
      existingRequest &&
      !["cancelled", "refused"].includes(existingRequest.status)
    ) {
      throw new Error(
        "Une mission active existe déjà pour cette réservation. Elle ne sera pas recréée.",
      );
    }
  }

  const { data: assignment } = await supabase
    .from("property_cleaner_assignments")
    .select("*")
    .eq("property_id", propertyId)
    .eq("cleaner_id", cleanerId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const scheduledStartAt = parisLocalToUtc(scheduledDate, scheduledTime);
  const completionDeadlineAt = parisLocalToUtc(deadlineDate, deadlineTime);

  const estimatedHours = numberValue(
    textValue(formData, "estimated_hours"),
    numberValue(profile.estimated_hours, 0),
  );

  const scheduledEndAt = new Date(
    scheduledStartAt.getTime() + estimatedHours * 60 * 60 * 1000,
  );

  let nextCheckinAt: string | null = null;

  if (reservation) {
    nextCheckinAt = await findNextCheckin(
      reservation.property_id,
      reservation.checkout_at,
      reservation.id,
    );

    if (nextCheckinAt) {
      await supabase
        .from("reservations")
        .update({ next_checkin_at: nextCheckinAt })
        .eq("id", reservation.id);
    }
  }

  const checkoutAt = reservation?.checkout_at ? new Date(reservation.checkout_at) : null;

  const urgent =
    reservation && nextCheckinAt && checkoutAt
      ? new Date(nextCheckinAt).getTime() - checkoutAt.getTime() <=
        36 * 60 * 60 * 1000
      : completionDeadlineAt.getTime() - scheduledStartAt.getTime() <=
        12 * 60 * 60 * 1000;

  const distanceKm =
    assignment?.travel_distance_km !== null &&
    assignment?.travel_distance_km !== undefined
      ? numberValue(assignment.travel_distance_km, 0)
      : numberValue(process.env.DEFAULT_CLEANER_DISTANCE_KM, 0);

  const includedRadiusKm = numberValue(cleaner.included_radius_km, 0);
  const billableTravelKm = Math.max(0, distanceKm - includedRadiusKm);

  const hourlyRate = numberValue(cleaner.hourly_rate_eur, 0);
  const travelRate = numberValue(cleaner.travel_rate_per_km_eur, 0);
  const urgencyBonusPercent = urgent
    ? numberValue(cleaner.urgency_bonus_percent, 15)
    : 0;

  const cleaningCost = estimatedHours * hourlyRate;
  const travelCost = billableTravelKm * travelRate;
  const subtotal = cleaningCost + travelCost;
  const urgencyBonus = subtotal * (urgencyBonusPercent / 100);
  const total = subtotal + urgencyBonus;

  const now = new Date();
  const title =
    explicitTitle ??
    (missionOrigin === "turnover"
      ? "Ménage après séjour"
      : SERVICE_LABELS[serviceType] ?? "Mission ponctuelle");

  const payload = {
    property_id: property.id,
    reservation_id: reservation?.id ?? null,
    cleaning_profile_id: profile.id,
    assigned_cleaner_id: cleaner.id,
    mission_origin: missionOrigin,
    service_type: serviceType,
    title,
    admin_notes: adminNotes,
    scheduled_start_at: scheduledStartAt.toISOString(),
    scheduled_end_at: scheduledEndAt.toISOString(),
    completion_deadline_at: completionDeadlineAt.toISOString(),
    status: "created",
    urgent,
    response_deadline_at: new Date(
      now.getTime() + (urgent ? 3 : 12) * 60 * 60 * 1000,
    ).toISOString(),
    number_of_guests: reservation?.number_of_guests ?? 0,
    linen_required: boolValue(formData, "linen_required"),
    laundry_required: boolValue(formData, "laundry_required"),
    estimated_hours: estimatedHours,
    cleaning_cost_eur: money(cleaningCost),
    travel_distance_km: money(distanceKm),
    billable_travel_km: money(billableTravelKm),
    travel_cost_eur: money(travelCost),
    urgency_bonus_percent: money(urgencyBonusPercent),
    urgency_bonus_eur: money(urgencyBonus),
    total_cost_eur: money(total),
    public_token: randomUUID().replaceAll("-", ""),
    public_token_expires_at: new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    accepted_at: null,
    refused_at: null,
    refusal_reason: null,
    updated_at: now.toISOString(),
  };

  if (existingRequest) {
    const { error } = await supabase
      .from("cleaning_requests")
      .update(payload)
      .eq("id", existingRequest.id);

    if (error) {
      throw new Error(`Impossible de recréer la mission : ${error.message}`);
    }
  } else {
    const { error } = await supabase.from("cleaning_requests").insert(payload);

    if (error) {
      throw new Error(`Impossible de créer la mission : ${error.message}`);
    }
  }

  revalidatePath("/admin/operations");
  redirect(`/admin/operations?start=${scheduledDate}&property=${property.id}`);
}
