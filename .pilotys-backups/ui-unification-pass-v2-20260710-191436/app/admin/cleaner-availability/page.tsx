import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import {
  addUnavailabilityPeriod,
  deleteUnavailabilityPeriod,
  saveWeeklyAvailability,
} from "./actions";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

const WEEKDAYS = [
  [1, "Lundi"],
  [2, "Mardi"],
  [3, "Mercredi"],
  [4, "Jeudi"],
  [5, "Vendredi"],
  [6, "Samedi"],
  [7, "Dimanche"],
];

function fullName(cleaner: Row) {
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ");
}

function statusBadgeClass(status?: string) {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "temporarily_unavailable") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-red-100 text-red-800";
}

function statusLabel(status?: string) {
  if (status === "temporarily_unavailable") return "Temporairement indisponible";
  if (status === "inactive") return "Inactive";
  return "Active";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function CleanerAvailabilityPage({
  searchParams,
}: {
  searchParams?: Promise<{ cleaner?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const selectedCleanerId = params?.cleaner ?? "";

  const supabase = getSupabaseAdmin();

  const { data: cleaners, error: cleanersError } = await supabase
    .from("cleaners")
    .select("id,first_name,last_name,phone,status,active")
    .order("first_name", { ascending: true });

  if (cleanersError) {
    throw new Error(`Impossible de charger les intervenantes : ${cleanersError.message}`);
  }

  const { data: weeklyRows, error: weeklyError } = await supabase
    .from("cleaner_weekly_availability")
    .select("*")
    .order("weekday", { ascending: true });

  if (weeklyError) {
    throw new Error(`Impossible de charger les disponibilités : ${weeklyError.message}`);
  }

  const { data: periodRows, error: periodsError } = await supabase
    .from("cleaner_unavailability_periods")
    .select("*")
    .order("starts_on", { ascending: true });

  if (periodsError) {
    throw new Error(`Impossible de charger les indisponibilités : ${periodsError.message}`);
  }

  const cleanerRows = cleaners ?? [];
  const weeklyAvailability = weeklyRows ?? [];
  const periods = periodRows ?? [];

  const visibleCleaners = selectedCleanerId
    ? cleanerRows.filter((cleaner) => cleaner.id === selectedCleanerId)
    : cleanerRows;

  const today = todayIsoDate();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Disponibilités ménage
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Gérez les disponibilités hebdomadaires et les périodes d’absence.
            Ces données serviront à choisir automatiquement l’intervenante
            disponible.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-950">
            Filtrer par intervenante
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/cleaner-availability"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                selectedCleanerId
                  ? "bg-slate-100 text-slate-700"
                  : "bg-slate-900 text-white"
              }`}
            >
              Toutes
            </Link>

            {cleanerRows.map((cleaner) => (
              <Link
                key={cleaner.id}
                href={`/admin/cleaner-availability?cleaner=${cleaner.id}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  selectedCleanerId === cleaner.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {fullName(cleaner)}
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {visibleCleaners.map((cleaner) => {
            const cleanerWeeklyRows = weeklyAvailability.filter(
              (row) => row.cleaner_id === cleaner.id,
            );

            const cleanerPeriods = periods.filter(
              (period) => period.cleaner_id === cleaner.id,
            );

            const futurePeriods = cleanerPeriods.filter(
              (period) => period.ends_on >= today,
            );

            const rowByWeekday = Object.fromEntries(
              cleanerWeeklyRows.map((row) => [row.weekday, row]),
            );

            const availableDayCount = WEEKDAYS.filter(([weekday]) => {
              const row = rowByWeekday[weekday];
              return row ? row.available : true;
            }).length;

            return (
              <div
                key={cleaner.id}
                className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-950">
                        {fullName(cleaner)}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                          cleaner.status,
                        )}`}
                      >
                        {statusLabel(cleaner.status)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {availableDayCount}/7 jour(s) disponibles par semaine ·{" "}
                      {futurePeriods.length} indisponibilité(s) à venir
                    </p>
                  </div>

                  {cleaner.phone && (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      {cleaner.phone}
                    </p>
                  )}
                </div>

                <form action={saveWeeklyAvailability} className="mt-6">
                  <input type="hidden" name="cleaner_id" value={cleaner.id} />

                  <h3 className="text-base font-bold text-slate-950">
                    Disponibilité récurrente
                  </h3>

                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                    {WEEKDAYS.map(([weekday, label]) => {
                      const row = rowByWeekday[weekday];
                      const available = row ? row.available : true;

                      return (
                        <div
                          key={weekday}
                          className="grid gap-3 border-b border-slate-100 p-3 last:border-b-0 md:grid-cols-[150px_140px_140px_1fr]"
                        >
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <input
                              type="checkbox"
                              name={`available_${weekday}`}
                              defaultChecked={available}
                            />
                            {label}
                          </label>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600">
                              Début
                            </label>
                            <input
                              type="time"
                              name={`start_time_${weekday}`}
                              defaultValue={row?.start_time?.slice(0, 5) ?? ""}
                              className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600">
                              Fin
                            </label>
                            <input
                              type="time"
                              name={`end_time_${weekday}`}
                              defaultValue={row?.end_time?.slice(0, 5) ?? ""}
                              className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600">
                              Note
                            </label>
                            <input
                              name={`notes_${weekday}`}
                              defaultValue={row?.notes ?? ""}
                              placeholder="optionnel"
                              className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="submit"
                    className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
                  >
                    Enregistrer la semaine type
                  </button>
                </form>

                <div className="mt-8 grid gap-5 md:grid-cols-[1fr_1fr]">
                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-base font-bold text-slate-950">
                      Ajouter une indisponibilité
                    </h3>

                    <form action={addUnavailabilityPeriod} className="mt-4 space-y-3">
                      <input type="hidden" name="cleaner_id" value={cleaner.id} />

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-semibold text-slate-800">
                            Début
                          </label>
                          <input
                            type="date"
                            name="starts_on"
                            required
                            className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-800">
                            Fin
                          </label>
                          <input
                            type="date"
                            name="ends_on"
                            className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-800">
                          Raison
                        </label>
                        <input
                          name="reason"
                          placeholder="Vacances, rendez-vous, indisponible..."
                          className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Ajouter
                      </button>
                    </form>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-base font-bold text-slate-950">
                      Indisponibilités
                    </h3>

                    {cleanerPeriods.length === 0 ? (
                      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                        Aucune période renseignée.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {cleanerPeriods.map((period) => (
                          <div
                            key={period.id}
                            className={`rounded-xl border p-3 ${
                              period.ends_on < today
                                ? "border-slate-100 bg-slate-50 opacity-60"
                                : "border-amber-200 bg-amber-50"
                            }`}
                          >
                            <p className="font-semibold text-slate-950">
                              {period.starts_on}
                              {period.ends_on !== period.starts_on &&
                                ` → ${period.ends_on}`}
                            </p>

                            {period.reason && (
                              <p className="mt-1 text-sm text-slate-600">
                                {period.reason}
                              </p>
                            )}

                            <form
                              action={deleteUnavailabilityPeriod}
                              className="mt-2"
                            >
                              <input
                                type="hidden"
                                name="period_id"
                                value={period.id}
                              />
                              <input
                                type="hidden"
                                name="cleaner_id"
                                value={cleaner.id}
                              />
                              <button
                                type="submit"
                                className="text-sm font-semibold text-red-700"
                              >
                                Supprimer
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
