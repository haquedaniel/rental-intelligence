import { notFound } from "next/navigation";

import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCleanerLocale, t, type CleanerLocale } from "@/lib/cleanerI18n";
import { updateCleanerPreferredLanguage } from "./actions";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function textValue(row: Row, fields: string[], fallback: string) {
  for (const field of fields) {
    const raw = row[field];
    if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
      return String(raw);
    }
  }
  return fallback;
}

function money(value: unknown, locale: CleanerLocale) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number <= 0) return t(locale, "common.toComplete");
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(number);
}

function fullName(cleaner: Row, locale: CleanerLocale) {
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ") || t(locale, "common.cleanerFallback");
}

function languageName(raw: unknown): string {
  const locale = getCleanerLocale(raw);
  if (locale === "en") return "English";
  if (locale === "ru") return "Русский";
  return "Français";
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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ updated?: string }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const updated = resolvedSearchParams?.updated === "1";
  const supabase = getSupabaseAdmin();

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!cleaner) notFound();

  const locale = getCleanerLocale(cleaner.preferred_language);
  const toComplete = t(locale, "common.toComplete");

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-5 text-slate-950">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-[2rem] bg-slate-950 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-wide text-white/50">
            {t(locale, "profile.headerKicker")}
          </p>
          <h1 className="mt-2 text-3xl font-black">{fullName(cleaner, locale)}</h1>
          <p className="mt-2 text-sm font-semibold text-white/60">
            {t(locale, "profile.headerSubtitle")}
          </p>
        </header>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">{t(locale, "profile.contactDetails")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={t(locale, "profile.phone")} value={textValue(cleaner, ["phone", "phone_number", "mobile"], toComplete)} />
            <Field label={t(locale, "profile.email")} value={textValue(cleaner, ["email"], toComplete)} />
            <Field label={t(locale, "profile.cityArea")} value={textValue(cleaner, ["city", "home_city", "base_city", "area"], toComplete)} />
            <Field label={t(locale, "profile.address")} value={textValue(cleaner, ["address", "home_address"], toComplete)} />
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">{t(locale, "profile.workPayment")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={t(locale, "profile.tradingName")} value={textValue(cleaner, ["trading_name", "company_name", "legal_name"], toComplete)} />
            <Field label={t(locale, "profile.status")} value={textValue(cleaner, ["worker_type", "status"], toComplete)} />
            <Field label={t(locale, "profile.hourlyRate")} value={money(cleaner.hourly_rate_eur, locale)} />
            <Field label={t(locale, "profile.ibanPayment")} value={textValue(cleaner, ["iban", "payment_label", "payment_method"], toComplete)} />
            <Field label={t(locale, "profile.siret")} value={textValue(cleaner, ["siret", "registration_number"], toComplete)} />
            <Field label={t(locale, "profile.preferredLanguage")} value={languageName(cleaner.preferred_language)} />
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">{t(locale, "profile.appLanguageTitle")}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {t(locale, "profile.appLanguageBody")}
          </p>

          {updated && (
            <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
              {t(locale, "profile.languageSaved")}
            </p>
          )}

          <form action={updateCleanerPreferredLanguage.bind(null, token)} className="mt-4 space-y-3">
            <label className="block rounded-2xl bg-slate-50 p-4">
              <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {t(locale, "profile.preferredLanguage")}
              </span>
              <select
                name="preferred_language"
                defaultValue={cleaner.preferred_language ?? "fr"}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-950"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </label>

            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
            >
              {t(locale, "profile.saveLanguage")}
            </button>
          </form>
        </section>

        <p className="text-center text-xs font-semibold text-slate-400">
          {t(locale, "profile.futureChanges")}
        </p>
      </div>

      <CleanerBottomNav cleanerToken={token} active="profile" locale={locale} />
    </main>
  );
}
