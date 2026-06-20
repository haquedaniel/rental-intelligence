import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ActionLink,
  ActionPanel,
  Card,
  EmptyState,
  Field,
  FieldGrid,
  IssueShell,
  Pill,
  Timeline,
  compactDate,
  dateTime,
  fullName,
  parisDateKey,
  statusLabel,
  timeOnly,
  type Row,
} from "@/components/owner-planning/issues/IssuePage";

export const dynamic = "force-dynamic";

function planningHref(request: Row): string {
  const date =
    request.scheduled_start_at
      ? parisDateKey(request.scheduled_start_at)
      : request.created_at
        ? parisDateKey(request.created_at)
        : parisDateKey(new Date().toISOString());

  const params = new URLSearchParams();
  params.set("start", date);
  params.set("end", date);
  if (request.property_id) params.set("property", String(request.property_id));
  return `/owner/cockpit?${params.toString()}`;
}

function payloadOf(row: Row): Row {
  const payload = row.payload ?? row.raw_payload ?? row.metadata ?? {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload && typeof payload === "object" ? payload : {};
}

function pick(row: Row | null | undefined, keys: string[]): any {
  if (!row) return null;
  const payload = payloadOf(row);

  for (const key of keys) {
    const value = row[key] ?? payload[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function messageRecipient(message: Row): string {
  return String(
    pick(message, [
      "to_phone",
      "phone",
      "phone_number",
      "recipient_phone",
      "recipient_phone_number",
      "to_number",
      "to",
      "recipient",
      "destination",
      "cleaner_phone",
    ]) ?? "Destinataire non renseigné",
  );
}

function messageBody(message: Row): string {
  return String(
    pick(message, [
      "body",
      "message",
      "content",
      "text",
      "message_body",
      "sms_body",
      "rendered_body",
      "template_body",
    ]) ?? "",
  );
}

function cleanerPhone(cleaner?: Row | null): string | null {
  const value = pick(cleaner, [
    "phone",
    "phone_number",
    "mobile",
    "mobile_phone",
    "whatsapp",
    "whatsapp_phone",
  ]);
  return value ? String(value) : null;
}

function telHref(cleaner?: Row | null): string | null {
  const phone = cleanerPhone(cleaner);
  if (!phone) return null;
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function whatsappHref(cleaner?: Row | null): string | null {
  const phone = cleanerPhone(cleaner);
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function messageStatusText(status?: string | null): string {
  switch (status) {
    case "sent":
      return "Envoyé";
    case "queued":
      return "En attente";
    case "delivered":
      return "Distribué";
    case "failed":
      return "Échec";
    case "cancelled":
      return "Annulé";
    default:
      return status || "—";
  }
}

function messageTitle(message: Row): string {
  const channel = String(message.channel ?? message.message_channel ?? "sms").toUpperCase();
  const direction = String(message.direction ?? "sortant");
  return `${channel} ${direction}`;
}

function problemTitle(request: Row, messages: Row[]): string {
  if (messages.some((message) => message.status === "failed")) return "SMS échoué";
  if (request.status === "refused") return "Mission refusée";
  if (["created", "sent"].includes(request.status)) return "Mission en attente";
  if (request.status === "problem_reported") return "Problème signalé";
  if (request.schedule_status === "planning_changed") return "Planning modifié";
  return "Mission à vérifier";
}

function requestDecisionEvent(request: Row) {
  if (request.status === "refused") {
    return {
      key: `decision-${request.id}`,
      title: "Réponse intervenante : mission refusée",
      detail: request.refusal_reason
        ? `Motif : ${request.refusal_reason}`
        : "Motif de refus non renseigné.",
      meta: dateTime(request.responded_at || request.updated_at || request.created_at),
      status: "refused",
      statusText: "Refusée",
    };
  }

  if (request.status === "accepted") {
    return {
      key: `decision-${request.id}`,
      title: "Réponse intervenante : mission acceptée",
      detail: "La mission est confirmée par l’intervenante.",
      meta: dateTime(request.responded_at || request.updated_at || request.created_at),
      status: "accepted",
      statusText: "Acceptée",
    };
  }

  return null;
}

function ContactButtons({ cleaner }: { cleaner?: Row | null }) {
  const tel = telHref(cleaner);
  const whatsapp = whatsappHref(cleaner);

  if (!tel && !whatsapp) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-400">
        Pas de téléphone
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tel && (
        <a
          href={tel}
          className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
        >
          Appeler
        </a>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-black text-white"
        >
          WhatsApp
        </a>
      )}
    </div>
  );
}

function CleanerOption({
  cleaner,
  note,
  status,
}: {
  cleaner?: Row | null;
  note: string;
  status?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 text-slate-950 ring-1 ring-white/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{fullName(cleaner)}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{note}</p>
        </div>
        {status && <Pill status={status} />}
      </div>

      <div className="mt-3">
        <ContactButtons cleaner={cleaner} />
      </div>
    </div>
  );
}

function ResolutionPanel({
  request,
  messages,
  property,
  cleaner,
  availableAssignments,
  refusedAssignments,
  cleanerById,
  allKnownCleanersRefused,
}: {
  request: Row;
  messages: Row[];
  property: Row | null;
  cleaner: Row | null;
  availableAssignments: Row[];
  refusedAssignments: Row[];
  cleanerById: Record<string, Row>;
  allKnownCleanersRefused: boolean;
}) {
  const smsFailed = messages.some((message) => message.status === "failed");

  if (smsFailed) {
    return (
      <ActionPanel>
        <p className="text-sm font-semibold text-white/80">
          Le problème principal est l’envoi du SMS. Vérifier le numéro, puis contacter l’intervenante directement ou renvoyer la proposition.
        </p>

        <div className="mt-4">
          <CleanerOption
            cleaner={cleaner}
            note={`Intervenante associée à cette mission · ${property?.name ?? "logement"}`}
            status={request.status}
          />
        </div>

        <SecondaryLinks request={request} />
      </ActionPanel>
    );
  }

  if (request.status === "refused") {
    if (availableAssignments.length > 0) {
      return (
        <ActionPanel>
          <p className="text-sm font-semibold text-white/80">
            La mission a été refusée. Il reste des intervenantes associées à ce logement qui n’ont pas encore refusé : la prochaine action logique est de proposer la mission à l’une d’elles.
          </p>

          <div className="mt-4 space-y-2">
            {availableAssignments.slice(0, 4).map((assignment) => {
              const optionCleaner = cleanerById[String(assignment.cleaner_id)];
              return (
                <CleanerOption
                  key={assignment.id}
                  cleaner={optionCleaner}
                  note={`Non sollicitée pour cette réservation · priorité ${assignment.priority ?? "—"}`}
                  status="created"
                />
              );
            })}
          </div>

          <p className="mt-4 rounded-2xl bg-white/10 p-3 text-xs font-semibold text-white/60">
            Étape suivante à automatiser : bouton “Proposer à cette intervenante” qui crée une nouvelle mission/proposition sans repasser par le calendrier.
          </p>

          <SecondaryLinks request={request} />
        </ActionPanel>
      );
    }

    if (allKnownCleanersRefused) {
      return (
        <ActionPanel>
          <p className="text-sm font-semibold text-white/80">
            Toutes les intervenantes connues pour ce logement semblent avoir refusé ou déjà été sollicitées. Il ne reste plus une simple réattribution automatique : il faut passer en mode secours.
          </p>

          <div className="mt-4 space-y-2">
            {refusedAssignments.slice(0, 4).map((assignment) => {
              const optionCleaner = cleanerById[String(assignment.cleaner_id)];
              return (
                <CleanerOption
                  key={assignment.id}
                  cleaner={optionCleaner}
                  note="A déjà refusé · possibilité de recontacter avec bonus, autre horaire ou explication"
                  status="refused"
                />
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl bg-white/10 p-3 text-xs font-semibold text-white/70">
            <p className="font-black text-white">Options réalistes</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Recontacter une intervenante avec un bonus ou une fenêtre horaire différente.</li>
              <li>Appeler un renfort externe / remplaçante hors liste.</li>
              <li>Passer en intervention propriétaire / concierge.</li>
              <li>Si aucune solution : marquer “non staffé” et déclencher une alerte forte.</li>
            </ul>
          </div>

          <SecondaryLinks request={request} />
        </ActionPanel>
      );
    }

    return (
      <ActionPanel>
        <p className="text-sm font-semibold text-white/80">
          Mission refusée. Vérifier le motif, puis décider entre réattribution, recontact manuel ou mission de secours.
        </p>

        <div className="mt-4">
          <CleanerOption
            cleaner={cleaner}
            note="Intervenante ayant refusé cette proposition"
            status="refused"
          />
        </div>

        <SecondaryLinks request={request} />
      </ActionPanel>
    );
  }

  if (["created", "sent"].includes(request.status)) {
    return (
      <ActionPanel>
        <p className="text-sm font-semibold text-white/80">
          La proposition est encore en attente. Si l’échéance approche, il faut relancer ou proposer à quelqu’un d’autre.
        </p>

        <div className="mt-4">
          <CleanerOption
            cleaner={cleaner}
            note="Intervenante actuellement sollicitée"
            status={request.status}
          />
        </div>

        <SecondaryLinks request={request} />
      </ActionPanel>
    );
  }

  return (
    <ActionPanel>
      <p className="text-sm font-semibold text-white/80">
        Vérifier le contexte de cette mission, puis décider si une action manuelle est nécessaire.
      </p>

      <SecondaryLinks request={request} />
    </ActionPanel>
  );
}

function SecondaryLinks({ request }: { request: Row }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
      <ActionLink href={planningHref(request)}>Voir le jour au calendrier</ActionLink>
      <ActionLink href="/admin/operations">Ancien écran</ActionLink>
    </div>
  );
}

export default async function RequestIssuePage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  await requireAdmin();
  const { requestId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: request, error: requestError } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(`Impossible de charger la mission : ${requestError.message}`);
  }

  if (!request) {
    return (
      <EmptyState
        title="Mission introuvable"
        detail="Cette notification pointe vers une mission qui n’existe plus ou qui a été supprimée."
      />
    );
  }

  const [
    propertyResult,
    reservationResult,
    messagesResult,
    reportsResult,
    assignmentsResult,
    siblingRequestsResult,
  ] = await Promise.all([
    request.property_id
      ? supabase.from("properties").select("*").eq("id", request.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
    request.reservation_id
      ? supabase.from("reservations").select("*").eq("id", request.reservation_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("outbound_messages")
      .select("*")
      .eq("cleaning_request_id", request.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("cleaning_reports")
      .select("*")
      .eq("cleaning_request_id", request.id)
      .order("created_at", { ascending: false }),
    request.property_id
      ? supabase
          .from("property_cleaner_assignments")
          .select("*")
          .eq("property_id", request.property_id)
          .eq("active", true)
          .order("priority", { ascending: true })
      : Promise.resolve({ data: [] }),
    request.reservation_id
      ? supabase
          .from("cleaning_requests")
          .select("*")
          .eq("reservation_id", request.reservation_id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [request] }),
  ]);

  const property = propertyResult.data as Row | null;
  const reservation = reservationResult.data as Row | null;
  const messages = (messagesResult.data ?? []) as Row[];
  const reports = (reportsResult.data ?? []) as Row[];
  const assignments = (assignmentsResult.data ?? []) as Row[];
  const siblingRequests = ((siblingRequestsResult.data ?? []) as Row[]).length
    ? (siblingRequestsResult.data ?? []) as Row[]
    : [request];

  const cleanerIds = Array.from(
    new Set(
      [
        request.assigned_cleaner_id,
        ...assignments.map((assignment) => assignment.cleaner_id),
        ...siblingRequests.map((item) => item.assigned_cleaner_id),
      ].filter(Boolean).map(String),
    ),
  );

  let cleanerRows: Row[] = [];
  if (cleanerIds.length > 0) {
    const { data } = await supabase
      .from("cleaners")
      .select("*")
      .in("id", cleanerIds);
    cleanerRows = data ?? [];
  }

  const cleanerById: Record<string, Row> = Object.fromEntries(
    cleanerRows.map((cleaner) => [String(cleaner.id), cleaner]),
  );

  const cleaner = request.assigned_cleaner_id
    ? cleanerById[String(request.assigned_cleaner_id)] ?? null
    : null;

  const refusedCleanerIds = new Set(
    siblingRequests
      .filter((item) => item.status === "refused")
      .map((item) => item.assigned_cleaner_id)
      .filter(Boolean)
      .map(String),
  );

  const askedCleanerIds = new Set(
    siblingRequests
      .map((item) => item.assigned_cleaner_id)
      .filter(Boolean)
      .map(String),
  );

  const availableAssignments = assignments.filter((assignment) =>
    assignment.cleaner_id && !askedCleanerIds.has(String(assignment.cleaner_id)),
  );

  const refusedAssignments = assignments.filter((assignment) =>
    assignment.cleaner_id && refusedCleanerIds.has(String(assignment.cleaner_id)),
  );

  const acceptedRequest = siblingRequests.find((item) => item.status === "accepted");

  const allKnownCleanersRefused =
    assignments.length > 0 &&
    !acceptedRequest &&
    availableAssignments.length === 0 &&
    assignments.every((assignment) =>
      assignment.cleaner_id && refusedCleanerIds.has(String(assignment.cleaner_id)),
    );

  const title = problemTitle(request, messages);
  const subtitle = `${property?.name ?? "Logement"} · ${compactDate(request.scheduled_start_at)} · ${fullName(cleaner)}`;
  const severity = title.includes("échoué") || title.includes("refusée") ? "red" : "amber";

  const decisionEvent = requestDecisionEvent(request);

  const timelineItems = [
    {
      key: `request-created-${request.id}`,
      title: "Mission créée / proposée",
      detail: `Statut actuel : ${statusLabel(request.status)}`,
      meta: dateTime(request.created_at),
      status: request.status,
    },
    ...(decisionEvent ? [decisionEvent] : []),
    ...messages.map((message) => {
      const body = messageBody(message);
      const recipient = messageRecipient(message);

      return {
        key: `message-${message.id}`,
        title: messageTitle(message),
        detail: (
          <div className="space-y-1">
            <p>À : {recipient}</p>
            {body ? (
              <p className="line-clamp-3 rounded-xl bg-white p-2 text-slate-600 ring-1 ring-slate-100">
                {body}
              </p>
            ) : (
              <p className="text-slate-400">Contenu du message non affiché par cette table.</p>
            )}
          </div>
        ),
        meta: dateTime(message.created_at),
        status: message.status,
        statusText: messageStatusText(message.status),
      };
    }),
    ...reports.map((report) => ({
      key: `report-${report.id}`,
      title: "Rapport ménage",
      detail: report.problem_description || report.notes || "Rapport reçu",
      meta: dateTime(report.created_at),
      status: report.status || "report_submitted",
    })),
  ];

  const assignmentTimeline = siblingRequests.map((item) => ({
    key: `sibling-${item.id}`,
    title: fullName(
      item.assigned_cleaner_id
        ? cleanerById[String(item.assigned_cleaner_id)]
        : null,
    ),
    detail: `${dateTime(item.scheduled_start_at)} · ${item.refusal_reason ? `Motif : ${item.refusal_reason}` : "Pas de motif"}`,
    meta: item.id === request.id ? "Mission actuelle" : "Autre proposition liée à cette réservation",
    status: item.status,
  }));

  return (
    <IssueShell title={title} subtitle={subtitle} severity={severity}>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card title="Contexte mission">
            <FieldGrid>
              <Field label="Statut mission" value={<Pill status={request.status} />} />
              <Field label="Planning" value={request.schedule_status || "Normal"} />
              <Field label="Logement" value={property?.name ?? "—"} />
              <Field label="Intervenante" value={fullName(cleaner)} />
              <Field label="Début prévu" value={dateTime(request.scheduled_start_at)} />
              <Field label="Fin prévue" value={dateTime(request.scheduled_end_at)} />
              <Field label="Montant estimé" value={moneyOrDash(request.estimated_amount)} />
              <Field label="Réservation liée" value={reservation?.source_booking_id || reservation?.id || "—"} />
              <Field label="Titre" value={request.title || "Mission ménage"} />
            </FieldGrid>
          </Card>

          <Card title="Réservation">
            {reservation ? (
              <FieldGrid>
                <Field label="Voyageur" value={reservation.guest_name || "—"} />
                <Field label="Arrivée" value={`${compactDate(reservation.checkin_at)} · ${timeOnly(reservation.checkin_at)}`} />
                <Field label="Départ" value={`${compactDate(reservation.checkout_at)} · ${timeOnly(reservation.checkout_at)}`} />
                <Field label="Statut" value={reservation.status || "—"} />
                <Field label="Canal" value={reservation.channel || reservation.source_system || "—"} />
                <Field label="Voyageurs" value={reservation.number_of_guests || "—"} />
              </FieldGrid>
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                Aucune réservation liée à cette mission.
              </p>
            )}
          </Card>

          <Card title="Historique messages / rapports">
            <Timeline items={timelineItems} />
          </Card>

          <Card title="Propositions liées à cette réservation">
            <Timeline items={assignmentTimeline} />
          </Card>
        </div>

        <div className="space-y-4">
          <ResolutionPanel
            request={request}
            messages={messages}
            property={property}
            cleaner={cleaner}
            availableAssignments={availableAssignments}
            refusedAssignments={refusedAssignments}
            cleanerById={cleanerById}
            allKnownCleanersRefused={allKnownCleanersRefused}
          />

          <Card title="Diagnostic rapide">
            <div className="space-y-2 text-sm font-semibold text-slate-600">
              <p>Messages envoyés : <strong className="text-slate-950">{messages.length}</strong></p>
              <p>Rapports reçus : <strong className="text-slate-950">{reports.length}</strong></p>
              <p>Intervenantes logement : <strong className="text-slate-950">{assignments.length}</strong></p>
              <p>Déjà sollicitées : <strong className="text-slate-950">{askedCleanerIds.size}</strong></p>
              <p>Ont refusé : <strong className="text-slate-950">{refusedCleanerIds.size}</strong></p>
              <p>Encore disponibles : <strong className="text-slate-950">{availableAssignments.length}</strong></p>
              <p>Motif refus / note : <strong className="text-slate-950">{request.refusal_reason || request.notes || "—"}</strong></p>
            </div>
          </Card>
        </div>
      </div>
    </IssueShell>
  );
}

function moneyOrDash(value: any): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
