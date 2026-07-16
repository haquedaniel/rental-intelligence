import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import PricingDashboard from "@/components/pricing/PricingDashboard";
import { saveAndRecalculateAdminPricing, saveAdminSeason, deleteAdminSeason, rollbackAdminPricing } from "./actions";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

export default async function Page({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const query = await searchParams;
  const db = getSupabaseAdmin();
  const properties = ((await db.from("properties").select("id,name,status").order("name")).data ?? []) as Row[];
  const propertyId = properties.some((property) => property.id === query.property) ? query.property : properties[0]?.id;
  let settings: Row | null = null;
  let seasons: Row[] = [], calendar: Row[] = [], reservations: Row[] = [], actions: Row[] = [], versions: Row[] = [];

  if (propertyId) {
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 541);
    const endIso = end.toISOString().slice(0, 10);
    const results = await Promise.all([
      db.from("pricing_property_settings").select("*").eq("property_id", propertyId).maybeSingle(),
      db.from("pricing_seasons").select("*").eq("property_id", propertyId).eq("active", true).order("start_date"),
      db.from("pricing_daily_prices").select("*").eq("property_id", propertyId).order("date").limit(540),
      db.from("reservations").select("id,guest_name,guest_first_name,checkin_at,checkout_at,status,channel").eq("property_id", propertyId).lt("checkin_at", `${endIso}T00:00:00`).gt("checkout_at", `${start}T00:00:00`).order("checkin_at"),
      db.from("pricing_publication_actions").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(1000),
      db.from("pricing_configuration_versions").select("*").eq("property_id", propertyId).order("version_number", { ascending: false }).limit(20),
    ]);
    settings = results[0].data as Row | null;
    seasons = (results[1].data ?? []) as Row[];
    calendar = (results[2].data ?? []) as Row[];
    reservations = (results[3].data ?? []) as Row[];
    actions = (results[4].data ?? []) as Row[];
    versions = (results[5].data ?? []) as Row[];
  }

  return <PricingDashboard
    backHref="/admin"
    backLabel="Administration"
    properties={properties}
    propertyId={propertyId}
    settings={settings}
    seasons={seasons}
    calendar={calendar}
    reservations={reservations}
    actions={actions}
    versions={versions}
    saveSettings={saveAndRecalculateAdminPricing}
    saveSeason={saveAdminSeason}
    deleteSeason={deleteAdminSeason}
    rollbackAction={rollbackAdminPricing}
    propertyHref={(id) => `/admin/pricing?property=${encodeURIComponent(id)}`}
  />;
}
