import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function textValue(row: Row | null | undefined, fields: string[], fallback = "—"): string {
  if (!row) return fallback;
  for (const field of fields) {
    const value = row[field];
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value);
  }
  return fallback;
}

function numberValue(row: Row | null | undefined, fields: string[]): number | null {
  if (!row) return null;
  for (const field of fields) {
    const value = row[field];
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function dateTime(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value)).replace(":", "h");
}

function guestName(reservation: Row | null | undefined): string {
  if (!reservation) return "Voyageur";
  return [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ").trim()
    || reservation.guest_name
    || "Voyageur";
}

function sanitizeNote(value?: string | null): string {
  if (!value) return "";
  return String(value)
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/\b\d{4,8}\b/g, "••••")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/\+?\d[\d .-]{7,}\d/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(value?: string | null): string {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sanitizeCorrespondence(value?: string | null): string {
  return sanitizeNote(stripHtml(value))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function correspondenceSourceLabel(message: Row): string {
  if (message.direction === "guest_to_host") return "Voyageur";
  if (message.direction === "host_to_guest") return "Réponse hôte";
  if (message.direction === "system") return "Système";
  return "Message";
}

function messageLooksOperational(text: string): boolean {
  const raw = text.toLowerCase();
  const keywords = [
    "lit bébé", "bébé", "cot", "crib", "chaise haute", "high chair",
    "canapé", "sofa", "drap", "linge", "serviette", "towel", "sheet",
    "chien", "dog", "chat", "cat", "animal", "pet",
    "allerg", "vélo", "bike", "bicycle", "local", "terrasse", "jardin",
    "départ", "arrivée", "late", "early", "tard", "avance",
    "clé", "clef", "key", "boîte", "box", "code",
    "cassé", "broken", "sale", "dirty", "propre", "clean",
    "ventilateur", "fan", "chauffage", "heating", "wifi"
  ];

  return keywords.some((keyword) => raw.includes(keyword));
}

function guestLanguageLabel(value?: string | null): string {
  const lang = String(value || "").toLowerCase();
  if (lang.startsWith("fr")) return "Français";
  if (lang.startsWith("en")) return "Anglais";
  if (lang.startsWith("de")) return "Allemand";
  if (lang.startsWith("es")) return "Espagnol";
  if (lang.startsWith("nl")) return "Néerlandais";
  return value || "Non renseignée";
}

function missionTypeLabel(request: Row): string {
  if (request.mission_type === "intervention") return "Intervention";
  if (request.service_type === "light_cleaning") return "Ménage léger";
  if (request.service_type === "deep_cleaning") return "Ménage renforcé";
  return "Ménage";
}

function InfoCard({ label, value, detail, warn = false }: { label: string; value: string; detail?: string; warn?: boolean }) {
  return (
    <div className={`rounded-3xl p-5 ring-1 ${warn ? "bg-[#FFF5DD] text-[#8A4D00] ring-[#F4B044]/25" : "bg-white text-[#112532] ring-[#112532]/8"}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-45">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
      {detail ? <p className="mt-1 text-sm font-bold opacity-65">{detail}</p> : null}
    </div>
  );
}

function StayCard({ label, reservation }: { label: string; reservation: Row | null }) {
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-[#112532]/8">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#112532]/35">{label}</p>
      {reservation ? (
        <>
          <p className="mt-2 text-lg font-black text-[#112532]">{guestName(reservation)}</p>
          <p className="mt-1 text-sm font-bold text-[#112532]/55">
            {dateTime(reservation.checkin_at)} → {dateTime(reservation.checkout_at)}
          </p>
          <p className="mt-2 text-sm font-bold text-[#112532]/55">
            {numberValue(reservation, ["number_of_guests", "guest_count", "guests"]) ?? "—"} voyageur(s)
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm font-bold text-[#112532]/45">Aucun séjour identifié.</p>
      )}
    </div>
  );
}

async function signedStorageUrl(supabase: ReturnType<typeof getSupabaseAdmin>, bucket?: string | null, path?: string | null) {
  if (!bucket || !path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

async function propertyCoverUrl(supabase: ReturnType<typeof getSupabaseAdmin>, propertyId?: string | null) {
  if (!propertyId) return null;
  const { data: photo } = await supabase
    .from("property_reference_photos")
    .select("*")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("is_cover", { ascending: false })
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return signedStorageUrl(supabase, photo?.storage_bucket, photo?.storage_path);
}

async function previousAndNextReservations(supabase: ReturnType<typeof getSupabaseAdmin>, reservation: Row | null, propertyId?: string | null) {
  if (!reservation || !propertyId) return { previousReservation: null, nextReservation: null };

  const [previousResult, nextResult] = await Promise.all([
    reservation.checkin_at
      ? supabase
          .from("reservations")
          .select("*")
          .eq("property_id", propertyId)
          .neq("id", reservation.id)
          .not("status", "in", "(cancelled,canceled)")
          .lte("checkout_at", reservation.checkin_at)
          .order("checkout_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    reservation.checkout_at
      ? supabase
          .from("reservations")
          .select("*")
          .eq("property_id", propertyId)
          .neq("id", reservation.id)
          .not("status", "in", "(cancelled,canceled)")
          .gte("checkin_at", reservation.checkout_at)
          .order("checkin_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    previousReservation: previousResult.data as Row | null,
    nextReservation: nextResult.data as Row | null,
  };
}

export default async function CleanerReservationBriefingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: request } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!request) notFound();

  const [propertyResult, reservationResult, messagesResult] = await Promise.all([
    request.property_id ? supabase.from("properties").select("*").eq("id", request.property_id).maybeSingle() : Promise.resolve({ data: null }),
    (request.prepares_reservation_id || request.reservation_id) ? supabase.from("reservations").select("*").eq("id", request.prepares_reservation_id || request.reservation_id).maybeSingle() : Promise.resolve({ data: null }),
    (request.prepares_reservation_id || request.reservation_id)
      ? supabase
          .from("reservation_messages")
          .select("*")
          .eq("reservation_id", request.prepares_reservation_id || request.reservation_id)
          .order("sent_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  const property = propertyResult.data as Row | null;
  const reservation = reservationResult.data as Row | null;
  const messages = (messagesResult.data ?? []) as Row[];
  const coverUrl = await propertyCoverUrl(supabase, request.property_id);
  const { previousReservation, nextReservation } = await previousAndNextReservations(supabase, reservation, request.property_id);

  const guestCount = numberValue(reservation, ["number_of_guests", "guest_count", "guests"]);
  const adults = numberValue(reservation, ["num_adult"]);
  const children = numberValue(reservation, ["num_child"]);
  const pets = numberValue(reservation, ["pets_count"]);
  const hasPets = pets !== null && pets > 0;
  const missionLabel = missionTypeLabel(request as Row);

  const guestNotes = [
    sanitizeNote(textValue(reservation, ["guest_comments"], "")),
    sanitizeNote(textValue(reservation, ["special_requests"], "")),
    sanitizeNote(textValue(reservation, ["pets_notes"], "")),
  ].filter(Boolean).join("\n\n");

    const priorityNote = sanitizeNote(textValue(reservation, ["cleaner_preparation_note"], ""));

  const propertyNotes = [
    sanitizeNote(textValue(request, ["cleaner_notes", "notes", "description"], "")),
    sanitizeNote(textValue(property, ["cleaning_notes", "housekeeping_notes"], "")),
  ].filter(Boolean).join("\n\n");

  const operationalMessages: (Row & { cleanedText: string })[] = messages
    .map((message): Row & { cleanedText: string } => ({
      ...message,
      cleanedText: sanitizeCorrespondence(message.body_text || message.body || message.raw_payload?.message),
    }))
    .filter((message): message is Row & { cleanedText: string } => Boolean(message.cleanedText))
    .filter((message) => message.direction === "guest_to_host" || messageLooksOperational(message.cleanedText))
    .slice(0, 12);

  return (
    <main className="min-h-screen bg-[#F6F3EF] pb-24 text-[#112532]">
      <section className="relative overflow-hidden bg-[#112532] text-white">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#112532] via-[#163444] to-[#80A5B7]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#112532] via-[#112532]/72 to-[#112532]/28" />
        <div className="relative mx-auto max-w-4xl px-4 pb-8 pt-5">
          <div className="flex items-center justify-between gap-3">
            <Link href={`/mission/${token}`} className="rounded-full bg-white/12 px-4 py-2 text-xs font-black text-white ring-1 ring-white/18">
              ← Retour mission
            </Link>
            <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#112532]">Briefing séjour</span>
          </div>
          <div className="mt-14">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-white/55">{missionLabel} · {property?.name ?? "Logement"}</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Ce qu’il faut savoir avant d’intervenir</h1>
            <p className="mt-3 max-w-2xl text-base font-bold text-white/72">
              Informations utiles pour préparer le logement, sans données financières ni messages privés propriétaire.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <InfoCard label="Mission" value={missionLabel} detail={request.status ? `Statut : ${request.status}` : undefined} />
          <InfoCard
            label="Prêt avant"
            value={dateTime(request.ready_by_at || request.completion_deadline_at || request.work_window_end_at || request.scheduled_end_at)}
            detail={`Fenêtre : ${dateTime(request.work_window_start_at || request.scheduled_start_at)}`}
            warn
          />
          <InfoCard
            label="Voyageurs"
            value={guestCount !== null ? `${guestCount}` : "—"}
            detail={adults !== null || children !== null ? `${adults ?? 0} adulte(s), ${children ?? 0} enfant(s)` : undefined}
          />
          <InfoCard
            label="Animaux"
            value={hasPets ? `${pets} animal/animaux` : "Non renseigné"}
            detail={hasPets ? "Prévoir attention poils / traces / odeurs." : undefined}
            warn={hasPets}
          />
        </section>

        {priorityNote ? (
          <section className="rounded-[2rem] bg-[#112532] p-5 text-white shadow-sm ring-1 ring-[#112532]/20">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Important pour le séjour préparé</p>
            <h2 className="mt-2 text-2xl font-black">À faire / vérifier en priorité</h2>
            <p className="mt-4 whitespace-pre-wrap text-base font-bold leading-7 text-white/82">{priorityNote}</p>
          </section>
        ) : null}

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Séjour concerné</p>
          <h2 className="mt-2 text-2xl font-black">{guestName(reservation)}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoCard label="Arrivée voyageurs" value={dateTime(reservation?.checkin_at)} />
            <InfoCard label="Départ voyageurs" value={dateTime(reservation?.checkout_at)} />
            <InfoCard label="Langue" value={guestLanguageLabel(reservation?.guest_language)} detail={textValue(reservation, ["guest_country"], "Pays non renseigné")} />
            <InfoCard
              label="Linge / buanderie"
              value={request.linen_required ?? reservation?.linen_required ? "Linge requis" : "À vérifier"}
              detail={request.laundry_required ?? reservation?.laundry_required ? "Buanderie à prévoir" : "Pas d’info buanderie"}
            />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <StayCard label="Séjour précédent" reservation={previousReservation} />
          <StayCard label="Séjour suivant" reservation={nextReservation} />
        </section>

        {guestNotes ? (
          <section className="rounded-[2rem] bg-[#FFF5DD] p-5 text-[#8A4D00] shadow-sm ring-1 ring-[#F4B044]/25">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-55">Notes voyageurs utiles</p>
            <h2 className="mt-2 text-2xl font-black">À prendre en compte</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm font-bold leading-6 opacity-78">{guestNotes}</p>
          </section>
        ) : null}

        {propertyNotes ? (
          <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Notes mission / logement</p>
            <h2 className="mt-2 text-2xl font-black">Instructions utiles</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm font-bold leading-6 text-[#112532]/68">{propertyNotes}</p>
          </section>
        ) : null}

        {operationalMessages.length ? (
          <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#80A5B7]">Messages voyageurs</p>
            <h2 className="mt-2 text-2xl font-black">Demandes à vérifier</h2>
            <p className="mt-2 text-sm font-bold text-[#112532]/52">
              Extraits utiles des messages du séjour. Vérifier surtout les demandes de linge, lit bébé, animaux, horaires ou équipements.
            </p>

            <div className="mt-5 space-y-3">
              {operationalMessages.map((message) => (
                <div key={message.id} className="rounded-2xl bg-[#F4F8FA] p-4 ring-1 ring-[#112532]/6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black text-[#112532]">{correspondenceSourceLabel(message)}</p>
                    <p className="text-xs font-bold text-[#112532]/45">{dateTime(message.sent_at || message.received_at || message.created_at)}</p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-bold leading-6 text-[#112532]/68">
                    {message.cleanedText}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[2rem] bg-[#EFF6F8] p-5 text-[#1E5365] shadow-sm ring-1 ring-[#80A5B7]/25">
          <p className="text-sm font-black">Confidentialité</p>
          <p className="mt-2 text-sm font-bold opacity-75">
            Cette page affiche uniquement les informations utiles à l’intervention. Elle ne montre pas le prix du séjour,
            les revenus propriétaire, ni la correspondance privée avec le voyageur.
          </p>
        </section>

        <Link href={`/mission/${token}`} className="block rounded-[1.5rem] bg-[#112532] px-5 py-4 text-center text-sm font-black text-white shadow-sm">
          Retour à la mission
        </Link>
      </div>
    </main>
  );
}
