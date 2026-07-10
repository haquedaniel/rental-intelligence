import { loginAdmin } from "./actions";
export const dynamic = "force-dynamic";
type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const hasError = resolvedSearchParams?.error === "1";

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-4 py-10">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#112532]/45 ring-1 ring-[#112532]/8"><span className="h-2 w-2 rounded-full bg-[#E0680E]" />Pilotys · opération</div>
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-[#112532]/48">
          Back office
        </p>

        <h1 className="mt-2 text-2xl font-bold text-[#112532]">
          Connexion admin
        </h1>

        <form action={loginAdmin} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-[#112532]/86"
            >
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-[#112532]"
            />
          </div>

          {hasError && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
              Mot de passe incorrect.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
          >
            Se connecter
          </button>
        </form>
      </div>
    </main>
  );
}
