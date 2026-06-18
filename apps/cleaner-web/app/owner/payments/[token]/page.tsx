import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { markOwnerPaymentPaid } from "./actions";

export const dynamic = "force-dynamic";

function money(value: unknown): string {
  return `${Number(value ?? 0).toFixed(2)} €`;
}

function dateLabel(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status?: string): string {
  switch (status) {
    case "sent_to_owner":
      return "À régler";
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

export default async function OwnerPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: request } = await supabase
    .from("monthly_payment_requests")
    .select(`
      *,
      cleaners:cleaner_id(*),
      owners:owner_id(*)
    `)
    .eq("public_token", token)
    .maybeSingle();

  if (!request) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-950">Demande introuvable</h1>
          <p className="mt-2 text-slate-600">Le lien est invalide ou la demande n’existe plus.</p>
        </div>
      </main>
    );
  }

  const { data: lines } = await supabase
    .from("monthly_payment_request_lines")
    .select("*")
    .eq("monthly_payment_request_id", request.id)
    .order("work_date", { ascending: true });

  const cleanerName = [request.cleaners?.first_name, request.cleaners?.last_name]
    .filter(Boolean)
    .join(" ") || "Intervenante";

  const ownerName =
    request.owners?.display_name ||
    request.owners?.legal_name ||
    request.owner_recipient_name ||
    "Propriétaire";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Demande de paiement
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            {cleanerName}
          </h1>

          <p className="mt-2 text-slate-300">
            Pour {ownerName} · {dateLabel(request.period_start)} → {dateLabel(request.period_end)}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-slate-400">Base missions</p>
              <p className="text-2xl font-black">{money(request.total_base_eur)}</p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Suppléments</p>
              <p className="text-2xl font-black">{money(request.total_extras_eur)}</p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Total</p>
              <p className="text-4xl font-black">{money(request.total_eur)}</p>
            </div>
          </div>

          <p className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
            {statusLabel(request.status)}
          </p>

          {request.due_at && request.status === "sent_to_owner" && (
            <p className="mt-3 text-sm text-slate-300">
              Paiement demandé avant le {dateLabel(request.due_at)}.
            </p>
          )}
        </section>

        {request.cleaner_message && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-950">Message de l’intervenante</h2>
            <p className="mt-2 whitespace-pre-wrap text-slate-700">{request.cleaner_message}</p>
          </section>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-950">Détail des missions</h2>

          <div className="mt-4 space-y-3">
            {(lines ?? []).map((line) => (
              <div
                key={line.id}
                className={`rounded-2xl p-4 ring-1 ${
                  line.line_type === "extra"
                    ? "bg-amber-50 ring-amber-100"
                    : "bg-slate-50 ring-slate-100"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">
                      {line.description}
                    </p>
                    <p className="text-sm text-slate-500">
                      {dateLabel(line.work_date)} · {line.property_name}
                      {Number(line.hours ?? 0) > 0 ? ` · ${Number(line.hours).toFixed(2)}h` : ""}
                    </p>

                    {line.status === "pending_owner_review" && (
                      <p className="mt-1 text-xs font-bold text-amber-800">
                        Supplément exceptionnel à vérifier
                      </p>
                    )}
                  </div>

                  <p className="font-black text-slate-950">
                    {money(line.amount_eur)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-950">Règlement</h2>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p><strong>Méthode :</strong> {request.payment_method_snapshot || "Non renseignée"}</p>
            <p><strong>Détails :</strong> {request.payment_details_snapshot || "Non renseignés"}</p>
            <p><strong>IBAN :</strong> {request.iban_snapshot || "Non renseigné"}</p>
          </div>

          {request.invoice_status === "draft_needed" && (
            <p className="mt-3 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">
              Cette intervenante est déclarée comme auto-entrepreneur. Une facture pourra être jointe ou générée plus tard.
            </p>
          )}

          {request.status !== "paid" ? (
            <form action={markOwnerPaymentPaid} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <button className="w-full rounded-2xl bg-emerald-700 px-4 py-4 font-bold text-white">
                Marquer comme payé
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Le paiement est réalisé hors plateforme, directement avec l’intervenante.
              </p>
            </form>
          ) : (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
              Paiement marqué comme effectué le {dateLabel(request.paid_at)}.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
