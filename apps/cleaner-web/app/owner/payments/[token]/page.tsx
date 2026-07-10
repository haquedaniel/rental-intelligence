import { markPaymentRequestPaid, refusePaymentRequest } from "./actions";
import PrintButton from "./PrintButton";
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

function periodLabel(request: Row): string {
  const start = new Date(`${request.period_start}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(start);
}

function statusLabel(status?: string | null): string {
  switch (status) {
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
    default:
      return "Brouillon";
  }
}

function statusClass(status?: string | null): string {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "refused":
    case "overdue":
      return "bg-red-100 text-red-800 ring-red-200";
    case "sent_to_owner":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    default:
      return "bg-[#112532]/6 text-[#112532]/76 ring-[#112532]/10";
  }
}

function present(value?: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function InfoLine({ label, value }: { label: string; value?: unknown }) {
  const text = present(value);
  if (!text) return null;

  return (
    <p className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm">
      <span className="font-semibold text-[#112532]/48">{label}</span>
      <span className="text-right font-bold text-[#112532]">{text}</span>
    </p>
  );
}

function PayOrRefuseActions({ request }: { request: Row }) {
  const open = ["sent_to_owner", "overdue"].includes(String(request.status));

  if (request.status === "paid") {
    return (
      <div className="rounded-3xl bg-emerald-50 p-5 text-emerald-900 ring-1 ring-emerald-100">
        <p className="text-lg font-black">Paiement confirmé</p>
        <p className="mt-1 text-sm font-semibold">
          Marqué comme payé le {compactDate(request.paid_at)}.
        </p>
      </div>
    );
  }

  if (request.status === "refused") {
    return (
      <div className="rounded-3xl bg-red-50 p-5 text-red-900 ring-1 ring-red-100">
        <p className="text-lg font-black">Demande refusée</p>
        <p className="mt-1 text-sm font-semibold">
          Motif : {request.owner_refusal_reason || "Non renseigné"}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="rounded-3xl bg-[#F6F3EF] p-5 text-[#112532]/60 ring-1 ring-[#112532]/10">
        <p className="text-sm font-semibold">
          Cette demande n’est pas ouverte au règlement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={markPaymentRequestPaid}>
        <input type="hidden" name="token" value={request.public_token} />
        <button className="w-full rounded-2xl bg-emerald-600 px-4 py-4 text-base font-black text-white shadow-sm">
          Marquer comme payé
        </button>
        <p className="mt-2 text-xs font-semibold text-[#112532]/48">
          À utiliser après paiement par virement, espèces, chèque ou autre moyen convenu.
        </p>
      </form>

      <form action={refusePaymentRequest} className="rounded-3xl bg-red-50 p-4 ring-1 ring-red-100">
        <input type="hidden" name="token" value={request.public_token} />

        <label className="block">
          <span className="text-sm font-black text-red-950">Refuser la demande</span>
          <textarea
            name="reason"
            required
            rows={3}
            placeholder="Expliquez le motif : montant incorrect, supplément non validé, mission à vérifier..."
            className="mt-2 w-full rounded-2xl border border-red-200 bg-white p-3 text-sm text-[#112532]"
          />
        </label>

        <button className="mt-3 rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white">
          Refuser avec motif
        </button>
      </form>
    </div>
  );
}

function PrintableDocument({
  request,
  lines,
}: {
  request: Row;
  lines: Row[];
}) {
  const cleanerName =
    request.cleaner_name_snapshot ||
    request.cleaner_legal_name_snapshot ||
    "Intervenante";

  return (
    <section id="payment-document" className="rounded-[2rem] bg-white/92 p-6 shadow-sm ring-1 ring-[#112532]/8 print:shadow-none print:ring-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#112532]/10 pb-5">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-[#112532]/36">
            Demande de paiement
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#112532]">
            Relevé de missions et demande de règlement
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#112532]/48">
            Période : {periodLabel(request)} · {compactDate(request.period_start)} au {compactDate(request.period_end)}
          </p>
        </div>

        <div className={`rounded-full px-3 py-1 text-sm font-black ring-1 ${statusClass(request.status)}`}>
          {statusLabel(request.status)}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-[#112532]/36">
            Intervenante
          </h2>
          <div className="mt-3 rounded-2xl bg-[#F6F3EF] p-4">
            <p className="text-lg font-black text-[#112532]">{cleanerName}</p>
            <InfoLine label="Nom légal" value={request.cleaner_legal_name_snapshot} />
            <InfoLine label="Adresse" value={request.cleaner_address_snapshot} />
            <InfoLine label="SIRET" value={request.cleaner_siret_snapshot} />
            <InfoLine label="TVA" value={request.cleaner_vat_status_snapshot} />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-[#112532]/36">
            Règlement
          </h2>
          <div className="mt-3 rounded-2xl bg-[#F6F3EF] p-4">
            <InfoLine label="Destinataire" value={request.owner_recipient_name} />
            <InfoLine label="Échéance" value={compactDate(request.due_at)} />
            <InfoLine label="Mode" value={request.payment_method_snapshot} />
            <InfoLine label="IBAN" value={request.iban_snapshot} />
            <InfoLine label="Instructions" value={request.payment_details_snapshot} />
          </div>
        </div>
      </div>

      {request.cleaner_message && (
        <div className="mt-6 rounded-2xl bg-sky-50 p-4 text-sm font-semibold text-sky-950 ring-1 ring-sky-100">
          <p className="font-black">Message de l’intervenante</p>
          <p className="mt-1 whitespace-pre-wrap">{request.cleaner_message}</p>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-[#112532]/10">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[#F6F3EF] text-xs font-black uppercase tracking-wide text-[#112532]/48">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Logement</th>
              <th className="p-3">Description</th>
              <th className="p-3 text-right">Heures</th>
              <th className="p-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-t border-slate-100">
                <td className="p-3 font-semibold text-[#112532]/76">{compactDate(line.work_date)}</td>
                <td className="p-3 text-[#112532]/60">{line.property_name || "—"}</td>
                <td className="p-3">
                  <p className="font-bold text-[#112532]">{line.description}</p>
                  {line.line_type === "extra" && (
                    <p className="mt-1 text-xs font-bold text-amber-700">Ligne exceptionnelle</p>
                  )}
                </td>
                <td className="p-3 text-right font-semibold text-[#112532]/76">
                  {Number(line.hours ?? 0) > 0 ? `${String(line.hours).replace(".", ",")} h` : "—"}
                </td>
                <td className="p-3 text-right font-black text-[#112532]">
                  {money(line.amount_eur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-sm rounded-2xl bg-[#112532] p-5 text-white">
          <div className="flex justify-between text-sm font-semibold text-slate-300">
            <span>Missions</span>
            <span>{money(request.total_base_eur)}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm font-semibold text-slate-300">
            <span>Suppléments</span>
            <span>{money(request.total_extras_eur)}</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-white/20 pt-4 text-xl font-black">
            <span>Total dû</span>
            <span>{money(request.total_eur)}</span>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs font-semibold text-[#112532]/36">
        Document préparé à partir des informations déclarées par l’intervenante et des missions validées dans la plateforme.
        Ce document facilite le règlement et le suivi comptable ; il ne remplace pas une facture lorsque celle-ci est légalement requise.
      </p>
    </section>
  );
}

export default async function OwnerPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { getSupabaseAdmin } = await import("@/lib/supabaseAdmin");
  const supabase = getSupabaseAdmin();

  const { data: request, error } = await supabase
    .from("monthly_payment_requests")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (error || !request) {
    return (
      <main className="min-h-screen bg-[#F6F3EF] px-4 py-8">
        <div className="mx-auto max-w-xl rounded-[2rem] bg-white/92 p-6 shadow-sm ring-1 ring-[#112532]/8">
          <h1 className="text-2xl font-black text-[#112532]">Lien invalide</h1>
          <p className="mt-2 text-[#112532]/60">
            Cette demande de paiement n’existe pas ou n’est plus accessible.
          </p>
        </div>
      </main>
    );
  }

  const { data: lines } = await supabase
    .from("monthly_payment_request_lines")
    .select("*")
    .eq("monthly_payment_request_id", request.id)
    .order("work_date", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-4 py-6 print:bg-white print:px-0 print:py-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          main { background: white !important; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl space-y-6 print:max-w-none print:space-y-0">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#112532]/36">
              Paiement intervenante
            </p>
            <h1 className="mt-1 text-3xl font-black text-[#112532]">
              Demande de règlement
            </h1>
          </div>

          <PrintButton />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px] print:block">
          <PrintableDocument request={request} lines={(lines ?? []) as Row[]} />

          <aside className="no-print space-y-4">
            <div className="rounded-[2rem] bg-white/92 p-5 shadow-sm ring-1 ring-[#112532]/8">
              <p className="text-sm font-black uppercase tracking-wide text-[#112532]/36">
                À régler
              </p>
              <p className="mt-2 text-4xl font-black text-[#112532]">
                {money(request.total_eur)}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#112532]/48">
                Échéance : {compactDate(request.due_at)}
              </p>
            </div>

            <PayOrRefuseActions request={request} />
          </aside>
        </div>
      </div>
          <OwnerBottomNav active="payments" />
</main>
  );
}
