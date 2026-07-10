import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { deactivateOwner, saveOwner } from "./actions";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function ownerName(ownerId: string | null | undefined, owners: Row[]): string {
  if (!ownerId) return "Aucun propriétaire";
  return owners.find((owner) => owner.id === ownerId)?.display_name ?? "Autre propriétaire";
}

function inputClass() {
  return "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm";
}

function OwnerForm({
  owner,
  owners,
  properties,
}: {
  owner?: Row;
  owners: Row[];
  properties: Row[];
}) {
  const isNew = !owner;

  return (
    <form action={saveOwner} encType="multipart/form-data" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      {owner?.id && <input type="hidden" name="owner_id" value={owner.id} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            {isNew ? "Ajouter un propriétaire" : owner.display_name}
          </h2>
          {!isNew && (
            <p className="mt-1 text-sm text-slate-500">
              Fiche propriétaire / destinataire des demandes de paiement.
            </p>
          )}
        </div>

        {!isNew && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              owner.active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {owner.active ? "Actif" : "Inactif"}
          </span>
        )}
      </div>

      {!isNew && owner.public_token && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Lien cockpit propriétaire
          </p>

          <Link
            href={`/owner/${owner.public_token}/cockpit`}
            className="mt-2 block break-all rounded-xl bg-white p-3 text-sm font-bold text-slate-950 ring-1 ring-slate-200"
          >
            /owner/{owner.public_token}/cockpit
          </Link>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Nom affiché</span>
          <input
            name="display_name"
            defaultValue={owner?.display_name ?? ""}
            required
            className={inputClass()}
            placeholder="Daniel & Aurore"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Nom légal / facturation</span>
          <input
            name="legal_name"
            defaultValue={owner?.legal_name ?? ""}
            className={inputClass()}
            placeholder="Daniel Haque et Aurore Fourrier"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Photo propriétaire
          </span>
          <input
            type="file"
            name="profile_photo"
            accept="image/*"
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Email facturation</span>
          <input
            name="billing_email"
            type="email"
            defaultValue={owner?.billing_email ?? ""}
            className={inputClass()}
            placeholder="factures@example.com"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Téléphone</span>
          <input
            name="phone"
            defaultValue={owner?.phone ?? ""}
            className={inputClass()}
            placeholder="+33..."
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-sm font-semibold text-slate-800">Adresse de facturation</span>
          <textarea
            name="billing_address"
            defaultValue={owner?.billing_address ?? ""}
            rows={2}
            className={inputClass()}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">SIREN</span>
          <input
            name="siren"
            defaultValue={owner?.siren ?? ""}
            className={inputClass()}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">SIRET</span>
          <input
            name="siret"
            defaultValue={owner?.siret ?? ""}
            className={inputClass()}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">N° TVA</span>
          <input
            name="vat_number"
            defaultValue={owner?.vat_number ?? ""}
            className={inputClass()}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Statut TVA</span>
          <input
            name="vat_status"
            defaultValue={owner?.vat_status ?? ""}
            className={inputClass()}
            placeholder="Particulier, LMNP, société..."
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Plateforme e-facturation</span>
          <input
            name="e_invoicing_platform"
            defaultValue={owner?.e_invoicing_platform ?? ""}
            className={inputClass()}
            placeholder="Plus tard"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Délai paiement</span>
          <input
            name="payment_due_days"
            type="number"
            min="1"
            defaultValue={owner?.payment_due_days ?? 5}
            className={inputClass()}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Canal demande paiement</span>
          <select
            name="payment_request_channel"
            defaultValue={owner?.payment_request_channel ?? "sms"}
            className={inputClass()}
          >
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="sms_email">SMS + email</option>
          </select>
        </label>

        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={owner?.active ?? true}
          />
          Propriétaire actif
        </label>

        <label className="block md:col-span-2">
          <span className="text-sm font-semibold text-slate-800">Notes internes</span>
          <textarea
            name="notes"
            defaultValue={owner?.notes ?? ""}
            rows={2}
            className={inputClass()}
          />
        </label>
      </div>

      <section className="mt-5 rounded-2xl bg-slate-50 p-4">
        <h3 className="font-bold text-slate-950">Biens liés</h3>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {properties.map((property) => {
            const checked = owner?.id && property.owner_id === owner.id;
            const assignedElsewhere =
              owner?.id && property.owner_id && property.owner_id !== owner.id;

            return (
              <label
                key={property.id}
                className="flex items-start gap-3 rounded-xl bg-white p-3 text-sm ring-1 ring-slate-100"
              >
                <input
                  type="checkbox"
                  name="property_ids"
                  value={property.id}
                  defaultChecked={Boolean(checked)}
                  className="mt-1"
                />

                <span>
                  <span className="font-bold text-slate-800">
                    {property.name ?? "Bien sans nom"}
                  </span>

                  {assignedElsewhere && (
                    <span className="mt-1 block text-xs text-amber-700">
                      Actuellement lié à {ownerName(property.owner_id, owners)}
                    </span>
                  )}

                  {!property.owner_id && (
                    <span className="mt-1 block text-xs text-slate-500">
                      Aucun propriétaire assigné
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        <button className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">
          {isNew ? "Créer le propriétaire" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

export default async function AdminOwnersPage() {
  await requireAdmin();

  const supabase = getSupabaseAdmin();

  const [{ data: owners, error: ownersError }, { data: properties, error: propertiesError }] =
    await Promise.all([
      supabase
        .from("owners")
        .select("*")
        .order("active", { ascending: false })
        .order("display_name", { ascending: true }),
      supabase
        .from("properties")
        .select("id,name,owner_id")
        .order("name", { ascending: true }),
    ]);

  if (ownersError) {
    throw new Error(`Impossible de charger les propriétaires : ${ownersError.message}`);
  }

  if (propertiesError) {
    throw new Error(`Impossible de charger les biens : ${propertiesError.message}`);
  }

  const ownerRows = owners ?? [];
  const propertyRows = properties ?? [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-slate-600">
            ← Back office
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-slate-950">
            Propriétaires
          </h1>

          <p className="mt-2 text-slate-600">
            Chaque bien doit être lié à un propriétaire. Les demandes de paiement mensuelles seront ensuite générées par intervenante, propriétaire et mois.
          </p>
        </div>

        <OwnerForm owners={ownerRows} properties={propertyRows} />

        {ownerRows.map((owner) => (
          <div key={owner.id} className="space-y-2">
            <OwnerForm owner={owner} owners={ownerRows} properties={propertyRows} />

            {owner.active && (
              <form action={deactivateOwner} className="px-1">
                <input type="hidden" name="owner_id" value={owner.id} />
                <button className="text-sm font-bold text-red-700">
                  Désactiver ce propriétaire
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
