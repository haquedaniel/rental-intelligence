import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  compactDateLabel,
  missingCleaningHref,
  parisDateKey,
  timeLabel,
} from "@/components/owner-planning/timelineUtils";

export const dynamic = "force-dynamic";

export default async function MissingCleaningIssuePage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  await requireAdmin();

  const { reservationId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !reservation) {
    throw new Error("Réservation introuvable.");
  }

  const { data: property } = reservation.property_id
    ? await supabase.from("properties").select("*").eq("id", reservation.property_id).maybeSingle()
    : { data: null };

  const { data: existingRequests } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("reservation_id", reservation.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/admin/planning-v2" className="text-sm font-bold text-slate-600">
          ← Calendrier central
        </Link>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-red-500">
            Ménage manquant
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            {property?.name ?? "Logement"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Départ le {reservation.checkout_at ? compactDateLabel(parisDateKey(reservation.checkout_at)) : "—"} à {timeLabel(reservation.checkout_at)}
          </p>

          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-red-950 ring-1 ring-red-100">
            <p className="font-black">Aucune mission ménage active n’est liée à ce départ.</p>
            <p className="mt-1 text-sm text-red-800">
              Créez une mission ou vérifiez les missions existantes si l’une d’elles devait être associée à cette réservation.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={missingCleaningHref(reservation)}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white"
            >
              Créer une mission
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">Réservation</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Client</p>
              <p className="mt-1 font-bold">{reservation.guest_name || reservation.source_booking_id || "—"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Arrivée</p>
              <p className="mt-1 font-bold">{reservation.checkin_at ? compactDateLabel(parisDateKey(reservation.checkin_at)) : "—"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Départ</p>
              <p className="mt-1 font-bold">{reservation.checkout_at ? compactDateLabel(parisDateKey(reservation.checkout_at)) : "—"}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">Missions liées</h2>
          {(existingRequests ?? []).length === 0 ? (
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              Aucune mission trouvée pour cette réservation.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {(existingRequests ?? []).map((request) => (
                <Link
                  key={request.id}
                  href={`/admin/issues/request/${request.id}`}
                  className="block rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"
                >
                  <p className="font-black text-slate-950">{request.status}</p>
                  <p className="text-sm text-slate-500">{request.schedule_status || "planning non renseigné"}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
