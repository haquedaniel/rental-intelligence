import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import AdminRequestIssuePage from "../../../../admin/issues/request/[requestId]/page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = Record<string, any>;

function phoneForSms(phone?: string | null): string {
  return String(phone ?? "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();
}

function fullName(row?: Row | null): string {
  return [row?.first_name, row?.last_name].filter(Boolean).join(" ");
}

function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)} €` : "montant à confirmer";
}

function scheduledText(request: Row): string {
  const raw = request.scheduled_start_at ?? request.scheduled_for ?? request.starts_at;

  if (!raw) return "date à confirmer";

  const date = new Date(raw);

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(":", "h");
}

function baseUrl(): string {
  return (
    process.env.CLEANER_WEB_BASE_URL ||
    process.env.NEXT_PUBLIC_CLEANER_WEB_BASE_URL ||
    "https://missions.leclosdelavoilerie.com"
  ).replace(/\/$/, "");
}

function buildMissionBody({
  request,
  reservation,
  property,
  cleaner,
}: {
  request: Row;
  reservation?: Row | null;
  property?: Row | null;
  cleaner?: Row | null;
}): string {
  const firstName = cleaner?.first_name || "Sandrine";
  const propertyName = property?.name || "Logement";
  const guestName = reservation?.guest_name || reservation?.guest_full_name || "";

  const guestLine = guestName ? `Client : ${guestName}\n` : "";
  const link = `${baseUrl()}/mission/${request.public_token}/ready-day`;

  return (
    `Bonjour ${firstName} 👋\n\n` +
    `Nouvelle mission ménage proposée.\n\n` +
    `🏠 ${propertyName}\n` +
    guestLine +
    `📅 ${scheduledText(request)}\n` +
    `💶 ${money(request.total_cost_eur)}\n\n` +
    `Répondre ici :\n${link}\n`
  );
}

async function sendMissionSms(formData: FormData) {
  "use server";

  await requireAdmin();

  const requestId = String(formData.get("request_id") ?? "").trim();

  if (!requestId) {
    throw new Error("Mission manquante.");
  }

  const supabase = getSupabaseAdmin();

  const { data: request, error: requestError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    throw new Error(`Mission introuvable : ${requestError?.message ?? ""}`);
  }

  if (!request.public_token) {
    throw new Error("Cette mission n’a pas de lien public.");
  }

  if (!request.assigned_cleaner_id) {
    throw new Error("Aucune intervenante n’est assignée à cette mission.");
  }

  const { data: cleaner, error: cleanerError } = await supabase
    .from("cleaners")
    .select("*")
    .eq("id", request.assigned_cleaner_id)
    .single();

  if (cleanerError || !cleaner) {
    throw new Error(`Intervenante introuvable : ${cleanerError?.message ?? ""}`);
  }

  const recipientPhone = phoneForSms(cleaner.phone);

  if (!recipientPhone) {
    throw new Error("L’intervenante n’a pas de numéro de téléphone.");
  }

  const { data: property } = request.property_id
    ? await supabase.from("properties").select("*").eq("id", request.property_id).maybeSingle()
    : { data: null };

  const { data: reservation } = request.reservation_id
    ? await supabase.from("reservations").select("*").eq("id", request.reservation_id).maybeSingle()
    : { data: null };

  const body = buildMissionBody({ request, reservation, property, cleaner });
  const eventKey = `manual_mission_offer:${request.id}:${Date.now()}`;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber =
    process.env.TWILIO_FROM_NUMBER ||
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_SMS_FROM;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    throw new Error(
      "Variables Twilio manquantes : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, puis TWILIO_FROM_NUMBER ou TWILIO_MESSAGING_SERVICE_SID.",
    );
  }

  const { data: auditRows, error: auditError } = await supabase
    .from("outbound_messages")
    .insert({
      cleaning_request_id: request.id,
      channel: "sms",
      message_type: "mission_offer",
      recipient_phone: recipientPhone,
      body,
      status: "pending",
      provider: "twilio",
      event_key: eventKey,
    })
    .select("id")
    .limit(1);

  if (auditError || !auditRows?.[0]?.id) {
    throw new Error(`Impossible de créer l’audit SMS : ${auditError?.message ?? ""}`);
  }

  const messageId = auditRows[0].id;

  const payload = new URLSearchParams();
  payload.set("To", recipientPhone);
  payload.set("Body", body);

  if (messagingServiceSid) {
    payload.set("MessagingServiceSid", messagingServiceSid);
  } else {
    payload.set("From", fromNumber as string);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
    },
  );

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      responseBody?.message ||
      responseBody?.error_message ||
      `Erreur Twilio ${response.status}`;

    await supabase
      .from("outbound_messages")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", messageId);

    throw new Error(`SMS non envoyé : ${message}`);
  }

  await supabase
    .from("outbound_messages")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", messageId);

  // Mark the offer as sent/proposed if it is still in the initial created state.
  if (["created", "proposed"].includes(request.status)) {
    await supabase
      .from("cleaning_requests")
      .update({ status: "sent" })
      .eq("id", request.id);
  }

  revalidatePath(`/owner/issues/request/${request.id}`);
  revalidatePath("/owner/cockpit");
}

export default async function OwnerRequestIssuePage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  await requireAdmin();

  const { requestId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: request } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  let cleaner: Row | null = null;

  if (request?.assigned_cleaner_id) {
    const result = await supabase
      .from("cleaners")
      .select("*")
      .eq("id", request.assigned_cleaner_id)
      .maybeSingle();

    cleaner = result.data ?? null;
  }

  const missionLink = request?.public_token
    ? `${baseUrl()}/mission/${request.public_token}/ready-day`
    : null;

  return (
    <>
      <section className="border-b border-slate-200 bg-white px-3 py-3 text-slate-950 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Test SMS manuel
            </p>
            <h2 className="text-base font-black">
              Envoyer cette mission à {fullName(cleaner) || "l’intervenante assignée"}
            </h2>
            {missionLink && (
              <Link
                href={missionLink}
                className="mt-1 block text-xs font-bold text-slate-500 underline"
              >
                Ouvrir le lien mission
              </Link>
            )}
          </div>

          <form action={sendMissionSms}>
            <input type="hidden" name="request_id" value={requestId} />
            <button
              disabled={!request?.assigned_cleaner_id || !missionLink}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Envoyer / renvoyer le SMS
            </button>
          </form>
        </div>
      </section>

      <AdminRequestIssuePage
        params={Promise.resolve({ requestId })}
      />
    </>
  );
}
