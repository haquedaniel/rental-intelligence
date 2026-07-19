import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import OwnerBottomNav, { OwnerTopNav } from "@/components/owner/OwnerBottomNav";

export const dynamic = "force-dynamic";
type Row = Record<string, any>;

function money(value: unknown) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function statusLabel(value: string) {
  return ({
    sent_to_owner: "À régler",
    overdue: "En retard",
    paid: "Payée",
    refused: "Refusée",
    cancelled: "Annulée",
    withdrawn: "Retirée",
  } as Record<string, string>)[value] || value;
}

export default async function OwnerOperationsPaymentsPage({
  params,
}: {
  params: Promise<{ ownerToken: string }>;
}) {
  const { ownerToken } = await params;
  const db = getSupabaseAdmin();
  const { data: owner } = await db
    .from("owners")
    .select("id")
    .eq("public_token", decodeURIComponent(ownerToken))
    .eq("active", true)
    .maybeSingle();
  if (!owner) notFound();

  const { data } = await db
    .from("monthly_payment_requests")
    .select("*")
    .eq("owner_id", owner.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as Row[];
  const pending = rows.filter((row) => ["sent_to_owner", "overdue"].includes(String(row.status)));
  const history = rows.filter((row) => !["sent_to_owner", "overdue"].includes(String(row.status)));
  const base = `/owner/${encodeURIComponent(ownerToken)}`;

  return (
    <main className="min-h-screen bg-[#F4F8FA] px-4 pb-28 pt-5 text-[#112532]">
      <div className="mx-auto max-w-5xl">
        <OwnerTopNav active="operations" />
        <div className="mt-8">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#E0680E]">Opérations</p>
          <h1 className="mt-1 text-3xl font-black">Demandes de paiement</h1>
          <p className="mt-2 text-sm font-bold text-[#112532]/55">Demandes à régler et historique, limitées à vos logements.</p>
        </div>

        <section className="mt-6 rounded-[1.7rem] bg-white p-5 ring-1 ring-[#112532]/8">
          <h2 className="text-xl font-black">À régler</h2>
          <div className="mt-4 space-y-3">
            {pending.length ? pending.map((row) => (
              <Link key={row.id} href={`/owner/payments/${row.public_token || row.token || row.id}`} className="flex items-center justify-between rounded-2xl bg-[#F4F8FA] p-4">
                <div><strong>{row.period_label || row.month || "Demande de paiement"}</strong><p className="mt-1 text-sm text-[#112532]/55">{statusLabel(String(row.status))}</p></div>
                <strong>{money(row.total_eur)}</strong>
              </Link>
            )) : <p className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800">Aucun paiement en attente.</p>}
          </div>
        </section>

        <section className="mt-5 rounded-[1.7rem] bg-white p-5 ring-1 ring-[#112532]/8">
          <h2 className="text-xl font-black">Historique</h2>
          <div className="mt-4 divide-y divide-[#112532]/8">
            {history.length ? history.map((row) => (
              <div key={row.id} className="flex items-center justify-between py-3">
                <div><strong>{row.period_label || row.month || "Paiement"}</strong><p className="text-sm text-[#112532]/55">{statusLabel(String(row.status))}</p></div>
                <strong>{money(row.total_eur)}</strong>
              </div>
            )) : <p className="text-sm font-bold text-[#112532]/45">Aucun historique pour le moment.</p>}
          </div>
        </section>

        <Link href={`${base}/operations`} className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black ring-1 ring-[#112532]/10">← Retour aux opérations</Link>
      </div>
      <OwnerBottomNav active="operations" />
    </main>
  );
}
