"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PARIS_TZ = "Europe/Paris";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0, 12, 0, 0));

  return {
    startKey: `${year}-${String(month).padStart(2, "0")}-01`,
    endKey: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
  };
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

function serviceLabel(serviceType?: string | null): string {
  switch (serviceType) {
    case "garden_lawn":
      return "Jardin / tonte";
    case "deep_cleaning":
      return "Grand ménage";
    case "linen_laundry":
      return "Linge / lessive";
    case "inventory_check":
      return "Contrôle inventaire";
    case "maintenance_check":
      return "Petite maintenance";
    case "other":
      return "Mission ponctuelle";
    default:
      return "Ménage";
  }
}

async function loadCompletedMissions(cleanerId: string, ownerId: string, startKey: string, endKey: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cleaning_requests")
    .select(`
      *,
      properties:property_id(id,name,owner_id),
      cleaning_reports(id, submitted_at)
    `)
    .eq("assigned_cleaner_id", cleanerId)
    .in("status", ["report_submitted", "completed", "problem_reported"])
    .gte("scheduled_start_at", `${startKey}T00:00:00.000Z`)
    .lte("scheduled_start_at", `${endKey}T23:59:59.999Z`)
    .order("scheduled_start_at", { ascending: true });

  if (error) {
    throw new Error(`Impossible de charger les missions : ${error.message}`);
  }

  return (data ?? []).filter((mission: any) => mission.properties?.owner_id === ownerId);
}

async function loadExtras(cleanerId: string, ownerId: string, startKey: string, endKey: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cleaning_request_extras")
    .select(`
      *,
      properties:property_id(id,name,owner_id),
      cleaning_requests:cleaning_request_id(scheduled_start_at,title,service_type)
    `)
    .eq("cleaner_id", cleanerId)
    .in("status", ["pending_owner_review", "approved"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Impossible de charger les suppléments : ${error.message}`);
  }

  return (data ?? []).filter((extra: any) => {
    const workDate = extra.cleaning_requests?.scheduled_start_at ?? extra.created_at;
    const workKey = parisDateKey(workDate);
    return extra.properties?.owner_id === ownerId && workKey >= startKey && workKey <= endKey;
  });
}

export async function sendMonthlyPaymentRequest(formData: FormData) {
  const supabase = getSupabaseAdmin();

  const cleanerToken = textValue(formData, "cleaner_token");
  const ownerId = textValue(formData, "owner_id");
  const period = textValue(formData, "period");
  const cleanerMessage = textValue(formData, "cleaner_message");

  if (!cleanerToken || !ownerId || !period) {
    throw new Error("Intervenante, propriétaire ou période manquante.");
  }

  const { data: cleaner, error: cleanerError } = await supabase
    .from("cleaners")
    .select("*")
    .eq("public_token", cleanerToken)
    .maybeSingle();

  if (cleanerError || !cleaner) {
    throw new Error("Intervenante introuvable.");
  }

  const { data: owner, error: ownerError } = await supabase
    .from("owners")
    .select("*")
    .eq("id", ownerId)
    .maybeSingle();

  if (ownerError || !owner) {
    throw new Error("Propriétaire introuvable.");
  }

  const { startKey, endKey } = monthBounds(period);

  const missions = await loadCompletedMissions(cleaner.id, ownerId, startKey, endKey);
  const extras = await loadExtras(cleaner.id, ownerId, startKey, endKey);

  if (missions.length === 0 && extras.length === 0) {
    throw new Error("Aucune mission terminée à demander pour ce propriétaire sur cette période.");
  }

  const existing = await supabase
    .from("monthly_payment_requests")
    .select("*")
    .eq("cleaner_id", cleaner.id)
    .eq("owner_id", ownerId)
    .eq("period_start", startKey)
    .eq("period_end", endKey)
    .maybeSingle();

  if (existing.data && existing.data.status !== "draft") {
    throw new Error("Cette demande a déjà été envoyée.");
  }

  const totalBase = missions.reduce(
    (sum: number, mission: any) => sum + Number(mission.total_cost_eur ?? 0),
    0,
  );

  const totalExtras = extras.reduce(
    (sum: number, extra: any) => sum + Number(extra.amount_eur ?? 0),
    0,
  );

  const dueDays = Number(owner.payment_due_days ?? 5);
  const baseUrl =
    process.env.PAYMENT_REQUEST_BASE_URL ||
    process.env.CLEANER_WEB_BASE_URL ||
    "https://missions.leclosdelavoilerie.com";

  const requestPayload = {
    cleaner_id: cleaner.id,
    owner_id: ownerId,
    period_start: startKey,
    period_end: endKey,
    status: "sent_to_owner",
    total_base_eur: money(totalBase),
    total_extras_eur: money(totalExtras),
    total_eur: money(totalBase + totalExtras),
    cleaner_message: cleanerMessage || null,
    owner_recipient_name: owner.display_name || owner.legal_name || "Propriétaire",
    owner_recipient_phone: owner.phone || null,
    owner_recipient_email: owner.billing_email || null,
    payment_method_snapshot: cleaner.payment_method ?? null,
    payment_details_snapshot: cleaner.payment_details ?? null,
    iban_snapshot: cleaner.iban ?? null,
    invoice_status:
      String(cleaner.worker_type ?? "").includes("auto") ? "draft_needed" : "not_required",
    sent_at: new Date().toISOString(),
    due_at: new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  let paymentRequestId = existing.data?.id;

  if (paymentRequestId) {
    const { error } = await supabase
      .from("monthly_payment_requests")
      .update(requestPayload)
      .eq("id", paymentRequestId);

    if (error) {
      throw new Error(`Impossible d’envoyer la demande : ${error.message}`);
    }

    await supabase
      .from("monthly_payment_request_lines")
      .delete()
      .eq("monthly_payment_request_id", paymentRequestId);
  } else {
    const { data: inserted, error } = await supabase
      .from("monthly_payment_requests")
      .insert(requestPayload)
      .select("*")
      .single();

    if (error || !inserted) {
      throw new Error(`Impossible de créer la demande : ${error?.message}`);
    }

    paymentRequestId = inserted.id;
  }

  const lines = [
    ...missions.map((mission: any) => ({
      monthly_payment_request_id: paymentRequestId,
      cleaning_request_id: mission.id,
      cleaning_report_id: mission.cleaning_reports?.[0]?.id ?? null,
      line_type: "mission",
      work_date: parisDateKey(mission.scheduled_start_at),
      property_id: mission.property_id,
      property_name: mission.properties?.name ?? null,
      service_type: mission.service_type ?? "standard_cleaning",
      description: mission.title || serviceLabel(mission.service_type),
      hours: Number(mission.estimated_hours ?? 0),
      amount_eur: money(Number(mission.total_cost_eur ?? 0)),
      status: "included",
    })),
    ...extras.map((extra: any) => ({
      monthly_payment_request_id: paymentRequestId,
      cleaning_request_id: extra.cleaning_request_id,
      cleaning_report_id: extra.cleaning_report_id,
      extra_id: extra.id,
      line_type: "extra",
      work_date: extra.cleaning_requests?.scheduled_start_at
        ? parisDateKey(extra.cleaning_requests.scheduled_start_at)
        : parisDateKey(extra.created_at),
      property_id: extra.property_id,
      property_name: extra.properties?.name ?? null,
      service_type: extra.cleaning_requests?.service_type ?? "other",
      description: `Supplément exceptionnel · ${extra.reason}`,
      hours: 0,
      amount_eur: money(Number(extra.amount_eur ?? 0)),
      status: extra.status === "approved" ? "included" : "pending_owner_review",
    })),
  ];

  const { error: lineError } = await supabase
    .from("monthly_payment_request_lines")
    .insert(lines);

  if (lineError) {
    throw new Error(`Impossible de créer les lignes : ${lineError.message}`);
  }

  const { data: refreshedRequest } = await supabase
    .from("monthly_payment_requests")
    .select("*")
    .eq("id", paymentRequestId)
    .single();

  const wantsSms = String(owner.payment_request_channel ?? "sms").includes("sms");

  if (wantsSms && owner.phone && refreshedRequest) {
    const ownerLink = `${baseUrl}/owner/payments/${refreshedRequest.public_token}`;
    const cleanerName = [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || "Une intervenante";

    const body = [
      `Demande de paiement reçue`,
      `${cleanerName} vous a envoyé sa demande pour ${period}.`,
      `Montant: ${money(totalBase + totalExtras).toFixed(2)} €`,
      `À régler sous ${dueDays} jours: ${ownerLink}`,
    ].join("\n");

    await supabase.from("outbound_messages").insert({
      channel: "sms",
      message_type: "monthly_payment_request_owner",
      recipient_phone: owner.phone,
      body,
      status: "pending",
      provider: "twilio",
      owner_id: ownerId,
      monthly_payment_request_id: paymentRequestId,
      event_key: `payment_request_owner:${paymentRequestId}`,
    });
  }

  revalidatePath(`/cleaner/${cleanerToken}/payments`);
  revalidatePath("/admin/payments");
}
