import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import OwnerBottomNav from "@/components/owner/OwnerBottomNav";

export const dynamic = "force-dynamic";

const PARIS_TZ = "Europe/Paris";

type Row = Record<string, any>;

function money(value: unknown): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function compactDate(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function monthLabel(start?: string | null): string {
  if (!start) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${start}T12:00:00.000Z`));
}

function fullName(row?: Row | null): string {
  if (!row) return "Intervenante";
  return (
    row.trading_name ||
    row.legal_name ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    row.name ||
    "Intervenante"
  );
}

function ownerName(row?: Row | null): string {
  if (!row) return "Propriétaire";
  return row.display_name || row.legal_name || row.name || "Propriétaire";
}

function isPastDue(request: Row): boolean {
  if (!["sent_to_owner", "overdue"].includes(String(request.status))) return false;
  if (!request.due_at) return false;

  const due = new Date(request.due_at);
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now();
}

function displayStatus(request: Row): string {
  if (isPastDue(request)) return "En retard";

  switch (request.status) {
    case "sent_to_owner":
      return "À régler";
    case "paid":
      return "Payée";
    case "refused":
      return "Refusée";
    case "overdue":
      return "En retard";
    case "cancelled":
    case "withdrawn":
      return "Annulée";
    case "draft":
      return "Brouillon";
    default:
      return request.status || "—";
  }
}

function statusClass(request: Row): string {
  const status = String(request.status);

  if (isPastDue(request) || status === "overdue") {
    return "bg-red-100 text-red-800 ring-red-200";
  }

  if (status === "paid") {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }

  if (status === "refused") {
    return "bg-slate-200 text-slate-700 ring-slate-300";
  }

  if (status === "sent_to_owner") {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function matchesFilter(request: Row, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "action") return ["sent_to_owner", "overdue"].includes(String(request.status));
  if (filter === "overdue") return isPastDue(request) || request.status === "overdue";
  return request.status === filter;
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
          : "rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200"
      }
    >
      {children}
    </Link>
  );
}

export default async function OwnerPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireAdmin();

  const query = await searchParams;
  const filter = query?.status || "action";

  const supabase = getSupabaseAdmin();

  const { data: paymentRequests, error } = await supabase
    .from("monthly_payment_requests")
    .select("*")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Impossible de charger les demandes de paiement : ${error.message}`);
  }

  const requests = (paymentRequests ?? []) as Row[];

  const cleanerIds = Array.from(
    new Set(requests.map((request) => request.cleaner_id).filter(Boolean).map(String)),
  );

  const ownerIds = Array.from(
    new Set(requests.map((request) => request.owner_id).filter(Boolean).map(String)),
  );

  const [{ data: cleaners }, { data: owners }] = await Promise.all([
    cleanerIds.length
      ? supabase.from("cleaners").select("*").in("id", cleanerIds)
      : Promise.resolve({ data: [] as Row[] }),
    ownerIds.length
      ? supabase.from("owners").select("*").in("id", ownerIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  const cleanerById = new Map((cleaners ?? []).map((cleaner: Row) => [String(cleaner.id), cleaner]));
  const ownerById = new Map((owners ?? []).map((owner: Row) => [String(owner.id), owner]));

  const visible = requests.filter((request) => matchesFilter(request, filter));

  const actionCount = requests.filter((request) =>
    ["sent_to_owner", "overdue"].includes(String(request.status)),
  ).length;

  const overdueCount = requests.filter((request) => isPastDue(request) || request.status === "overdue").length;

  const paidCount = requests.filter((request) => request.status === "paid").length;
  const refusedCount = requests.filter((request) => request.status === "refused").length;

  const actionTotal = requests
    .filter((request) => ["sent_to_owner", "overdue"].includes(String(request.status)))
    .reduce((sum, request) => sum + Number(request.total_eur ?? 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/owner/cockpit" className="text-sm font-semibold text-slate-600">
              ← Cockpit propriétaire
            </Link>

            <h1 className="mt-5 text-3xl font-black text-slate-950">
              Demandes de paiement
            </h1>

            <p className="mt-2 max-w-2xl text-slate-600">
              Suivi des demandes mensuelles envoyées par les intervenantes.
              Vous pouvez ouvrir chaque demande, l’imprimer pour la comptabilité,
              la marquer comme payée ou la refuser avec un motif.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm font-semibold text-slate-400">À traiter</p>
            <p className="mt-1 text-3xl font-black">{money(actionTotal)}</p>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              {actionCount} demande(s)
            </p>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">À régler</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{actionCount}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">En retard</p>
            <p className="mt-2 text-3xl font-black text-red-700">{overdueCount}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">Payées</p>
            <p className="mt-2 text-3xl font-black text-emerald-700">{paidCount}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">Refusées</p>
            <p className="mt-2 text-3xl font-black text-slate-700">{refusedCount}</p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <FilterLink href="/owner/payments?status=action" active={filter === "action"}>
            À traiter
          </FilterLink>
          <FilterLink href="/owner/payments?status=overdue" active={filter === "overdue"}>
            En retard
          </FilterLink>
          <FilterLink href="/owner/payments?status=paid" active={filter === "paid"}>
            Payées
          </FilterLink>
          <FilterLink href="/owner/payments?status=refused" active={filter === "refused"}>
            Refusées
          </FilterLink>
          <FilterLink href="/owner/payments?status=all" active={filter === "all"}>
            Toutes
          </FilterLink>
        </div>

        {visible.length === 0 ? (
          <section className="rounded-3xl bg-white p-8 text-slate-600 shadow-sm ring-1 ring-slate-200">
            Aucune demande dans cette catégorie.
          </section>
        ) : (
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="hidden grid-cols-[1.3fr_1fr_1fr_120px_150px] gap-4 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-400 md:grid">
              <div>Intervenante</div>
              <div>Propriétaire</div>
              <div>Période</div>
              <div className="text-right">Montant</div>
              <div className="text-right">Statut</div>
            </div>

            <div className="divide-y divide-slate-100">
              {visible.map((request) => {
                const cleaner = cleanerById.get(String(request.cleaner_id));
                const owner = ownerById.get(String(request.owner_id));

                return (
                  <Link
                    key={request.id}
                    href={`/owner/payments/${request.public_token}`}
                    className="block px-5 py-4 hover:bg-slate-50"
                  >
                    <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_120px_150px] md:items-center">
                      <div>
                        <p className="font-black text-slate-950">
                          {request.cleaner_name_snapshot || fullName(cleaner)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          Envoyée le {compactDate(request.sent_at || request.created_at)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {request.owner_recipient_name || ownerName(owner)}
                        </p>
                        {request.owner_recipient_phone && (
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {request.owner_recipient_phone}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {monthLabel(request.period_start)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          Échéance {compactDate(request.due_at)}
                        </p>
                      </div>

                      <div className="md:text-right">
                        <p className="text-lg font-black text-slate-950">
                          {money(request.total_eur)}
                        </p>
                      </div>

                      <div className="md:text-right">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(request)}`}>
                          {displayStatus(request)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
          <OwnerBottomNav active="payments" />
    </main>
  );
}
