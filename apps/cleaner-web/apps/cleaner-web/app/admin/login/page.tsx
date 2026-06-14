import { loginAdmin } from "./actions";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const hasError = resolvedSearchParams?.error === "1";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Back office
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Connexion admin
        </h1>

        <form action={loginAdmin} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-800"
            >
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-950"
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
