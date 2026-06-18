
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendMonthlyPaymentRequest } from "./actions";

export const dynamic = "force-dynamic";

const PARIS_TZ = "Europe/Paris";

type Row = Record<string, any>;

function money(value: unknown): string {
  return `${Number(value ?? 0).toFixed(2)} €`;
}

function currentPeriod(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
}

function previousPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0, 12, 0, 0));

  return {
    startKey: `${year}-${String(month).padStart(2, "0")}-01`,
    endKey: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
  };
}

function monthLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
}

function dateLabel(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function dateKey(value: string): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function statusLabel(status?: string): string {
  switch (status) {
    case "sent_to_owner":
      return "Envoyée";
    case "paid":
      return "Payée";
    case "overdue":
      return "En retard";
    case "cancelled":
      return "Annulée";
    default:
      return "Brouillon";
  }
}

export default async function CleanerPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ period?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  const period = query?.period || currentPeriod();
  const { startKey, endKey } = monthBounds(period);

  const supabase = getSupabaseAdmin();

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!cleaner) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-950">Lien invalide</h1>
          <p className="mt-2 text-slate-600">Impossible de trouver votre profil.</p>
        </div>
      </main>
    );
  }

  const { data: missions } = await supabase
    .from("cleaning_requests")
    .select("*, properties:property_id(id,name,owner_id)")
    .eq("assigned_cleaner_id", cleaner.id)
    .in("status", ["report_submitted", "completed", "problem_reported"])
    .gte("scheduled_start_at", `${startKey}T00:00:00.000Z`)
    .lte("scheduled_start_at", `${endKey}T23:59:59.999Z`)
    .order("scheduled_start_at", { ascending: true });

  const { data: extras } = await supabase
    .from("cleaning_request_extras")
    .select("*, properties:property_id(id,name,owner_id), cleaning_requests:cleaning_request_id(scheduled_start_at,title,service_type)")
    .eq("cleaner_id", cleaner.id)
    .in("status", ["pending_owner_review", "approved"])
    .order("created_at", { ascending: true });

  const ownerIds = Array.from(
    new Set([
      ...((missions ?? []).map((mission) => mission.properties?.owner_id).filter(Boolean)),
      ...((extras ?? []).map((extra) => extra.properties?.owner_id).filter(Boolean)),
    ]),
  );

  const { data: owners } = ownerIds.length
    ? await supabase.from("owners").select("*").in("id", ownerIds)
    : { data: [] as Row[] };

  const { data: existingRequests } = await supabase
    .from("monthly_payment_requests")
    .select("*")
    .eq("cleaner_id", cleaner.id)
    .eq("period_start", startKey)
    .eq("period_end", endKey);

  const ownersById = new Map((owners ?? []).map((owner) => [owner.id, owner]));
  const existingByOwnerId = new Map((existingRequests ?? []).map((request) => [request.owner_id, request]));

  const groups = ownerIds.map((ownerId) => {
    const missionRows = (missions ?? []).filter(
      (mission) => mission.properties?.owner_id === ownerId,
    );

    const extraRows = (extras ?? []).filter((extra) => {
      const workDate = extra.cleaning_requests?.scheduled_start_at ?? extra.created_at;
      const workKey = dateKey(workDate);
      return extra.properties?.owner_id === ownerId && workKey >= startKey && workKey <= endKey;
    });

    const baseTotal = missionRows.reduce(
      (sum, mission) => sum + Number(mission.total_cost_eur ?? 0),
      0,
    );

    const extrasTotal = extraRows.reduce(
      (sum, extra) => sum + Number(extra.amount_eur ?? 0),
      0,
    );

    return {
      ownerId,
      owner: ownersById.get(ownerId),
      missions: missionRows,
      extras: extraRows,
      baseTotal,
      extrasTotal,
      total: baseTotal + extrasTotal,
      paymentRequest: existingByOwnerId.get(ownerId),
    };
  });

  const grandTotal = groups.reduce((sum, group) => sum + group.total, 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href={`/cleaner/${token}`} className="text-sm font-semibold text-slate-600">
            ← Mon planning
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-slate-950">
            Mes paiements
          </h1>

          <p className="mt-2 text-slate-600">
            Vos missions terminées sont regroupées par propriétaire. Vous envoyez vous-même la demande mensuelle.
          </p>
        </div>

        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {monthLabel(period)}
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-slate-300">Propriétaires</p>
              <p className="text-3xl font-bold">{groups.length}</p>
            </div>

            <div>
              <p className="text-sm text-slate-300">Missions</p>
              <p className="text-3xl font-bold">
                {groups.reduce((sum, group) => sum + group.missions.length, 0)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-300">Total estimé</p>
              <p className="text-3xl font-bold">{money(grandTotal)}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/cleaner/${token}/payments?period=${previousPeriod(period)}`}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white"
            >
              ← Mois précédent
            </Link>

            <Link
              href={`/cleaner/${token}/payments?period=${nextPeriod(period)}`}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white"
            >
              Mois suivant →
            </Link>
          </div>
        </section>

        {groups.length === 0 && (
          <section className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-slate-200">
            Aucune mission terminée sur cette période.
          </section>
        )}

        {groups.map((group) => {
          const ownerName =
            group.owner?.display_name ||
            group.owner?.legal_name ||
            "Propriétaire";

          const alreadySent = group.paymentRequest && group.paymentRequest.status !== "draft";

          return (
            <section key={group.ownerId} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">
                    {ownerName}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {group.missions.length} mission(s) · {group.extras.length} supplément(s)
                  </p>

                  {group.paymentRequest && (
                    <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {statusLabel(group.paymentRequest.status)}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-3xl font-black text-slate-950">
                    {money(group.total)}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {group.missions.map((mission) => (
                  <div key={mission.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">
                          {mission.title || "Mission"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {dateLabel(mission.scheduled_start_at)} · {mission.properties?.name}
                        </p>
                      </div>
                      <p className="font-black text-slate-950">{money(mission.total_cost_eur)}</p>
                    </div>
                  </div>
                ))}

                {group.extras.map((extra) => (
                  <div key={extra.id} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-amber-950">
                          Supplément exceptionnel
                        </p>
                        <p className="text-sm text-amber-900">
                          {extra.reason}
                        </p>
                      </div>
                      <p className="font-black text-amber-950">{money(extra.amount_eur)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {!alreadySent && (
                <form action={sendMonthlyPaymentRequest} className="mt-5 space-y-4">
                  <input type="hidden" name="cleaner_token" value={token} />
                  <input type="hidden" name="owner_id" value={group.ownerId} />
                  <input type="hidden" name="period" value={period} />

                  <textarea
                    name="cleaner_message"
                    rows={3}
                    placeholder="Message optionnel au propriétaire"
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />

                  <button className="w-full rounded-2xl bg-slate-950 px-4 py-4 font-bold text-white">
                    Envoyer la demande à {ownerName}
                  </button>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
