import Link from "next/link";
import { notFound } from "next/navigation";

import OwnerBottomNav, { OwnerTopNav } from "@/components/owner/OwnerBottomNav";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function textValue(row: Row | null | undefined, fields: string[], fallback = "—") {
  if (!row) return fallback;
  for (const field of fields) {
    const value = row[field];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return fallback;
}

function numberValue(row: Row | null | undefined, fields: string[]) {
  if (!row) return null;
  for (const field of fields) {
    const value = row[field];
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function euro(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(":", "h");
}

function shortDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function cleanerName(cleaner?: Row | null) {
  if (!cleaner) return "Non affectée";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || cleaner.name || "Intervenante";
}

function guestName(reservation?: Row | null) {
  if (!reservation) return "Réservation";
  return (
    [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ") ||
    reservation.guest_name ||
    reservation.source_booking_id ||
    "Réservation"
  );
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "created":
      return "Créée";
    case "sent":
      return "Proposée";
    case "accepted":
      return "Acceptée";
    case "completed":
      return "Terminée";
    case "report_submitted":
      return "Rapport envoyé";
    case "problem_reported":
      return "Problème signalé";
    case "refused":
      return "Refusée";
    case "cancelled":
      return "Annulée";
    default:
      return status || "—";
  }
}

function statusCopy(request: Row, report: Row | null) {
  if (report || ["completed", "report_submitted", "problem_reported"].includes(String(request.status))) {
    return {
      title: request.status === "problem_reported" || report?.problem_description ? "Rapport à vérifier" : "Mission terminée",
      subtitle: report ? "Un rapport est disponible pour cette mission." : "La mission est terminée, mais aucun rapport détaillé n’a été identifié.",
      tone: request.status === "problem_reported" || report?.problem_description ? "orange" : "green",
    };
  }

  if (request.status === "accepted") {
    return {
      title: "Mission sous contrôle",
      subtitle: "L’intervenante a accepté la mission. Le point important est maintenant l’heure à laquelle le logement sera prêt.",
      tone: "blue",
    };
  }

  if (["created", "sent"].includes(String(request.status))) {
    return {
      title: "Acceptation à confirmer",
      subtitle: "La mission existe, mais elle n’est pas encore clairement acceptée.",
      tone: "amber",
    };
  }

  if (request.status === "refused") {
    return {
      title: "Mission refusée",
      subtitle: "Une action est nécessaire pour trouver une solution de remplacement.",
      tone: "red",
    };
  }

  return {
    title: "Mission à suivre",
    subtitle: "Statut opérationnel à vérifier.",
    tone: "blue",
  };
}

function heroClass(tone: string) {
  switch (tone) {
    case "green":
      return "bg-emerald-950 ring-emerald-900";
    case "amber":
      return "bg-[#6B3E05] ring-[#F4B044]/30";
    case "orange":
      return "bg-[#7A2E09] ring-[#E0680E]/25";
    case "red":
      return "bg-red-950 ring-red-900";
    default:
      return "bg-[#112532] ring-[#112532]/20";
  }
}

function badgeClass(status?: string | null) {
  switch (status) {
    case "accepted":
    case "completed":
    case "report_submitted":
      return "bg-emerald-50 text-emerald-900 ring-emerald-100";
    case "problem_reported":
      return "bg-orange-50 text-orange-900 ring-orange-100";
    case "created":
    case "sent":
      return "bg-[#FFF5DD] text-[#A45C00] ring-[#F4B044]/25";
    case "refused":
    case "cancelled":
      return "bg-red-50 text-red-900 ring-red-100";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#112532]/35">{label}</p>
      <p className="mt-2 text-xl font-black text-[#112532]">{value}</p>
      {detail ? <p className="mt-1 text-sm font-bold text-[#112532]/50">{detail}</p> : null}
    </div>
  );
}

function MessageBubble({ title, text, tone = "blue" }: { title: string; text: string; tone?: "blue" | "amber" | "green" | "red" }) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-100"
      : tone === "amber"
        ? "bg-[#FFF5DD] text-[#8A4D00] ring-[#F4B044]/25"
        : tone === "red"
          ? "bg-red-50 text-red-900 ring-red-100"
          : "bg-[#EFF6F8] text-[#1E5365] ring-[#80A5B7]/25";

  return (
    <div className={`rounded-3xl p-5 ring-1 ${cls}`}>
      <p className="text-sm font-black">{title}</p>
      <p className="mt-2 text-sm font-bold opacity-75">{text}</p>
    </div>
  );
}

async function signedStorageUrl(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bucket?: string | null,
  path?: string | null,
) {
  if (!bucket || !path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

async function signedPhotos(supabase: ReturnType<typeof getSupabaseAdmin>, rows: Row[]) {
  const out = [];
  for (const row of rows) {
    const url = await signedStorageUrl(
      supabase,
      row.storage_bucket || row.photo_bucket || row.bucket,
      row.storage_path || row.photo_path || row.path,
    );
    out.push({ ...row, signedUrl: url });
  }
  return out;
}

export default async function OwnerMissionPage({
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

  if (!request) notFound();

  const [
    propertyResult,
    reservationResult,
    cleanerResult,
    reportResult,
    interventionReportResult,
    outboundResult,
  ] = await Promise.all([
    request.property_id
      ? supabase.from("properties").select("*").eq("id", request.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
    request.reservation_id
      ? supabase.from("reservations").select("*").eq("id", request.reservation_id).maybeSingle()
      : Promise.resolve({ data: null }),
    request.assigned_cleaner_id
      ? supabase.from("cleaners").select("*").eq("id", request.assigned_cleaner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("cleaning_reports").select("*").eq("cleaning_request_id", request.id).maybeSingle(),
    supabase.from("intervention_reports").select("*").eq("cleaning_request_id", request.id).maybeSingle(),
    supabase.from("outbound_messages").select("*").eq("cleaning_request_id", request.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const property = propertyResult.data as Row | null;
  const reservation = reservationResult.data as Row | null;
  const cleaner = cleanerResult.data as Row | null;
  const report = reportResult.data as Row | null;
  const interventionReport = interventionReportResult.data as Row | null;
  const outboundMessages = (outboundResult.data ?? []) as Row[];

  const [{ data: coverPhoto }, cleaningPhotoResult, interventionPhotoResult] = await Promise.all([
    request.property_id
      ? supabase
          .from("property_reference_photos")
          .select("*")
          .eq("property_id", request.property_id)
          .eq("is_active", true)
          .order("is_cover", { ascending: false })
          .order("display_order", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("cleaning_report_photos")
      .select("*")
      .eq("cleaning_request_id", request.id)
      .order("uploaded_at", { ascending: true }),
    supabase
      .from("intervention_report_photos")
      .select("*")
      .eq("cleaning_request_id", request.id)
      .order("uploaded_at", { ascending: true }),
  ]);

  const coverUrl = await signedStorageUrl(supabase, coverPhoto?.storage_bucket, coverPhoto?.storage_path);
  const cleaningPhotos = await signedPhotos(supabase, (cleaningPhotoResult.data ?? []) as Row[]);
  const interventionPhotos = await signedPhotos(supabase, (interventionPhotoResult.data ?? []) as Row[]);
  const photos = [...cleaningPhotos, ...interventionPhotos];

  const copy = statusCopy(request as Row, report as Row | null);
  const cost = numberValue(request as Row, ["total_cost_eur", "cleaning_cost_eur", "amount_eur"]);
  const isIntervention = request.mission_type === "intervention";

  const reportHref = `/owner/reports/${request.id}`;
  const reservationHref = reservation ? `/owner/reservations/${reservation.id}` : null;

  return (
    <main className="min-h-screen bg-[#F6F3EF] pb-2 text-[#112532]">
      <section className={`relative overflow-hidden text-white ring-1 ${heroClass(copy.tone)}`}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-42" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#112532] via-[#112532]/75 to-[#112532]/30" />

        <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-5 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white/8 p-2 backdrop-blur-md ring-1 ring-white/12">
            <OwnerTopNav active="missions" />
          </div>

          <div className="mt-12 max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-white/55">
              {isIntervention ? "Intervention propriétaire" : "Mission de ménage"}
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base font-bold text-white/75">
              {copy.subtitle}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className={`rounded-full px-4 py-2 text-xs font-black ring-1 ${badgeClass(request.status)}`}>
                {statusLabel(request.status)}
              </span>
              <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black text-white ring-1 ring-white/20">
                {property?.name ?? "Logement"}
              </span>
              <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black text-white ring-1 ring-white/20">
                {cleanerName(cleaner)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Fenêtre prévue" value={dateTime(request.work_window_start_at || request.scheduled_start_at)} detail={`→ ${dateTime(request.work_window_end_at || request.scheduled_end_at)}`} />
          <InfoCard label="Prêt avant" value={dateTime(request.ready_by_at || request.completion_deadline_at || request.work_window_end_at)} />
          <InfoCard label="Coût prévu" value={euro(cost)} detail={cleanerName(cleaner)} />
          <InfoCard label="Rapport" value={report || interventionReport ? "Disponible" : "Non reçu"} detail={photos.length ? `${photos.length} photo(s)` : undefined} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Contexte</p>
            <h2 className="mt-2 text-2xl font-black">Séjour et logement</h2>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#112532]/35">Logement</p>
                <p className="mt-2 text-lg font-black">{property?.name ?? "Logement"}</p>
                {property?.id ? (
                  <Link href={`/owner/properties/${property.id}`} className="mt-2 inline-flex text-sm font-black text-[#E0680E]">
                    Ouvrir le logement →
                  </Link>
                ) : null}
              </div>

              <div className="rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#112532]/35">Réservation liée</p>
                {reservation ? (
                  <>
                    <p className="mt-2 text-lg font-black">{guestName(reservation)}</p>
                    <p className="mt-1 text-sm font-bold text-[#112532]/55">
                      {dateTime(reservation.checkin_at)} → {dateTime(reservation.checkout_at)}
                    </p>
                    <Link href={reservationHref!} className="mt-2 inline-flex text-sm font-black text-[#E0680E]">
                      Ouvrir le séjour →
                    </Link>
                  </>
                ) : (
                  <p className="mt-2 text-sm font-bold text-[#112532]/45">Aucune réservation liée.</p>
                )}
              </div>

              <div className="rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#112532]/35">Intervenante</p>
                <p className="mt-2 text-lg font-black">{cleanerName(cleaner)}</p>
                <p className="mt-1 text-sm font-bold text-[#112532]/55">
                  {textValue(cleaner, ["phone", "mobile", "email"], "Coordonnées à compléter")}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Pilotage</p>
            <h2 className="mt-2 text-2xl font-black">Ce qu’il faut savoir</h2>

            <div className="mt-5 grid gap-3">
              {request.status === "accepted" ? (
                <MessageBubble title="Sous contrôle" text="La mission est acceptée. Le point clé est de suivre la réalisation et le rapport." tone="green" />
              ) : ["created", "sent"].includes(String(request.status)) ? (
                <MessageBubble title="À surveiller" text="La mission n’est pas encore acceptée. Si l’échéance approche, il faudra relancer ou proposer une alternative." tone="amber" />
              ) : request.status === "refused" ? (
                <MessageBubble title="Action nécessaire" text="La mission a été refusée. Il faut affecter une autre intervenante ou reprendre manuellement." tone="red" />
              ) : (
                <MessageBubble title="Statut à vérifier" text="Le statut est chargé depuis Supabase. Cette carte deviendra le résumé intelligent propriétaire." tone="blue" />
              )}

              {report || interventionReport ? (
                <Link href={reportHref} className="rounded-3xl bg-emerald-50 p-5 font-black text-emerald-900 ring-1 ring-emerald-100">
                  Rapport disponible · ouvrir →
                </Link>
              ) : (
                <div className="rounded-3xl bg-[#F4F8FA] p-5 ring-1 ring-[#112532]/6">
                  <p className="font-black">Rapport non reçu</p>
                  <p className="mt-2 text-sm font-bold text-[#112532]/55">
                    Dès que l’intervenante envoie son rapport, cette page devient la preuve de réalisation.
                  </p>
                </div>
              )}

              {textValue(request, ["notes", "description", "owner_notes"], "") ? (
                <MessageBubble title="Notes mission" text={textValue(request, ["notes", "description", "owner_notes"], "")} tone="blue" />
              ) : null}
            </div>
          </article>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Rapport et photos</p>
              <h2 className="mt-2 text-2xl font-black">Preuves de réalisation</h2>
            </div>
            {report || interventionReport ? (
              <Link href={reportHref} className="rounded-full bg-[#112532] px-5 py-3 text-sm font-black text-white">
                Ouvrir le rapport complet →
              </Link>
            ) : null}
          </div>

          {photos.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {photos.slice(0, 12).map((photo, index) => (
                <div key={photo.id || index} className="overflow-hidden rounded-3xl bg-[#F4F8FA] ring-1 ring-[#112532]/8">
                  {photo.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.signedUrl} alt="" className="h-48 w-full object-cover" />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-sm font-bold text-[#112532]/40">
                      Photo non disponible
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl bg-[#F4F8FA] p-6 text-sm font-bold text-[#112532]/50 ring-1 ring-[#112532]/6">
              Aucune photo reçue pour l’instant.
            </div>
          )}
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Historique messages</p>
          <h2 className="mt-2 text-2xl font-black">Notifications envoyées</h2>

          <div className="mt-5 space-y-3">
            {outboundMessages.length ? (
              outboundMessages.map((message) => (
                <div key={message.id} className="rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black">{message.channel || message.message_type || "Message"}</p>
                    <p className="text-xs font-bold text-[#112532]/45">{dateTime(message.created_at || message.sent_at)}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-[#112532]/65">
                    {message.body || message.message || message.content || "Message enregistré."}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-[#F4F8FA] p-4 text-sm font-bold text-[#112532]/50 ring-1 ring-[#112532]/6">
                Aucun message sortant lié à cette mission.
              </div>
            )}
          </div>
        </section>
      </div>

      <OwnerBottomNav active="missions" />
    </main>
  );
}
