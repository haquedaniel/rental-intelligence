import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createOrUpdateCleaningRequest } from "./actions";
import MissionProfileFields from "./MissionProfileFields";

export const dynamic = "force-dynamic";

const PARIS_TZ = "Europe/Paris";

type Row = Record<string, any>;

const SERVICE_OPTIONS = [
  ["standard_cleaning", "Ménage standard"],
  ["deep_cleaning", "Grand ménage"],
  ["linen_laundry", "Linge / lessive"],
  ["inventory_check", "Contrôle inventaire"],
  ["garden_lawn", "Jardin / tonte"],
  ["maintenance_check", "Petite maintenance"],
  ["other", "Mission ponctuelle"],
];

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

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function timeLabel(iso?: string | null): string {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(":", "h");
}

function dateLabel(iso?: string | null): string {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function fullName(cleaner?: Row | null): string {
  if (!cleaner) return "Intervenante";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || "Intervenante";
}

function initials(cleaner?: Row | null): string {
  if (!cleaner) return "?";
  const first = cleaner.first_name?.[0] ?? "";
  const last = cleaner.last_name?.[0] ?? "";
  return `${first}${last}` || "?";
}

function cleanerPhoto(cleaner?: Row | null, size = "h-12 w-12") {
  if (!cleaner) {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-700 ring-1 ring-red-100`}>
        ?
      </div>
    );
  }

  if (cleaner.profilePhotoSignedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cleaner.profilePhotoSignedUrl}
        alt=""
        className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white`}
      />
    );
  }

  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700 ring-1 ring-slate-200`}>
      {initials(cleaner)}
    </div>
  );
}

function roleLabel(role?: string): string {
  return role === "primary" ? "Principale" : "Renfort";
}

function roleClass(role?: string): string {
  return role === "primary"
    ? "bg-slate-950 text-white"
    : "bg-slate-100 text-slate-700";
}

function todayParisDateKey(): string {
  return parisDateKey(new Date());
}

export default async function CreateCleaningRequestPage({
  searchParams,
}: {
  searchParams?: Promise<{
    reservation_id?: string;
    property_id?: string;
    date?: string;
  }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const reservationId = params?.reservation_id ?? "";
  const propertyIdParam = params?.property_id ?? "";
  const dateParam = params?.date ?? "";

  const supabase = getSupabaseAdmin();

  let reservation: Row | null = null;

  if (reservationId) {
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .maybeSingle();

    reservation = data;
  }

  const propertyId = reservation?.property_id ?? propertyIdParam;

  if (!propertyId) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <Link href="/admin/operations" className="text-sm font-semibold text-slate-600">
            ← Planning opérations
          </Link>

          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h1 className="text-2xl font-bold text-slate-950">
              Informations manquantes
            </h1>
            <p className="mt-2 text-slate-600">
              Impossible de créer une mission sans logement ou réservation valide.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  const { data: existingRequests } = reservation
    ? await supabase
        .from("cleaning_requests")
        .select("*")
        .eq("reservation_id", reservation.id)
        .order("created_at", { ascending: false })
        .limit(1)
    : { data: [] };

  const existingRequest = (existingRequests ?? [])[0];
  const existingIsActive =
    existingRequest && !["cancelled", "refused"].includes(existingRequest.status);

  const { data: profiles } = await supabase
    .from("property_cleaning_profiles")
    .select("*")
    .eq("property_id", propertyId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  const { data: assignments } = await supabase
    .from("property_cleaner_assignments")
    .select("*")
    .eq("property_id", propertyId)
    .eq("active", true)
    .order("role", { ascending: false })
    .order("priority", { ascending: true });

  const assignedCleanerIds = Array.from(
    new Set((assignments ?? []).map((assignment) => assignment.cleaner_id)),
  );

  let cleaners: Row[] = [];

  if (assignedCleanerIds.length > 0) {
    const { data: cleanerRows } = await supabase
      .from("cleaners")
      .select("*")
      .in("id", assignedCleanerIds);

    cleaners = await Promise.all(
      (cleanerRows ?? []).map(async (cleaner) => {
        if (!cleaner.profile_photo_path) return cleaner;

        const { data } = await supabase.storage
          .from(cleaner.profile_photo_bucket || "cleaner-profile-photos")
          .createSignedUrl(cleaner.profile_photo_path, 60 * 60);

        return {
          ...cleaner,
          profilePhotoSignedUrl: data?.signedUrl ?? null,
        };
      }),
    );
  }

  const cleanerById = Object.fromEntries(cleaners.map((cleaner) => [cleaner.id, cleaner]));
  const profileRows = profiles ?? [];
  const assignmentRows = assignments ?? [];

  const defaultCleanerId = assignmentRows[0]?.cleaner_id ?? "";
  const defaultProfile =
    profileRows.find((profile) => profile.code === "light") ?? profileRows[0];
  const defaultProfileId = defaultProfile?.id ?? "";

  const scheduledDate = reservation
    ? parisDateKey(reservation.checkout_at)
    : dateParam || todayParisDateKey();

  const defaultDeadlineDate = reservation
    ? addDays(scheduledDate, 2)
    : scheduledDate;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin/operations" className="text-sm font-semibold text-slate-600">
          ← Planning opérations
        </Link>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {reservation ? "Ménage après séjour" : "Mission planifiée"}
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Créer une mission
          </h1>

          <p className="mt-3 text-slate-600">
            Choisissez le type de mission, l’intervenante, la date prévue et la
            deadline. L’envoi SMS sera pris en charge par l’automatisation.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Logement</p>
              <p className="mt-1 font-bold text-slate-950">
                {property?.name ?? "Non identifié"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                {reservation ? "Réservation" : "Origine"}
              </p>
              <p className="mt-1 font-bold text-slate-950">
                {reservation
                  ? reservation.guest_name ?? reservation.source_booking_id ?? "Client"
                  : "Mission manuelle"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">
                {reservation ? "Départ" : "Date proposée"}
              </p>
              <p className="mt-1 font-bold text-slate-950">
                {reservation
                  ? `${dateLabel(reservation.checkout_at)} · ${timeLabel(reservation.checkout_at)}`
                  : scheduledDate}
              </p>
            </div>
          </div>

          {existingIsActive ? (
            <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-amber-900 ring-1 ring-amber-200">
              <p className="font-bold">Une mission existe déjà.</p>
              <p className="mt-1 text-sm">
                Statut actuel : {existingRequest.status}. La création manuelle
                est bloquée pour éviter les doublons.
              </p>
            </div>
          ) : profileRows.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-red-50 p-5 text-red-900 ring-1 ring-red-200">
              <p className="font-bold">Aucun profil ménage configuré.</p>
              <p className="mt-1 text-sm">
                Créez d’abord un profil ménage pour ce logement.
              </p>
            </div>
          ) : assignmentRows.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-red-50 p-5 text-red-900 ring-1 ring-red-200">
              <p className="font-bold">Aucune intervenante affectée.</p>
              <p className="mt-1 text-sm">
                Affectez au moins une intervenante à ce logement avant de créer
                la mission.
              </p>
            </div>
          ) : (
            <form action={createOrUpdateCleaningRequest} className="mt-8 space-y-6">
              <input type="hidden" name="reservation_id" value={reservation?.id ?? ""} />
              <input type="hidden" name="property_id" value={propertyId} />

              <section>
                <label className="block text-sm font-semibold text-slate-800">
                  Titre optionnel
                </label>
                <input
                  name="title"
                  placeholder={reservation ? "Ménage après séjour" : "Grand ménage, jardin, contrôle linge..."}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Laissez vide pour utiliser le nom du type de mission choisi.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slate-950">
                  Intervenante
                </h2>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {assignmentRows.map((assignment, index) => {
                    const cleaner = cleanerById[assignment.cleaner_id];

                    return (
                      <label
                        key={assignment.id}
                        className="cursor-pointer rounded-3xl border border-slate-200 bg-slate-50 p-4 has-[:checked]:border-slate-950 has-[:checked]:bg-white has-[:checked]:ring-2 has-[:checked]:ring-slate-950"
                      >
                        <input
                          type="radio"
                          name="cleaner_id"
                          value={assignment.cleaner_id}
                          defaultChecked={assignment.cleaner_id === defaultCleanerId || index === 0}
                          className="sr-only"
                        />

                        <div className="flex items-center gap-3">
                          {cleanerPhoto(cleaner)}

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-950">
                              {fullName(cleaner)}
                            </p>

                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${roleClass(assignment.role)}`}>
                                {roleLabel(assignment.role)}
                              </span>
                              {assignment.familiar && (
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800">
                                  Connait le logement
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {assignment.travel_distance_km ?? 0} km ·{" "}
                              {cleaner?.hourly_rate_eur ?? "?"} €/h
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>

              <MissionProfileFields
                profiles={profileRows.map((profile) => ({
                  id: profile.id,
                  code: profile.code,
                  label: profile.label,
                  service_type: profile.service_type,
                  estimated_hours: profile.estimated_hours,
                  default_linen_required: profile.default_linen_required,
                  default_laundry_required: profile.default_laundry_required,
                }))}
                defaultProfileId={defaultProfileId}
              />

              <section className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Date prévue
                  </label>
                  <input
                    type="date"
                    name="scheduled_date"
                    defaultValue={scheduledDate}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Heure prévue
                  </label>
                  <input
                    type="time"
                    name="scheduled_time"
                    defaultValue="14:00"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Deadline date
                  </label>
                  <input
                    type="date"
                    name="deadline_date"
                    defaultValue={defaultDeadlineDate}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    Deadline heure
                  </label>
                  <input
                    type="time"
                    name="deadline_time"
                    defaultValue={reservation ? "12:00" : "18:00"}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </div>
              </section>

              <div>
                <label className="block text-sm font-semibold text-slate-800">
                  Notes internes
                </label>
                <textarea
                  name="admin_notes"
                  rows={3}
                  placeholder="Instructions particulières, grand ménage, extérieur, contrôle..."
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-100">
                La mission sera créée avec le statut <strong>Créée</strong>.
                Elle sera ensuite proposée par SMS lors du prochain passage de
                l’automatisation.
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-950 px-4 py-4 font-bold text-white"
              >
                Créer la mission
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
