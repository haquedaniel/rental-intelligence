import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { deactivateAssignment, saveAssignment } from "./actions";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function fullName(cleaner?: Row) {
  if (!cleaner) return "Intervenante inconnue";
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ");
}

function roleLabel(role: string) {
  return role === "primary" ? "Principale" : "Remplaçante";
}

function roleBadgeClass(role: string) {
  return role === "primary"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-sky-100 text-sky-800";
}

export default async function CleanerAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ property?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const selectedPropertyId = params?.property ?? "";

  const supabase = getSupabaseAdmin();

  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id,name,address,preferred_cleaner_id")
    .order("name", { ascending: true });

  if (propertiesError) {
    throw new Error(`Impossible de charger les logements : ${propertiesError.message}`);
  }

  const { data: cleaners, error: cleanersError } = await supabase
    .from("cleaners")
    .select("id,first_name,last_name,phone,status,active,hourly_rate_eur")
    .order("first_name", { ascending: true });

  if (cleanersError) {
    throw new Error(`Impossible de charger les intervenantes : ${cleanersError.message}`);
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("property_cleaner_assignments")
    .select("*")
    .order("role", { ascending: false })
    .order("priority", { ascending: true });

  if (assignmentsError) {
    throw new Error(
      `Impossible de charger les affectations : ${assignmentsError.message}`,
    );
  }

  const propertyRows = properties ?? [];
  const cleanerRows = cleaners ?? [];
  const assignmentRows = assignments ?? [];

  const visibleProperties = selectedPropertyId
    ? propertyRows.filter((property) => property.id === selectedPropertyId)
    : propertyRows;

  const cleanerById = Object.fromEntries(
    cleanerRows.map((cleaner) => [cleaner.id, cleaner]),
  );

  const activeCleaners = cleanerRows.filter(
    (cleaner) => cleaner.active !== false && cleaner.status !== "inactive",
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Affectations ménage
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Définissez l’intervenante principale, les remplaçantes et le niveau
            de familiarité avec chaque logement.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-950">
            Filtrer par logement
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/cleaner-assignments"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                selectedPropertyId
                  ? "bg-slate-100 text-slate-700"
                  : "bg-slate-900 text-white"
              }`}
            >
              Tous
            </Link>

            {propertyRows.map((property) => (
              <Link
                key={property.id}
                href={`/admin/cleaner-assignments?property=${property.id}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  selectedPropertyId === property.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {property.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-950">
            Ajouter / modifier une affectation
          </h2>

          <form action={saveAssignment} className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Logement
              </label>
              <select
                name="property_id"
                required
                defaultValue={selectedPropertyId}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              >
                <option value="">Choisir un logement</option>
                {propertyRows.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Intervenante
              </label>
              <select
                name="cleaner_id"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              >
                <option value="">Choisir une intervenante</option>
                {activeCleaners.map((cleaner) => (
                  <option key={cleaner.id} value={cleaner.id}>
                    {fullName(cleaner)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Rôle
              </label>
              <select
                name="role"
                defaultValue="backup"
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              >
                <option value="primary">Principale</option>
                <option value="backup">Remplaçante</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Priorité
              </label>
              <input
                name="priority"
                type="number"
                defaultValue={2}
                min={1}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Distance trajet (km)
              </label>
              <input
                name="travel_distance_km"
                type="number"
                step="0.1"
                min={0}
                placeholder="Ex: 3.5"
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" name="familiar" defaultChecked />
              Connaît déjà le logement
            </label>

            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked />
              Affectation active
            </label>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-800">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                placeholder="Ex: connaît le coffre à clés, préfère ce logement, éviter en haute saison..."
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
              >
                Enregistrer l’affectation
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-5">
          {visibleProperties.map((property) => {
            const propertyAssignments = assignmentRows
              .filter((assignment) => assignment.property_id === property.id)
              .sort((a, b) => {
                if (a.role === b.role) {
                  return Number(a.priority ?? 99) - Number(b.priority ?? 99);
                }
                return a.role === "primary" ? -1 : 1;
              });

            const activePrimary = propertyAssignments.find(
              (assignment) =>
                assignment.role === "primary" && assignment.active === true,
            );

            return (
              <div
                key={property.id}
                className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      {property.name}
                    </h2>

                    {property.address && (
                      <p className="mt-1 text-sm text-slate-500">
                        {property.address}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <p className="font-semibold text-slate-700">
                      Principale actuelle
                    </p>
                    <p className="mt-1 text-slate-950">
                      {activePrimary
                        ? fullName(cleanerById[activePrimary.cleaner_id])
                        : "Aucune"}
                    </p>
                  </div>
                </div>

                {propertyAssignments.length === 0 ? (
                  <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                    Aucune affectation pour ce logement.
                  </p>
                ) : (
                  <div className="mt-5 space-y-4">
                    {propertyAssignments.map((assignment) => {
                      const cleaner = cleanerById[assignment.cleaner_id];

                      return (
                        <div
                          key={assignment.id}
                          className={`rounded-2xl border p-4 ${
                            assignment.active
                              ? "border-slate-200"
                              : "border-red-100 bg-red-50/40 opacity-70"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="mr-2 text-lg font-bold text-slate-950">
                              {fullName(cleaner)}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClass(
                                assignment.role,
                              )}`}
                            >
                              {roleLabel(assignment.role)}
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              Priorité {assignment.priority}
                            </span>

                            {assignment.travel_distance_km !== null &&
                              assignment.travel_distance_km !== undefined && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {assignment.travel_distance_km} km
                                </span>
                              )}

                            {assignment.familiar && (
                              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                                Connaît le logement
                              </span>
                            )}

                            {!assignment.active && (
                              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                                Désactivée
                              </span>
                            )}
                          </div>

                          <form
                            action={saveAssignment}
                            className="mt-4 grid gap-3 md:grid-cols-4"
                          >
                            <input
                              type="hidden"
                              name="property_id"
                              value={property.id}
                            />
                            <input
                              type="hidden"
                              name="cleaner_id"
                              value={assignment.cleaner_id}
                            />

                            <div>
                              <label className="block text-xs font-semibold text-slate-700">
                                Rôle
                              </label>
                              <select
                                name="role"
                                defaultValue={assignment.role}
                                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                              >
                                <option value="primary">Principale</option>
                                <option value="backup">Remplaçante</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700">
                                Priorité
                              </label>
                              <input
                                name="priority"
                                type="number"
                                min={1}
                                defaultValue={assignment.priority}
                                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700">
                                Distance trajet (km)
                              </label>
                              <input
                                name="travel_distance_km"
                                type="number"
                                step="0.1"
                                min={0}
                                defaultValue={assignment.travel_distance_km ?? ""}
                                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                              />
                            </div>

                            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                name="familiar"
                                defaultChecked={assignment.familiar}
                              />
                              Familiarité
                            </label>

                            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                name="active"
                                defaultChecked={assignment.active}
                              />
                              Active
                            </label>

                            <div className="md:col-span-4">
                              <label className="block text-xs font-semibold text-slate-700">
                                Notes
                              </label>
                              <textarea
                                name="notes"
                                rows={2}
                                defaultValue={assignment.notes ?? ""}
                                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                              />
                            </div>

                            <div className="flex gap-2 md:col-span-4">
                              <button
                                type="submit"
                                className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                              >
                                Enregistrer
                              </button>
                            </div>
                          </form>

                          <form action={deactivateAssignment} className="mt-2">
                            <input
                              type="hidden"
                              name="assignment_id"
                              value={assignment.id}
                            />
                            <input
                              type="hidden"
                              name="property_id"
                              value={property.id}
                            />
                            <button
                              type="submit"
                              className="text-sm font-semibold text-red-700"
                            >
                              Désactiver cette affectation
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
