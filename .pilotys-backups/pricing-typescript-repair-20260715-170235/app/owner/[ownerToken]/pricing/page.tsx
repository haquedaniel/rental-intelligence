import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import PricingDashboard from "@/components/pricing/PricingDashboard";
import { deleteOwnerSeason, saveOwnerPricingSettings, saveOwnerSeason } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tarification · Pilotys" };

type Row = Record<string, any>;
type PageProps = {
  params: Promise<{ ownerToken: string }>;
  searchParams: Promise<{ property?: string }>;
};

export default async function OwnerPricingPage({ params, searchParams }: PageProps) {
  const [{ ownerToken: rawOwnerToken }, query] = await Promise.all([params, searchParams]);
  const ownerToken = decodeURIComponent(rawOwnerToken || "").trim();
  if (!ownerToken) notFound();

  const db = getSupabaseAdmin();
  const { data: owner, error: ownerError } = await db
    .from("owners")
    .select("id,display_name,public_token,active")
    .eq("public_token", ownerToken)
    .eq("active", true)
    .maybeSingle();

  if (ownerError) throw new Error(`Impossible de charger le propriétaire : ${ownerError.message}`);
  if (!owner) notFound();

  const { data: rawProperties, error: propertiesError } = await db
    .from("properties")
    .select("id,name,status,owner_id")
    .eq("owner_id", owner.id)
    .order("name", { ascending: true });

  if (propertiesError) throw new Error(`Impossible de charger les logements : ${propertiesError.message}`);
  const properties = (rawProperties ?? []) as Row[];
  const allowedIds = new Set(properties.map((property) => String(property.id)));

  const requestedPropertyId = String(query.property ?? "");
  const propertyId = requestedPropertyId && allowedIds.has(requestedPropertyId)
    ? requestedPropertyId
    : properties[0]?.id;

  const empty = [{ data: null }, { data: [] }, { data: [] }, { data: [] }] as any;
  const [{ data: settings }, { data: seasons = [] }, { data: calendar = [] }, { data: actions = [] }] = propertyId
    ? await Promise.all([
        db.from("pricing_property_settings").select("*").eq("property_id", propertyId).maybeSingle(),
        db.from("pricing_seasons").select("*").eq("property_id", propertyId).eq("active", true).order("start_date"),
        db.from("pricing_daily_prices").select("*").eq("property_id", propertyId).gte("date", new Date().toISOString().slice(0, 10)).order("date").limit(90),
        db.from("pricing_publication_actions").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(20),
      ])
    : empty;

  const basePath = `/owner/${encodeURIComponent(ownerToken)}/pricing`;
  const cockpitPath = `/owner/${encodeURIComponent(ownerToken)}/cockpit`;

  return (
    <PricingDashboard
      eyebrow={`Pilotys · ${owner.display_name ?? "Propriétaire"}`}
      properties={properties}
      propertyId={propertyId}
      settings={settings}
      seasons={seasons}
      calendar={calendar}
      actions={actions}
      basePath={basePath}
      backHref={cockpitPath}
      backLabel="Cockpit"
      ownerToken={ownerToken}
      savePricingSettings={saveOwnerPricingSettings}
      saveSeason={saveOwnerSeason}
      deleteSeason={deleteOwnerSeason}
    />
  );
}
