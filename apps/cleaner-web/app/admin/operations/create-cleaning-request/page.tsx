import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function CreateCleaningRequestPlaceholderPage({
  searchParams,
}: {
  searchParams?: Promise<{ reservation_id?: string; property_id?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const reservationId = params?.reservation_id ?? "";

  const supabase = getSupabaseAdmin();

  let reservation: Record<string, any> | null = null;
  let property: Record<string, any> | null = null;

  if (reservationId) {
    const { data: reservationData } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .maybeSingle();

    reservation = reservationData;

    if (reservation?.property_id) {
      const { data: propertyData } = await supabase
        .from("properties")
        .select("*")
        .eq("id", reservation.property_id)
        .maybeSingle();

      property = propertyData;
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin/operations" className="text-sm font-semibold text-slate-600">
          ← Planning opérations
        </Link>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Création manuelle
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Créer une mission ménage
          </h1>

          <p className="mt-3 text-slate-600">
            Cette page sera l’étape de confirmation avant création d’une mission
            manquante. Pour l’instant, le lien permet simplement d’identifier la
            réservation concernée sans risque de création automatique.
          </p>

          <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
            <p>
              <span className="font-semibold">Logement :</span>{" "}
              {property?.name ?? "Non identifié"}
            </p>
            <p>
              <span className="font-semibold">Réservation :</span>{" "}
              {reservation?.guest_name ?? reservation?.source_booking_id ?? reservationId ?? "Non identifiée"}
            </p>
            <p>
              <span className="font-semibold">Départ :</span>{" "}
              {reservation?.checkout_at ?? "Non renseigné"}
            </p>
          </div>

          <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Prochaine étape : proposer l’intervenante disponible, calculer le
            montant, puis bouton “Créer et envoyer la mission”.
          </p>
        </section>
      </div>
    </main>
  );
}
