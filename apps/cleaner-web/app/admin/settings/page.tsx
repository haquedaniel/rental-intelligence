import Link from "next/link";
import OwnerBottomNav from "@/components/owner/OwnerBottomNav";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

type Card = {
  section: string;
  emoji: string;
  title: string;
  subtitle: string;
  href?: string;
  status: "ready" | "legacy" | "soon" | "sensitive" | "dev";
};

const cards: Card[] = [
  {
    section: "Cockpit",
    emoji: "🧭",
    title: "Planning propriétaire",
    subtitle: "Page de pilotage quotidienne : KPIs, calendrier, alertes et filtres.",
    href: "/admin/planning-v2",
    status: "ready",
  },
  {
    section: "Automatisations",
    emoji: "🔔",
    title: "Rappels ménage",
    subtitle: "Règles J-7, J-1, matin même, 2h avant et contenu des SMS.",
    href: "/admin/settings/reminders",
    status: "ready",
  },

  {
    section: "Équipe ménage",
    emoji: "🧹",
    title: "Intervenantes",
    subtitle: "Liste des intervenantes, coordonnées, profil et statut.",
    href: "/admin/cleaners",
    status: "ready",
  },
  {
    section: "Équipe ménage",
    emoji: "📆",
    title: "Disponibilités",
    subtitle: "Disponibilités, exceptions et périodes d’absence.",
    href: "/admin/cleaner-availability",
    status: "ready",
  },
  {
    section: "Équipe ménage",
    emoji: "🔗",
    title: "Affectations logements",
    subtitle: "Qui intervient sur quel logement, priorité et rôle.",
    href: "/admin/cleaner-assignments",
    status: "ready",
  },
  {
    section: "Équipe ménage",
    emoji: "🧰",
    title: "Types de mission",
    subtitle: "Ménage standard, long séjour, deep clean, inspection, etc.",
    href: "/admin/work-types",
    status: "ready",
  },

  {
    section: "Logements & qualité",
    emoji: "✅",
    title: "Checklists",
    subtitle: "Tâches attendues par logement ou type de mission.",
    href: "/admin/checklists",
    status: "ready",
  },
  {
    section: "Logements & qualité",
    emoji: "📸",
    title: "Photos de référence",
    subtitle: "Photos de l’état attendu, contrôles qualité et preuves.",
    href: "/admin/photos",
    status: "ready",
  },
  {
    section: "Logements & qualité",
    emoji: "🏠",
    title: "Onboarding logement",
    subtitle: "Création sécurisée d’un nouveau logement : accès, règles, codes, photos.",
    status: "sensitive",
  },

  {
    section: "Finance",
    emoji: "💶",
    title: "Paiements",
    subtitle: "Suivi des paiements aux intervenantes et futures validations mensuelles.",
    href: "/admin/payments",
    status: "ready",
  },

  {
    section: "Compte & structure",
    emoji: "👥",
    title: "Propriétaires",
    subtitle: "Gestion des propriétaires / clients liés au back office.",
    href: "/admin/owners",
    status: "ready",
  },
  {
    section: "Compte & structure",
    emoji: "🔐",
    title: "Sécurité & accès",
    subtitle: "Tokens, liens publics, audit trail et données sensibles. À construire avant onboarding avancé.",
    status: "sensitive",
  },

  {
    section: "Legacy & outils",
    emoji: "🕰️",
    title: "Ancien écran opérations",
    subtitle: "Ancien tableau de bord opérationnel, conservé comme filet de sécurité.",
    href: "/admin/operations",
    status: "legacy",
  },
  {
    section: "Legacy & outils",
    emoji: "➕",
    title: "Créer une mission manuelle",
    subtitle: "Écran existant de création directe d’une demande ménage.",
    href: "/admin/operations/create-cleaning-request",
    status: "legacy",
  },
  {
    section: "Legacy & outils",
    emoji: "🧪",
    title: "Test lab",
    subtitle: "Outils de test et diagnostics. À garder discret.",
    href: "/admin/test-lab",
    status: "dev",
  },
];

const sectionOrder = [
  "Cockpit",
  "Automatisations",
  "Équipe ménage",
  "Logements & qualité",
  "Finance",
  "Compte & structure",
  "Legacy & outils",
];

function statusLabel(status: Card["status"]) {
  if (status === "ready") return "Disponible";
  if (status === "legacy") return "Ancien";
  if (status === "sensitive") return "À sécuriser";
  if (status === "dev") return "Dev";
  return "À construire";
}

function statusClass(status: Card["status"]) {
  if (status === "ready") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (status === "legacy") return "bg-amber-100 text-amber-900 ring-amber-200";
  if (status === "sensitive") return "bg-red-100 text-red-800 ring-red-200";
  if (status === "dev") return "bg-purple-100 text-purple-800 ring-purple-200";
  return "bg-[#112532]/6 text-[#112532]/60 ring-[#112532]/10";
}

function ConfigCard({ card }: { card: Card }) {
  const inner = (
    <div className="h-full rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-[#112532]/10 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#112532]/6 text-xl">
          {card.emoji}
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${statusClass(card.status)}`}>
          {statusLabel(card.status)}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-black tracking-tight text-[#112532]">
        {card.title}
      </h3>
      <p className="mt-1 text-sm font-semibold leading-snug text-[#112532]/48">
        {card.subtitle}
      </p>

      <div className="mt-4 text-xs font-black text-[#112532]/36">
        {card.href ? "Ouvrir →" : "Bientôt"}
      </div>
    </div>
  );

  if (!card.href) {
    return <div className="h-full opacity-80">{inner}</div>;
  }

  return (
    <Link href={card.href} className="block h-full">
      {inner}
    </Link>
  );
}

export default async function SettingsHomePage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-3 py-4 text-[#112532] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8">
          <span className="h-2 w-2 rounded-full bg-[#E0680E]" />
          Pilotys · pilotage
        </div>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
              Back office
            </p>
            <h1 className="text-3xl font-black tracking-tight">
              Configuration
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-[#112532]/48">
              Le planning sert au quotidien. Cette page sert à organiser le système :
              intervenantes, logements, rappels, paiements, accès et outils.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin/planning-v2"
              className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#112532]/76 shadow-sm ring-1 ring-[#112532]/10"
            >
              Planning
            </Link>
            <Link
              href="/admin"
              className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#112532]/76 shadow-sm ring-1 ring-[#112532]/10"
            >
              Admin
            </Link>
          </div>
        </header>

        <section className="rounded-[1.25rem] bg-[#112532] p-4 text-white shadow-sm">
          <p className="text-sm font-black">Principe de navigation</p>
          <p className="mt-1 text-sm font-semibold text-white/70">
            Les pages <strong>issues</strong> ne sont pas listées ici : elles sont ouvertes depuis la cloche de notifications.
            Les pages <strong>legacy</strong> restent accessibles mais ne doivent plus devenir le parcours principal.
            Les données sensibles des logements devront passer par un onboarding séparé et audité.
          </p>
        </section>

        {sectionOrder.map((section) => {
          const sectionCards = cards.filter((card) => card.section === section);
          if (sectionCards.length === 0) return null;

          return (
            <section key={section} className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wide text-[#112532]/36">
                {section}
              </h2>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sectionCards.map((card) => (
                  <ConfigCard key={card.title} card={card} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
          <OwnerBottomNav active="settings" />
</main>
  );
}
