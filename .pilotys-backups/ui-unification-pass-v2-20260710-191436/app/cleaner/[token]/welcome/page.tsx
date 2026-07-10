import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCleanerLocale, type CleanerLocale } from "@/lib/cleanerI18n";
import { completeCleanerOnboarding } from "./actions";

export const dynamic = "force-dynamic";

const COPY = {
  fr: {
    title: (name: string) => `Bienvenue ${name} 👋`,
    subtitle: "Pilotys vous aide à gérer vos missions simplement, depuis votre téléphone.",
    bullets: [
      "Voir vos missions à confirmer",
      "Consulter votre planning par logement",
      "Envoyer les photos de fin de ménage",
      "Suivre vos paiements",
    ],
    installTitle: "Ajoutez Pilotys à votre écran d’accueil",
    iphone: "iPhone : ouvrez dans Safari, appuyez sur Partager, puis “Sur l’écran d’accueil”.",
    android: "Android : ouvrez le menu ⋮, puis “Installer l’application” ou “Ajouter à l’écran d’accueil”.",
    waiting: (count: number) =>
      count > 0
        ? `Vous avez déjà ${count} mission(s) à voir. Nous allons vous les montrer juste après.`
        : "Aucune mission urgente pour le moment. Vous pourrez revenir ici dès qu’une mission arrive.",
    button: "Voir mes missions",
  },
  en: {
    title: (name: string) => `Welcome ${name} 👋`,
    subtitle: "Pilotys helps you manage your cleaning missions from your phone.",
    bullets: [
      "See missions waiting for confirmation",
      "Check your schedule by property",
      "Send end-of-cleaning photos",
      "Track your payments",
    ],
    installTitle: "Add Pilotys to your home screen",
    iphone: "iPhone: open in Safari, tap Share, then “Add to Home Screen”.",
    android: "Android: open the ⋮ menu, then “Install app” or “Add to Home Screen”.",
    waiting: (count: number) =>
      count > 0
        ? `You already have ${count} mission(s) to review. We’ll show them next.`
        : "No urgent mission right now. You can come back here when a mission arrives.",
    button: "See my missions",
  },
  ru: {
    title: (name: string) => `Добро пожаловать, ${name} 👋`,
    subtitle: "Pilotys помогает управлять заданиями прямо с телефона.",
    bullets: [
      "Смотреть задания для подтверждения",
      "Проверять расписание по объектам",
      "Отправлять фото после уборки",
      "Следить за оплатами",
    ],
    installTitle: "Добавьте Pilotys на главный экран",
    iphone: "iPhone: откройте в Safari, нажмите Поделиться, затем “На экран Домой”.",
    android: "Android: откройте меню ⋮, затем “Установить приложение” или “Добавить на главный экран”.",
    waiting: (count: number) =>
      count > 0
        ? `У вас уже есть ${count} заданий для просмотра. Сейчас мы их покажем.`
        : "Сейчас нет срочных заданий. Вы сможете вернуться, когда появится задание.",
    button: "Посмотреть задания",
  },
} as const;

function copy(locale: CleanerLocale) {
  if (locale === "en" || locale === "ru") return COPY[locale];
  return COPY.fr;
}

function firstName(cleaner: Record<string, any>) {
  return cleaner.first_name || cleaner.trading_name || "Sandrine";
}

export default async function CleanerWelcomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: cleaner } = await supabase
    .from("cleaners")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!cleaner) notFound();

  const locale = getCleanerLocale(cleaner.preferred_language);
  const c = copy(locale);

  await supabase
    .from("cleaners")
    .update({
      app_first_opened_at: cleaner.app_first_opened_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cleaner.id);

  const { count } = await supabase
    .from("cleaning_requests")
    .select("id", { count: "exact", head: true })
    .eq("assigned_cleaner_id", cleaner.id)
    .in("status", ["created", "sent", "accepted"]);

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col justify-center">
        <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-amber-100">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-slate-950 text-4xl text-white shadow-sm">
            🏠
          </div>

          <h1 className="mt-6 text-center text-3xl font-black tracking-tight">
            {c.title(firstName(cleaner))}
          </h1>

          <p className="mt-3 text-center text-sm font-semibold text-slate-500">
            {c.subtitle}
          </p>

          <div className="mt-6 space-y-3">
            {c.bullets.map((bullet) => (
              <div key={bullet} className="flex gap-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
                <span>✓</span>
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          <section className="mt-6 rounded-3xl bg-slate-50 p-4">
            <h2 className="text-sm font-black text-slate-950">{c.installTitle}</h2>
            <p className="mt-2 text-xs font-semibold text-slate-600">{c.iphone}</p>
            <p className="mt-2 text-xs font-semibold text-slate-600">{c.android}</p>
          </section>

          <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950">
            {c.waiting(count ?? 0)}
          </p>

          <form action={completeCleanerOnboarding} className="mt-6">
            <input type="hidden" name="cleaner_token" value={token} />
            <button className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-black text-white">
              {c.button}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
