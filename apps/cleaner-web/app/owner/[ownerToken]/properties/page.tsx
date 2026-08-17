import Link from "next/link";
import { notFound } from "next/navigation";
import OwnerBottomNav, { OwnerTopNav } from "@/components/owner/OwnerBottomNav";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ ownerToken: string }>;
};

export default async function OwnerPropertiesPage({ params }: PageProps) {
  const { ownerToken } = await params;
  const token = decodeURIComponent(ownerToken || "").trim();
  const supabase = getSupabaseAdmin();

  const { data: owner } = await supabase
    .from("owners")
    .select("id,display_name")
    .eq("public_token", token)
    .eq("active", true)
    .maybeSingle();

  if (!owner) notFound();

  const { data: properties, error: propertyError } = await supabase
    .from("properties")
    .select("id,name,address")
    .eq("owner_id", owner.id)
    .order("name", { ascending: true });

  if (propertyError) {
    throw new Error(`Impossible de charger les logements: ${propertyError.message}`);
  }

  const propertyIds = (properties ?? []).map((property) => property.id);
  const coverByProperty = new Map<string, string>();
  const photoCountByProperty = new Map<string, number>();

  if (propertyIds.length > 0) {
    const { data: photos } = await supabase
      .from("property_listing_photos")
      .select("property_id,storage_bucket,storage_path,sort_order")
      .in("property_id", propertyIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    for (const photo of photos ?? []) {
      const propertyId = String(photo.property_id);
      photoCountByProperty.set(propertyId, (photoCountByProperty.get(propertyId) ?? 0) + 1);
      if (!coverByProperty.has(propertyId)) {
        const { data } = supabase.storage
          .from(photo.storage_bucket || "property-listing-photos")
          .getPublicUrl(photo.storage_path);
        if (data.publicUrl) coverByProperty.set(propertyId, data.publicUrl);
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-4 pb-28 pt-5 text-[#112532] md:px-8 md:pb-10">
      <div className="mx-auto max-w-6xl">
        <OwnerTopNav active="properties" />

        <header className="mt-10 max-w-2xl">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#E0680E]">
            Logements
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            Vos logements, une seule source de vérité.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#112532]/58">
            Commencez par les photos. Pilotys gardera la galerie maître et préparera sa diffusion vers vos canaux.
          </p>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(properties ?? []).map((property) => {
            const cover = coverByProperty.get(String(property.id));
            const count = photoCountByProperty.get(String(property.id)) ?? 0;
            const href = `/owner/${ownerToken}/properties/${property.id}/photos`;

            return (
              <Link
                key={property.id}
                href={href}
                className="group overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-[#112532]/8 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="aspect-[16/10] bg-[#DCE7EA]">
                  {cover ? (
                    <img src={cover} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="grid h-full place-items-center text-5xl text-[#112532]/18">⌂</div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black">{property.name}</h2>
                      {property.address && (
                        <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#112532]/45">
                          {property.address}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-[#F1F5F6] px-3 py-1.5 text-[10px] font-black text-[#112532]/60">
                      {count} photo{count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm font-black">
                    <span>Gérer les photos</span>
                    <span className="text-[#E0680E]">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        {(properties ?? []).length === 0 && (
          <div className="mt-8 rounded-[2rem] bg-white p-8 text-sm font-semibold text-[#112532]/55 ring-1 ring-[#112532]/8">
            Aucun logement n’est encore associé à ce compte.
          </div>
        )}
      </div>

      <OwnerBottomNav active="properties" />
    </main>
  );
}
