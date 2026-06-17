import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";


import type { Metadata } from "next";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  return {
    title: "Pilotys",
    applicationName: "Pilotys",
    manifest: `/cleaner/${token}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: "Pilotys",
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        {
          url: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: "/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
  };
}


export const dynamic = "force-dynamic";

const PARIS_TZ = "Europe/Paris";

type Row = Record<string, any>;

function fullName(cleaner: Row) {
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ");
}

function isDateKey(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function dateAtNoonUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function dateKeyFromUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = dateAtNoonUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyFromUtcDate(date);
}

function startOfWeek(dateKey: string): string {
  const date = dateAtNoonUtc(dateKey);
  const day = date.getUTCDay(); // 0 Sunday, 1 Monday
  const diffToMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return dateKeyFromUtcDate(date);
}

function startOfMonth(dateKey: string): string {
  const date = dateAtNoonUtc(dateKey);
  return dateKeyFromUtcDate(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12, 0, 0)),
  );
}

function endOfMonth(dateKey: string): string {
  const date = dateAtNoonUtc(dateKey);
  return dateKeyFromUtcDate(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12, 0, 0)),
  );
}

function monthGridDays(dateKey: string): string[] {
  const gridStart = startOfWeek(startOfMonth(dateKey));
  const gridEnd = addDays(startOfWeek(endOfMonth(dateKey)), 6);

  const days: string[] = [];
  let current = gridStart;

  while (current <= gridEnd) {
    days.push(current);
    current = addDays(current, 1);
  }

  return days;
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

function todayParisDateKey(): string {
  return parisDateKey(new Date());
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shortDayName(dateKey: string): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: PARIS_TZ,
      weekday: "short",
    })
      .format(dateAtNoonUtc(dateKey))
      .replace(".", ""),
  );
}

function longDateLabel(dateKey: string): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: PARIS_TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dateAtNoonUtc(dateKey)),
  );
}

function monthLabel(dateKey: string): string {
  return capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: PARIS_TZ,
      month: "long",
      year: "numeric",
    }).format(dateAtNoonUtc(dateKey)),
  );
}

function timeLabel(iso?: string | null): string {
  if (!iso) return "Heure à confirmer";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(":", "h");
}

function euro(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") {
    return "Montant à confirmer";
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return "Montant à confirmer";
  }

  return `${numberValue.toFixed(2)} €`;
}

function statusLabel(status?: string): string {
  switch (status) {
    case "created":
      return "À envoyer";
    case "sent":
      return "Proposée";
    case "accepted":
      return "Acceptée";
    case "refused":
      return "Refusée";
    case "report_submitted":
      return "Rapport envoyé";
    case "completed":
      return "Terminée";
    case "problem_reported":
      return "Problème signalé";
    case "cancelled":
      return "Annulée";
    default:
      return status || "À confirmer";
  }
}

function statusClasses(status?: string): string {
  switch (status) {
    case "sent":
    case "created":
      return "bg-sky-100 text-sky-800";
    case "accepted":
      return "bg-emerald-100 text-emerald-800";
    case "report_submitted":
    case "completed":
      return "bg-slate-900 text-white";
    case "problem_reported":
      return "bg-orange-100 text-orange-900";
    case "refused":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function dayAccentClasses(statuses: string[]): string {
  if (statuses.includes("problem_reported")) {
    return "ring-orange-300 bg-orange-50";
  }

  if (statuses.includes("accepted")) {
    return "ring-emerald-300 bg-emerald-50";
  }

  if (statuses.includes("sent") || statuses.includes("created")) {
    return "ring-sky-300 bg-sky-50";
  }

  if (statuses.includes("report_submitted") || statuses.includes("completed")) {
    return "ring-slate-300 bg-slate-100";
  }

  return "ring-slate-200 bg-white";
}

function missionDayKey(mission: Row): string {
  return parisDateKey(mission.scheduled_start_at);
}

function missionActionHref(mission: Row): string {
  if (mission.status === "accepted") {
    return `/mission/${mission.public_token}/report`;
  }

  return `/mission/${mission.public_token}`;
}

function missionActionLabel(mission: Row): string {
  if (mission.status === "accepted") {
    return "Démarrer le rapport";
  }

  if (mission.status === "report_submitted" || mission.status === "completed") {
    return "Voir la mission";
  }

  return "Ouvrir la mission";
}

export default async function CleanerCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ day?: string }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;

  const supabase = getSupabaseAdmin();

  const { data: cleaner, error: cleanerError } = await supabase
    .from("cleaners")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (cleanerError) {
    throw new Error(`Impossible de charger le planning : ${cleanerError.message}`);
  }

  if (!cleaner) {
    notFound();
  }

  const selectedDay = isDateKey(resolvedSearchParams?.day)
    ? resolvedSearchParams.day
    : todayParisDateKey();

  const weekStart = startOfWeek(selectedDay);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const previousWeekDay = addDays(selectedDay, -7);
  const nextWeekDay = addDays(selectedDay, 7);
  const monthDays = monthGridDays(selectedDay);
  const selectedMonth = selectedDay.slice(0, 7);

  const { data: requestRows, error: requestError } = await supabase
    .from("cleaning_requests")
    .select(
      "id,property_id,reservation_id,status,scheduled_start_at,scheduled_end_at,urgent,total_cost_eur,public_token,number_of_guests,linen_required,laundry_required",
    )
    .eq("assigned_cleaner_id", cleaner.id)
    .neq("status", "cancelled")
    .order("scheduled_start_at", { ascending: true })
    .limit(300);

  if (requestError) {
    throw new Error(`Impossible de charger les missions : ${requestError.message}`);
  }

  const missions = requestRows ?? [];

  const propertyIds = Array.from(
    new Set(missions.map((mission) => mission.property_id).filter(Boolean)),
  );

  let propertyById: Record<string, Row> = {};

  if (propertyIds.length > 0) {
    const { data: propertyRows, error: propertiesError } = await supabase
      .from("properties")
      .select("id,name,address")
      .in("id", propertyIds);

    if (propertiesError) {
      throw new Error(`Impossible de charger les logements : ${propertiesError.message}`);
    }

    propertyById = Object.fromEntries((propertyRows ?? []).map((row) => [row.id, row]));
  }

  const missionsByDay: Record<string, Row[]> = {};

  for (const mission of missions) {
    if (!mission.scheduled_start_at) continue;

    const dayKey = missionDayKey(mission);

    missionsByDay[dayKey] = missionsByDay[dayKey] ?? [];
    missionsByDay[dayKey].push(mission);
  }

  const selectedMissions = missionsByDay[selectedDay] ?? [];
  const weekMissionCount = weekDays.reduce(
    (total, dayKey) => total + (missionsByDay[dayKey]?.length ?? 0),
    0,
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-sm text-slate-300">Planning ménage</p>
          <h1 className="mt-1 text-2xl font-bold">
            Bonjour {cleaner.first_name || fullName(cleaner)}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {weekMissionCount} mission(s) cette semaine · {selectedMissions.length} le jour sélectionné
          </p>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/cleaner/${token}?day=${previousWeekDay}`}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              ←
            </Link>

            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500">Semaine</p>
              <h2 className="text-lg font-bold text-slate-950">
                {longDateLabel(weekStart)} → {longDateLabel(addDays(weekStart, 6))}
              </h2>
            </div>

            <Link
              href={`/cleaner/${token}?day=${nextWeekDay}`}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {weekDays.map((dayKey) => {
              const dayMissions = missionsByDay[dayKey] ?? [];
              const statuses = dayMissions.map((mission) => mission.status);
              const selected = dayKey === selectedDay;
              const today = dayKey === todayParisDateKey();

              return (
                <Link
                  key={dayKey}
                  href={`/cleaner/${token}?day=${dayKey}`}
                  className={`rounded-2xl p-2 text-center ring-1 transition ${
                    selected
                      ? "bg-slate-950 text-white ring-slate-950"
                      : dayAccentClasses(statuses)
                  }`}
                >
                  <p className={`text-[11px] font-semibold ${selected ? "text-slate-200" : "text-slate-500"}`}>
                    {shortDayName(dayKey)}
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {Number(dayKey.slice(8, 10))}
                  </p>
                  <div className="mt-1 flex min-h-4 justify-center gap-0.5">
                    {dayMissions.length === 0 ? (
                      today && !selected ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      ) : null
                    ) : (
                      dayMissions.slice(0, 3).map((mission) => (
                        <span
                          key={mission.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            selected
                              ? "bg-white"
                              : mission.status === "accepted"
                                ? "bg-emerald-500"
                                : mission.status === "problem_reported"
                                  ? "bg-orange-500"
                                  : mission.status === "sent" || mission.status === "created"
                                    ? "bg-sky-500"
                                    : "bg-slate-700"
                          }`}
                        />
                      ))
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">
              {monthLabel(selectedDay)}
            </h2>
            <Link
              href={`/cleaner/${token}?day=${todayParisDateKey()}`}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Aujourd’hui
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {["L", "M", "M", "J", "V", "S", "D"].map((label, index) => (
              <p key={`${label}-${index}`} className="text-xs font-bold text-slate-400">
                {label}
              </p>
            ))}

            {monthDays.map((dayKey) => {
              const dayMissions = missionsByDay[dayKey] ?? [];
              const inMonth = dayKey.startsWith(selectedMonth);
              const selected = dayKey === selectedDay;

              return (
                <Link
                  key={dayKey}
                  href={`/cleaner/${token}?day=${dayKey}`}
                  className={`relative rounded-xl py-2 text-sm font-semibold ${
                    selected
                      ? "bg-slate-950 text-white"
                      : inMonth
                        ? "bg-slate-50 text-slate-800"
                        : "bg-white text-slate-300"
                  }`}
                >
                  {Number(dayKey.slice(8, 10))}

                  {dayMissions.length > 0 && (
                    <span
                      className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                        selected ? "bg-white" : "bg-sky-500"
                      }`}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-950">
            {longDateLabel(selectedDay)}
          </h2>

          {selectedMissions.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-center">
              <p className="text-3xl">🌿</p>
              <p className="mt-2 font-semibold text-slate-800">
                Aucune mission prévue
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Profitez de votre journée.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {selectedMissions.map((mission) => {
                const property = propertyById[mission.property_id];

                return (
                  <article
                    key={mission.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-500">
                          {timeLabel(mission.scheduled_start_at)}
                          {mission.scheduled_end_at &&
                            ` → ${timeLabel(mission.scheduled_end_at)}`}
                        </p>

                        <h3 className="mt-1 text-xl font-bold text-slate-950">
                          {property?.name ?? "Logement"}
                        </h3>

                        {property?.address && (
                          <p className="mt-1 text-sm text-slate-500">
                            {property.address}
                          </p>
                        )}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                          mission.status,
                        )}`}
                      >
                        {statusLabel(mission.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Montant
                        </p>
                        <p className="mt-1 font-bold text-slate-950">
                          {euro(mission.total_cost_eur)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Voyageurs
                        </p>
                        <p className="mt-1 font-bold text-slate-950">
                          {mission.number_of_guests ?? "-"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Linge
                        </p>
                        <p className="mt-1 font-bold text-slate-950">
                          {mission.linen_required ? "Oui" : "Non"}
                        </p>
                      </div>
                    </div>

                    {mission.urgent && (
                      <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm font-semibold text-orange-900">
                        Mission urgente
                      </p>
                    )}

                    <Link
                      href={missionActionHref(mission)}
                      className="mt-4 block rounded-2xl bg-slate-900 px-4 py-3 text-center font-semibold text-white"
                    >
                      {missionActionLabel(mission)}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
