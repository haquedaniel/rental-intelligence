import Link from "next/link";
import { notFound } from "next/navigation";

import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function textValue(row: Row, fields: string[], fallback = "À compléter") {
  for (const field of fields) {
    const raw = row[field];
    if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
      return String(raw);
    }
  }
  return fallback;
}

function money(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number <= 0) return "À compléter";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(number);
}

function fullName(cleaner: Row) {
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || "Intervenante";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

export default async function CleanerProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!cleaner) notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-5 text-slate-950">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-[2rem] bg-slate-950 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-wide text-white/50">
            Profil intervenante
          </p>
          <h1 className="mt-2 text-3xl font-black">{fullName(cleaner)}</h1>
          <p className="mt-2 text-sm font-semibold text-white/60">
            Informations utilisées pour les missions, les notifications et les paiements.
          </p>
        </header>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">Coordonnées</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Téléphone" value={textValue(cleaner, ["phone", "phone_number", "mobile"])} />
            <Field label="Email" value={textValue(cleaner, ["email"])} />
            <Field label="Ville / secteur" value={textValue(cleaner, ["city", "home_city", "base_city", "area"])} />
            <Field label="Adresse" value={textValue(cleaner, ["address", "home_address"])} />
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">Travail & paiement</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nom commercial" value={textValue(cleaner, ["trading_name", "company_name", "legal_name"])} />
            <Field label="Statut" value={textValue(cleaner, ["worker_type", "status"])} />
            <Field label="Taux horaire" value={money(cleaner.hourly_rate_eur)} />
            <Field label="IBAN / paiement" value={textValue(cleaner, ["iban", "payment_label", "payment_method"])} />
            <Field label="SIRET" value={textValue(cleaner, ["siret", "registration_number"])} />
            <Field label="Langue préférée" value={textValue(cleaner, ["preferred_language", "language"], "Français")} />
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">Actions</h2>
          <div className="mt-4 grid gap-3">
            <Link
              href={`/cleaner/${token}/payments`}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white"
            >
              Voir mes paiements
            </Link>
            <Link
              href={`/cleaner/${token}/planning`}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-950"
            >
              Voir mon planning
            </Link>
          </div>
        </section>

        <p className="text-center text-xs font-semibold text-slate-400">
          Les modifications du profil seront ajoutées dans une prochaine étape.
        </p>
      </div>

      <CleanerBottomNav cleanerToken={token} active="profile" />
    </main>
  );
}
