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
  timeOnly,
  type Row,
} from "@/components/owner-planning/issues/IssuePage";

export const dynamic = "force-dynamic";

function planningHref(reservation: Row): string {
  const date = reservation.checkout_at
    ? parisDateKey(reservation.checkout_at)
    : parisDateKey(new Date().toISOString());

  const params = new URLSearchParams();
  params.set("start", date);
  params.set("end", date);
  if (reservation.property_id) params.set("property", String(reservation.property_id));
  return `/owner/cockpit?${params.toString()}`;
}

export default async function MissingCleaningIssuePage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  await requireAdmin();
  const { reservationId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError) {
    throw new Error(`Impossible de charger la réservation : ${reservationError.message}`);
  }

  if (!reservation) {
    return (
      <EmptyState
        title="Réservation introuvable"
        detail="Cette notification pointe vers une réservation qui n’existe plus ou qui a été supprimée."
      />
    );
  }

  const [
    propertyResult,
    requestsResult,
    assignmentsResult,
  ] = await Promise.all([
    reservation.property_id
      ? supabase.from("properties").select("*").eq("id", reservation.property_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("cleaning_requests")
      .select("*")
      .eq("reservation_id", reservation.id)
      .order("created_at", { ascending: false }),
    reservation.property_id
      ? supabase
          .from("property_cleaner_assignments")
          .select("*")
          .eq("property_id", reservation.property_id)
          .eq("active", true)
          .order("priority", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const property = propertyResult.data as Row | null;
  const requests = (requestsResult.data ?? []) as Row[];
  const assignments = (assignmentsResult.data ?? []) as Row[];

  const cleanerIds = Array.from(
    new Set(assignments.map((assignment) => assignment.cleaner_id).filter(Boolean)),
  );

  let cleaners: Row[] = [];
  if (cleanerIds.length > 0) {
    const { data } = await supabase
      .from("cleaners")
      .select("*")
      .in("id", cleanerIds);
    cleaners = data ?? [];
  }

  const cleanerById = Object.fromEntries(cleaners.map((cleaner) => [cleaner.id, cleaner]));

  const activeRequest = requests.find((request) => request.status !== "cancelled");

  const title = activeRequest ? "Mission déjà créée à vérifier" : "Créer une mission ménage";
  const subtitle = `${property?.name ?? "Logement"} · départ ${compactDate(reservation.checkout_at)}`;

  const timelineItems = requests.map((request) => ({
    key: `request-${request.id}`,
    title: "Mission ménage",
    detail: `${dateTime(request.scheduled_start_at)} · ${fullName(cleanerById[request.assigned_cleaner_id])}`,
    meta: request.created_at ? `Créée ${dateTime(request.created_at)}` : undefined,
    status: request.status,
  }));

  return (
    <IssueShell title={title} subtitle={subtitle} severity={activeRequest ? "amber" : "red"}>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card title="Réservation concernée">
            <FieldGrid>
              <Field label="Logement" value={property?.name ?? "—"} />
              <Field label="Voyageur" value={reservation.guest_name || "—"} />
              <Field label="Départ" value={`${compactDate(reservation.checkout_at)} · ${timeOnly(reservation.checkout_at)}`} />
              <Field label="Arrivée suivante" value="À vérifier dans le planning" />
              <Field label="Canal" value={reservation.channel || reservation.source_system || "—"} />
              <Field label="Référence" value={reservation.source_booking_id || reservation.id} />
            </FieldGrid>
          </Card>

          <Card title="Missions existantes pour cette réservation">
            <Timeline items={timelineItems} />
          </Card>

          <Card title="Intervenantes possibles">
            {assignments.length === 0 ? (
              <p className="text-sm font-semibold text-[#112532]/48">
                Aucune intervenante active associée à ce logement.
              </p>
            ) : (
              <div className="space-y-2">
                {assignments.map((assignment) => {
                  const cleaner = cleanerById[assignment.cleaner_id];
                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[#F6F3EF] p-3 ring-1 ring-slate-100"
                    >
                      <div>
                        <p className="text-sm font-black text-[#112532]">{fullName(cleaner)}</p>
                        <p className="text-xs font-semibold text-[#112532]/48">
                          {assignment.role || "Intervenante"} · priorité {assignment.priority ?? "—"}
                        </p>
                      </div>
                      <Pill status="available" />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <ActionPanel>
            {activeRequest ? (
              <p className="text-sm font-semibold text-white/80">
                Une mission existe déjà pour cette réservation. Vérifier pourquoi elle est encore signalée avant d’en créer une autre.
              </p>
            ) : (
              <p className="text-sm font-semibold text-white/80">
                Créer ou associer une mission ménage pour ce départ. L’objectif est d’éviter qu’un départ reste sans intervenante confirmée.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionLink href={planningHref(reservation)}>Ouvrir dans planning</ActionLink>
              <ActionLink href="/admin/operations">Ancien écran</ActionLink>
            </div>

            <p className="mt-4 text-xs font-semibold text-white/50">
              La création directe d’une mission depuis cette page sera ajoutée après validation du workflow.
            </p>
          </ActionPanel>

          <Card title="Diagnostic rapide">
            <div className="space-y-2 text-sm font-semibold text-[#112532]/62">
              <p>Missions liées : <strong className="text-[#112532]">{requests.length}</strong></p>
              <p>Mission active : <strong className="text-[#112532]">{activeRequest ? "oui" : "non"}</strong></p>
              <p>Équipe logement : <strong className="text-[#112532]">{assignments.length}</strong></p>
            </div>
          </Card>
        </div>
      </div>
    </IssueShell>
  );
}
