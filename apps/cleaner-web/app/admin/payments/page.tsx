
import Link from "next/link";
import OwnerBottomNav from "@/components/owner/OwnerBottomNav";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { markPaymentPaid } from "./actions";

export const dynamic = "force-dynamic";

function money(value: unknown): string {
  return `${Number(value ?? 0).toFixed(2)} €`;
}

function statusLabel(status?: string): string {
  switch (status) {
    case "sent_to_owner":
      return "À payer";
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

function dateLabel(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminPaymentsPage() {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const { data: requests, error } = await supabase
    .from("monthly_payment_requests")
    .select(`
      *,
      cleaners:cleaner_id(first_name,last_name,worker_type),
      owners:owner_id(display_name,legal_name,phone,billing_email)
    `)
    .order("period_start", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossible de charger les paiements : ${error.message}`);
  }

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-4 pb-28 pt-6 text-[#112532]">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8"><span className="h-2 w-2 rounded-full bg-[#E0680E]" />Pilotys · opération</div>
        <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-black text-[#112532]/60 ring-1 ring-[#112532]/8">
            ← Back office
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-[#112532]">
            Demandes de paiement
          </h1>

          <p className="mt-2 text-[#112532]/60">
            Demandes envoyées par les intervenantes aux propriétaires. Le paiement reste hors plateforme.
          </p>
        </div>

        <section className="space-y-3">
          {(requests ?? []).length === 0 && (
            <div className="rounded-3xl bg-white p-6 text-[#112532]/60 shadow-sm ring-1 ring-[#112532]/10">
              Aucune demande de paiement pour l’instant.
            </div>
          )}

          {(requests ?? []).map((request) => {
            const cleanerName = [request.cleaners?.first_name, request.cleaners?.last_name]
              .filter(Boolean)
              .join(" ") || "Intervenante";

            const ownerName =
              request.owners?.display_name ||
              request.owners?.legal_name ||
              request.owner_recipient_name ||
              "Propriétaire";

            return (
              <div key={request.id} className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xl font-bold text-[#112532]">
                      {cleanerName} → {ownerName}
                    </p>

                    <p className="mt-1 text-sm text-[#112532]/48">
                      {dateLabel(request.period_start)} → {dateLabel(request.period_end)}
                    </p>

                    <p className="mt-1 text-sm text-[#112532]/48">
                      Statut : {statusLabel(request.status)}
                    </p>

                    {request.due_at && request.status === "sent_to_owner" && (
                      <p className="mt-1 text-sm font-semibold text-[#8A4D00]">
                        Échéance {dateLabel(request.due_at)}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-black text-[#112532]">
                      {money(request.total_eur)}
                    </p>
                    <p className="text-sm text-[#112532]/48">
                      Base {money(request.total_base_eur)} · Suppl. {money(request.total_extras_eur)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/owner/payments/${request.public_token}`}
                    className="rounded-full bg-[#112532]/6 px-4 py-2 text-sm font-bold text-[#112532]/76"
                  >
                    Voir côté propriétaire
                  </Link>

                  {request.status !== "paid" && (
                    <form action={markPaymentPaid}>
                      <input type="hidden" name="id" value={request.id} />
                      <button className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
                        Marquer payé
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
          <OwnerBottomNav active="payments" />
</main>
  );
}
