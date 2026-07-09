// Optional replacement for app/owner/cockpit/page.tsx
// Keeps the old generic route away from the admin planning page.
// For MVP, redirect manually to the first active owner, or remove this route.

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function LegacyOwnerCockpitRedirect() {
  await requireAdmin();

  const supabase = getSupabaseAdmin();
  const { data: owner } = await supabase
    .from("owners")
    .select("public_token")
    .eq("active", true)
    .order("display_name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!owner?.public_token) redirect("/admin/owners");

  redirect(`/owner/${owner.public_token}/cockpit`);
}
