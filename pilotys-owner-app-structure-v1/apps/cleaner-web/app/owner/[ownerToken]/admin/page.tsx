import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import OwnerBottomNav, { OwnerTopNav } from "@/components/owner/OwnerBottomNav";

export const dynamic = "force-dynamic";

const cards = [
  {
    title: "Stratégie tarifaire",
    description: "Prix de base, saisons, courbes d’optimisation et règles de publication.",
    suffix: "/pricing/settings",
    icon: "€",
  },
  {
    title: "Journal et briefings",
    description: "Choisir les événements suivis, la fréquence et prévisualiser les messages.",
    suffix: "/activity?tab=briefings",
    icon: "◴",
  },
  {
    title: "Paiements",
    description: "Consulter les demandes à payer et leur historique.",
    suffix: "/operations/payments",
    icon: "✓",
  },
];

export default async function OwnerAdminPage({
  params,
}: {
  params: Promise<{ ownerToken: string }>;
}) {
  const { ownerToken } = await params;
  const db = getSupabaseAdmin();
  const { data: owner } = await db
    .from("owners")
    .select("id,display_name,name")
    .eq("public_token", decodeURIComponent(ownerToken))
    .eq("active", true)
    .maybeSingle();
  if (!owner) notFound();

  const base = `/owner/${encodeURIComponent(ownerToken)}`;

  return (
    <main className="min-h-screen bg-[#F4F8FA] px-4 pb-28 pt-5 text-[#112532]">
      <div className="mx-auto max-w-5xl">
        <OwnerTopNav active="admin" />
        <div className="mt-8">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#E0680E]">Réglages</p>
          <h1 className="mt-1 text-3xl font-black">Configurer votre espace Pilotys</h1>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[#112532]/55">
            Cette page regroupe uniquement les réglages utiles au propriétaire. Les outils techniques Pilotys restent dans un back office séparé.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <Link key={card.title} href={`${base}${card.suffix}`} className="rounded-[1.7rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#112532] text-lg font-black text-white">{card.icon}</span>
              <h2 className="mt-4 text-xl font-black">{card.title}</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-[#112532]/55">{card.description}</p>
              <p className="mt-4 text-sm font-black text-[#E0680E]">Ouvrir →</p>
            </Link>
          ))}
        </div>

        <section className="mt-6 rounded-[1.7rem] bg-white p-5 ring-1 ring-[#112532]/8">
          <h2 className="text-xl font-black">À venir</h2>
          <p className="mt-2 text-sm font-bold text-[#112532]/55">Logements, accès utilisateurs, coordonnées de facturation et intégrations seront ajoutés ici lorsqu’ils seront prêts pour les propriétaires.</p>
        </section>
      </div>
      <OwnerBottomNav active="admin" />
    </main>
  );
}
