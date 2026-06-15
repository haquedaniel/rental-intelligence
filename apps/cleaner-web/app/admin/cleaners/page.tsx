import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { createCleaner, updateCleaner } from "./actions";

export const dynamic = "force-dynamic";

const SERVICE_OPTIONS = [
  ["standard_cleaning", "Ménage standard"],
  ["laundry", "Lessive"],
  ["linen_replacement", "Remplacement du linge"],
  ["inventory_checks", "Contrôle inventaire"],
  ["welcome_preparation", "Préparation accueil"],
  ["minor_maintenance_reporting", "Signalement petites réparations"],
  ["gardening_lawnmowing", "Jardinage / tonte"],
];

const STATUS_OPTIONS = [
  ["active", "Active"],
  ["temporarily_unavailable", "Temporairement indisponible"],
  ["inactive", "Inactive"],
];

const WORKER_TYPE_OPTIONS = [
  ["individual_payment_request", "Particulier / demande de paiement"],
  ["auto_entrepreneur", "Auto-entrepreneur"],
  ["company", "Société"],
  ["cesu_compatible", "Compatible CESU"],
];

const PAYMENT_METHOD_OPTIONS = [
  ["", "Non renseigné"],
  ["bank_transfer", "Virement bancaire"],
  ["payment_link", "Lien de paiement"],
  ["paypal", "PayPal"],
  ["revolut", "Revolut"],
  ["cesu", "CESU"],
  ["other", "Autre"],
];

type Cleaner = Record<string, any>;

function fullName(cleaner: Cleaner) {
  return [cleaner.first_name, cleaner.last_name].filter(Boolean).join(" ");
}

function servicesFor(cleaner?: Cleaner): string[] {
  return Array.isArray(cleaner?.services) ? cleaner.services : [];
}

function statusLabel(status?: string) {
  return (
    STATUS_OPTIONS.find(([value]) => value === status)?.[1] ??
    "Active"
  );
}

function statusClasses(status?: string) {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "temporarily_unavailable") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-red-100 text-red-800";
}

function TextInput({
  name,
  label,
  defaultValue,
  required = false,
  placeholder,
  type = "text",
  step,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
      />
    </div>
  );
}

function NumberInput({
  name,
  label,
  defaultValue,
  step = "0.01",
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  step?: string;
}) {
  return (
    <TextInput
      name={name}
      label={label}
      defaultValue={defaultValue}
      type="number"
      step={step}
    />
  );
}

function SelectInput({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  options: string[][];
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
      >
        {options.map(([value, label]) => (
          <option key={value || "empty"} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({
  name,
  label,
  defaultValue,
  rows = 3,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <textarea
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
      />
    </div>
  );
}

function CleanerForm({
  cleaner,
  action,
  submitLabel,
}: {
  cleaner?: Cleaner;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const selectedServices = servicesFor(cleaner);

  return (
    <form action={action} encType="multipart/form-data" className="space-y-6">
      {cleaner?.id && (
        <input type="hidden" name="cleaner_id" value={cleaner.id} />
      )}

      <section className="grid gap-4 md:grid-cols-[160px_1fr]">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Photo de profil
          </p>

          <div className="mt-2 h-32 w-32 overflow-hidden rounded-3xl bg-slate-100 ring-1 ring-slate-200">
            {cleaner?.profilePhotoSignedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cleaner.profilePhotoSignedUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl">
                👤
              </div>
            )}
          </div>

          <input
            name="profile_photo"
            type="file"
            accept="image/*"
            className="mt-3 block w-full text-xs text-slate-600 file:mr-2 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            name="first_name"
            label="Prénom"
            required
            defaultValue={cleaner?.first_name}
          />
          <TextInput
            name="last_name"
            label="Nom"
            defaultValue={cleaner?.last_name}
          />
          <TextInput
            name="phone"
            label="Téléphone WhatsApp"
            placeholder="+336..."
            defaultValue={cleaner?.phone}
          />
          <TextInput
            name="email"
            label="Email"
            type="email"
            defaultValue={cleaner?.email}
          />
          <SelectInput
            name="status"
            label="Statut"
            defaultValue={cleaner?.status ?? "active"}
            options={STATUS_OPTIONS}
          />
          <TextInput
            name="address"
            label="Adresse postale"
            defaultValue={cleaner?.address}
          />
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-950">
          Localisation
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <TextInput
            name="latitude"
            label="Latitude"
            defaultValue={cleaner?.latitude}
            placeholder="optionnel"
          />
          <TextInput
            name="longitude"
            label="Longitude"
            defaultValue={cleaner?.longitude}
            placeholder="optionnel"
          />
          <TextInput
            name="max_travel_distance_km"
            label="Distance max souhaitée (km)"
            defaultValue={cleaner?.max_travel_distance_km}
          />
        </div>
        <div className="mt-4">
          <Textarea
            name="preferred_towns"
            label="Communes / secteurs préférés"
            defaultValue={cleaner?.preferred_towns}
            placeholder="Audierne, Plouhinec, Pont-Croix..."
          />
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-950">
          Services proposés
        </h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {SERVICE_OPTIONS.map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name="services"
                value={value}
                defaultChecked={selectedServices.includes(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-950">
          Rémunération
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <NumberInput
            name="hourly_rate_eur"
            label="Tarif horaire (€)"
            defaultValue={cleaner?.hourly_rate_eur ?? 18}
          />
          <NumberInput
            name="included_radius_km"
            label="Rayon inclus (km)"
            defaultValue={cleaner?.included_radius_km ?? 0}
            step="0.1"
          />
          <NumberInput
            name="travel_rate_per_km_eur"
            label="Déplacement €/km"
            defaultValue={cleaner?.travel_rate_per_km_eur ?? 0}
          />
          <NumberInput
            name="urgency_bonus_percent"
            label="Bonus urgence (%)"
            defaultValue={cleaner?.urgency_bonus_percent ?? 15}
          />
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-950">
          Paiement et statut légal
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <SelectInput
            name="worker_type"
            label="Type d’intervenante"
            defaultValue={
              cleaner?.worker_type ?? "individual_payment_request"
            }
            options={WORKER_TYPE_OPTIONS}
          />
          <SelectInput
            name="payment_method"
            label="Méthode de paiement"
            defaultValue={cleaner?.payment_method}
            options={PAYMENT_METHOD_OPTIONS}
          />
          <TextInput
            name="legal_name"
            label="Nom légal"
            defaultValue={cleaner?.legal_name}
          />
          <TextInput
            name="trading_name"
            label="Nom commercial"
            defaultValue={cleaner?.trading_name}
          />
          <TextInput
            name="siret"
            label="SIRET"
            defaultValue={cleaner?.siret}
          />
          <TextInput
            name="billing_email"
            label="Email de facturation"
            type="email"
            defaultValue={cleaner?.billing_email}
          />
          <TextInput
            name="vat_status"
            label="Statut TVA"
            defaultValue={cleaner?.vat_status}
            placeholder="Ex: TVA non applicable"
          />
          <TextInput
            name="payment_terms"
            label="Conditions de paiement"
            defaultValue={cleaner?.payment_terms}
            placeholder="Ex: paiement mensuel"
          />
          <TextInput
            name="iban"
            label="IBAN / paiement"
            defaultValue={cleaner?.iban}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Textarea
            name="business_address"
            label="Adresse professionnelle"
            defaultValue={cleaner?.business_address}
          />
          <Textarea
            name="payment_details"
            label="Détails de paiement privés"
            defaultValue={cleaner?.payment_details}
            placeholder="Lien de paiement, infos CESU, remarques..."
          />
        </div>

        <div className="mt-4">
          <Textarea
            name="invoice_note"
            label="Note facture"
            defaultValue={cleaner?.invoice_note}
            placeholder="Ex: TVA non applicable, art. 293 B du CGI"
          />
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-slate-950">
          Qualité et notes internes
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-[160px_1fr]">
          <TextInput
            name="internal_rating"
            label="Note interne /5"
            type="number"
            defaultValue={cleaner?.internal_rating}
          />
          <Textarea
            name="quality_notes"
            label="Notes qualité"
            defaultValue={cleaner?.quality_notes}
            placeholder="Fiabilité, communication, qualité du linge..."
          />
        </div>

        <div className="mt-4">
          <Textarea
            name="notes"
            label="Notes générales"
            defaultValue={cleaner?.notes}
          />
        </div>
      </section>

      <button
        type="submit"
        className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}

export default async function AdminCleanersPage() {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const { data: cleanerRows, error } = await supabase
    .from("cleaners")
    .select("*")
    .order("first_name", { ascending: true });

  if (error) {
    throw new Error(`Impossible de charger les intervenantes : ${error.message}`);
  }

  const cleaners = await Promise.all(
    (cleanerRows ?? []).map(async (cleaner) => {
      if (!cleaner.profile_photo_path) {
        return cleaner;
      }

      const { data } = await supabase.storage
        .from(cleaner.profile_photo_bucket || "cleaner-profile-photos")
        .createSignedUrl(cleaner.profile_photo_path, 60 * 60);

      return {
        ...cleaner,
        profilePhotoSignedUrl: data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Intervenantes ménage
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Profil, disponibilité future, services, rémunération, paiement et
            informations internes.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-950">
            Ajouter une intervenante
          </h2>

          <div className="mt-5">
            <CleanerForm action={createCleaner} submitLabel="Ajouter" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="px-1 text-lg font-bold text-slate-950">
            Intervenantes existantes
          </h2>

          {cleaners.length === 0 && (
            <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
              Aucune intervenante créée pour le moment.
            </div>
          )}

          {cleaners.map((cleaner) => (
            <details
              key={cleaner.id}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                    {cleaner.profilePhotoSignedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cleaner.profilePhotoSignedUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">
                        👤
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-950">
                        {fullName(cleaner) || "Sans nom"}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                          cleaner.status,
                        )}`}
                      >
                        {statusLabel(cleaner.status)}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-sm text-slate-600">
                      {cleaner.phone || "Pas de téléphone"} ·{" "}
                      {cleaner.hourly_rate_eur ?? 0} €/h ·{" "}
                      {cleaner.services?.length ?? 0} service(s)
                    </p>
                  </div>

                  <span className="text-sm font-semibold text-slate-500">
                    Modifier
                  </span>
                </div>
              </summary>

              <div className="mt-6 border-t border-slate-100 pt-6">
                <CleanerForm
                  cleaner={cleaner}
                  action={updateCleaner}
                  submitLabel="Enregistrer"
                />
              </div>
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
