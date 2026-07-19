import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const groups = [
  {
    title: "Pilotage opérationnel",
    items: [
      ["Opérations", "/admin/operations", "Vue quotidienne et demandes de ménage"],
      ["Planning", "/admin/planning-v2", "Planning global réservations et missions"],
      ["Interventions", "/admin/interventions", "Créer et suivre les interventions"],
      ["Paiements", "/admin/payments", "Demandes mensuelles et validation"],
      ["Photos", "/admin/photos", "Contrôle des preuves et photos"],
    ],
  },
  {
    title: "Réseau et configuration",
    items: [
      ["Propriétaires", "/admin/owners", "Comptes propriétaires et accès"],
      ["Intervenantes", "/admin/cleaners", "Profils, statuts et coordonnées"],
      ["Disponibilités", "/admin/cleaner-availability", "Disponibilités des intervenantes"],
      ["Affectations", "/admin/cleaner-assignments", "Logements et missions attribués"],
      ["Types de travail", "/admin/work-types", "Catalogue des prestations"],
      ["Check-lists", "/admin/checklists", "Modèles et tâches obligatoires"],
      ["Réglages", "/admin/settings", "Rappels, dépenses et paramètres globaux"],
    ],
  },
  {
    title: "Tarification et technique",
    items: [
      ["Tarification", "/admin/pricing", "Configuration et contrôle des prix"],
      ["Santé applicative", "/admin/health", "État des services et scripts"],
      ["Santé opérations", "/admin/ops-health", "Fraîcheur des flux opérationnels"],
      ["Laboratoire", "/admin/test-lab", "Outils de test internes"],
    ],
  },
];

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-4 py-6 text-[#112532]">
      <div className="mx-auto max-w-6xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#112532] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white">
          <span className="h-2 w-2 rounded-full bg-[#E0680E]" />
          Pilotys · back office interne
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight">Administration Pilotys</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#112532]/55">
          Espace réservé à l’équipe Pilotys. Il n’est volontairement relié à aucune navigation du webapp propriétaire.
        </p>

        <div className="mt-8 space-y-7">
          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="text-xl font-black">{group.title}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(([title, href, description]) => (
                  <Link key={href} href={href} className="rounded-[1.4rem] bg-white p-5 shadow-sm ring-1 ring-[#112532]/8 transition hover:-translate-y-0.5 hover:shadow-md">
                    <h3 className="text-lg font-black">{title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-5 text-[#112532]/50">{description}</p>
                    <p className="mt-4 text-xs font-black text-[#E0680E]">Ouvrir →</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
