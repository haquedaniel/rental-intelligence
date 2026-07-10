import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCleanerLocale } from "@/lib/cleanerI18n";
import { CleanerBottomNav } from "@/components/navigation/CleanerBottomNav";

type CleanerNavActive = "missions" | "planning" | "payments" | "profile";

export default async function CleanerMissionNav({
  missionToken,
  active = "missions",
}: {
  missionToken: string;
  active?: CleanerNavActive;
}) {
  const supabase = getSupabaseAdmin();

  const { data: request } = await supabase
    .from("cleaning_requests")
    .select("assigned_cleaner_id")
    .eq("public_token", missionToken)
    .maybeSingle();

  if (!request?.assigned_cleaner_id) return null;

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("public_token,preferred_language")
    .eq("id", request.assigned_cleaner_id)
    .maybeSingle();

  if (!cleaner?.public_token) return null;

  const locale = getCleanerLocale(cleaner.preferred_language);

  return (
    <CleanerBottomNav
      cleanerToken={cleaner.public_token}
      active={active}
      locale={locale}
    />
  );
}
