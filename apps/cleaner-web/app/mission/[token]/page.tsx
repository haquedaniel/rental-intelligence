import { acceptMission, refuseMission } from "./actions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import CleanerMissionNav from "@/components/navigation/CleanerMissionNav";
import Link from "next/link";
import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";
import { redirect } from "next/navigation";
import { getCleanerLocale, t, tr, type CleanerLocale } from "@/lib/cleanerI18n";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

function formatEuro(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "0,00 €";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function statusLabel(status: string, locale: CleanerLocale) {
  return t(locale, `status.${status}`) === `status.${status}` ? status : t(locale, `status.${status}`);
}

async function getCoverPhotoUrl(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  propertyId: string,
) {
  const { data: coverPhoto } = await supabaseAdmin
    .from("property_reference_photos")
    .select("storage_bucket,storage_path,title")
    .eq("property_id", propertyId)
    .eq("is_cover", true)
    .eq("is_active", true)
    .is("section_key", null)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!coverPhoto?.storage_bucket || !coverPhoto?.storage_path) {
    return null;
  }

  const { data, error } = await supabaseAdmin.storage
    .from(coverPhoto.storage_bucket)
    .createSignedUrl(coverPhoto.storage_path, 60 * 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return {
    url: data.signedUrl,
    title: coverPhoto.title ?? t("fr", "form.photoAlt"),
  };
}

export default async function MissionPage({ params }: PageProps) {
  const { token } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("cleaning_requests")
    .select(
      `
      id,
      property_id,
      status,
      schedule_status,
      ready_by_at,
      urgent,
      scheduled_start_at,
      scheduled_end_at,
      estimated_hours,
      cleaning_cost_eur,
      travel_distance_km,
      billable_travel_km,
      travel_cost_eur,
      urgency_bonus_eur,
      total_cost_eur,
      refusal_reason,
      public_token_expires_at,
      properties (
        name,
        address
      ),
      cleaners (
        first_name,
        last_name,
        public_token,
        preferred_language
      ),
      property_cleaning_profiles (
        label,
        description
      )
      `,
    )
    .eq("public_token", token)
    .single();

  const mission: any = data;

  if (error || !mission) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">

      <Link
        href={`/mission/${token}/reservation`}
        className="mb-4 inline-flex rounded-full bg-[#112532] px-4 py-3 text-sm font-black text-white shadow-sm"
      >
        Briefing séjour →
      </Link>

        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">
            {t("fr", "common.missionNotFound")}
          </h1>
          <p className="mt-3 text-slate-600">
            {t("fr", "common.missionNotFoundBody")}
          </p>
        </div>
            <CleanerMissionNav missionToken={token} active="missions" />
    </main>
    );
  }

  const cleaner = Array.isArray(mission.cleaners)
    ? mission.cleaners[0]
    : mission.cleaners;

  const locale = getCleanerLocale(cleaner?.preferred_language);

  if (
    mission.public_token_expires_at &&
    new Date(mission.public_token_expires_at) < new Date()
  ) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-slate-900">{t(locale, "common.linkExpired")}</h1>
          <p className="mt-3 text-slate-600">
            {t(locale, "common.linkExpiredBody")}
          </p>
        </div>
      </main>
    );
  }

  const shouldChooseReadyDay =
    mission.status === "sent" ||
    (mission.status === "accepted" &&
      mission.schedule_status === "waiting_for_ready_day" &&
      !mission.ready_by_at);

  if (shouldChooseReadyDay) {
    redirect(`/mission/${token}/ready-day`);
  }

  const property = Array.isArray(mission.properties)
    ? mission.properties[0]
    : mission.properties;

  const profile = Array.isArray(mission.property_cleaning_profiles)
    ? mission.property_cleaning_profiles[0]
    : mission.property_cleaning_profiles;

  const coverPhoto = mission.property_id
    ? await getCoverPhotoUrl(supabaseAdmin, mission.property_id)
    : null;

  const isPending = mission.status === "sent";
  const isAccepted = mission.status === "accepted";
  const isRefused = mission.status === "refused";

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-4">
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          {coverPhoto?.url && (
            <img
              src={coverPhoto.url}
              alt={coverPhoto.title}
              className="h-44 w-full object-cover"
            />
          )}

          <div className="p-6">
            <p className="text-sm font-medium text-slate-500">
              {t(locale, "mission.proposal")}
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {property?.name}
            </h1>

            <p className="mt-1 text-slate-600">{property?.address}</p>

            <div className="mt-5 rounded-2xl bg-slate-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-500">{t(locale, "mission.status")}</span>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                  {statusLabel(mission.status, locale)}
                </span>
              </div>

              {mission.urgent && (
                <div className="mt-3 rounded-xl bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-800">
                  {t(locale, "mission.urgent")}
                </div>
              )}
            </div>

            <section className="mt-6 space-y-3">
              <div>
                <p className="text-sm text-slate-500">{t(locale, "mission.for")}</p>
                <p className="font-medium text-slate-900">
                  {cleaner?.first_name} {cleaner?.last_name || ""}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">{t(locale, "mission.scheduledDate")}</p>
                <p className="font-medium text-slate-900">
                  {formatDate(mission.scheduled_start_at)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">{t(locale, "mission.cleaningType")}</p>
                <p className="font-medium text-slate-900">{profile?.label}</p>
                {profile?.description && (
                  <p className="mt-1 text-sm text-slate-600">
                    {profile.description}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm text-slate-500">{t(locale, "mission.estimatedDuration")}</p>
                <p className="font-medium text-slate-900">
                  {mission.estimated_hours} h
                </p>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-900">{t(locale, "mission.remuneration")}</h2>

              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span>{t(locale, "mission.cleaning")}</span>
                  <span>{formatEuro(mission.cleaning_cost_eur)}</span>
                </div>

                <div className="flex justify-between">
                  <span>
                    {t(locale, "mission.travel")} ({Number(mission.travel_distance_km).toFixed(1)} km)
                  </span>
                  <span>{formatEuro(mission.travel_cost_eur)}</span>
                </div>

                <div className="flex justify-between">
                  <span>{t(locale, "mission.urgencyBonus")}</span>
                  <span>{formatEuro(mission.urgency_bonus_eur)}</span>
                </div>

                <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-lg font-bold text-slate-900">
                  <span>{t(locale, "payments.total")}</span>
                  <span>{formatEuro(mission.total_cost_eur)}</span>
                </div>
              </div>
            </section>

            {isAccepted && (
              <div className="mt-6 rounded-2xl bg-green-100 p-4 text-green-800">
                <p className="font-semibold">
                  {tr(locale, "mission.acceptedThanks", { name: cleaner?.first_name ?? "" })}
                </p>
                <p className="mt-1 text-sm">
                  {t(locale, "mission.acceptedOwnerInfo")}
                </p>
                <Link
                  href={`/mission/${token}/report`}
                  className="mt-4 block w-full rounded-2xl bg-emerald-600 px-4 py-4 text-center text-base font-semibold text-white"
                >
                  {t(locale, "mission.startReport")}
                </Link>
              </div>
            )}

            {isRefused && (
              <div className="mt-6 rounded-2xl bg-red-100 p-4 text-red-800">
                <p className="font-semibold">{t(locale, "mission.refused")}</p>
                {mission.refusal_reason && (
                  <p className="mt-1 text-sm">{mission.refusal_reason}</p>
                )}
              </div>
            )}

            {isPending && (
              <section className="mt-6 space-y-4">
                <form action={acceptMission}>
                  <input type="hidden" name="token" value={token} />
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-slate-900 px-4 py-4 font-semibold text-white"
                  >
                    {t(locale, "mission.accept")}
                  </button>
                </form>

                <details className="rounded-2xl bg-slate-50 p-4">
                  <summary className="cursor-pointer text-center text-sm font-medium text-slate-500">
                    {t(locale, "mission.cannotAccept")}
                  </summary>

                  <form action={refuseMission} className="mt-4">
                    <input type="hidden" name="token" value={token} />

                    <label
                      htmlFor="reason"
                      className="block text-sm font-medium text-slate-700"
                    >
                      {t(locale, "mission.refusalReasonLabel")}
                    </label>

                    <textarea
                      id="reason"
                      name="reason"
                      required
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-slate-900"
                      placeholder={t(locale, "mission.reasonPlaceholder")}
                    />

                    <button
                      type="submit"
                      className="mt-3 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700"
                    >
                      {t(locale, "mission.confirmRefusal")}
                    </button>
                  </form>
                </details>
              </section>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          {t(locale, "common.privateLink")}
        </p>
      </div>

      <CleanerBottomNav
        cleanerToken={cleaner?.public_token}
        missionToken={token}
        active="missions"
        locale={locale}
      />
    </main>
  );
}