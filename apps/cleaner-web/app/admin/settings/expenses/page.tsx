import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import OwnerBottomNav from "@/components/owner/OwnerBottomNav";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExpenseRule = {
  ruleId: string;
  category?: string;
  costFamily?: string;
  calculationType?: string;
  amount?: string;
  percentage?: string;
  listingIds: string[];
  portfolioIds: string[];
  unitIds: string[];
  startDate?: string;
  endDate?: string;
  blockStart: number;
  blockEnd: number;
};

async function findExpenseConfigPath(): Promise<string | null> {
  if (process.env.EXPENSE_CONFIG_PATH) {
    return process.env.EXPENSE_CONFIG_PATH;
  }

  let current = process.cwd();

  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(
      current,
      "config",
      "clients",
      "daniel_aurore_expenses.yaml",
    );

    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep walking upwards
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

function simpleValue(block: string, key: string): string | undefined {
  const match = block.match(new RegExp(`^\\s{2}${key}:\\s*(.*)$`, "m"));
  const value = match?.[1]?.trim();

  if (!value || value === "null") return undefined;
  return value.replace(/^["']|["']$/g, "");
}

function listValue(block: string, key: string): string[] {
  const lines = block.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(new RegExp(`^(\\s*)${key}:\\s*(.*)$`));
    if (!match) continue;

    const indent = match[1].length;
    const rest = match[2].trim();

    if (rest.startsWith("[") && rest.endsWith("]")) {
      return rest
        .slice(1, -1)
        .split(",")
        .map((x) => x.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }

    const values: string[] = [];

    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];

      if (!next.trim()) continue;

      const nextIndent = next.search(/\S/);
      if (nextIndent <= indent) break;

      const item = next.match(/^\s*-\s*(.*)$/);
      if (item) {
        values.push(item[1].trim().replace(/^["']|["']$/g, ""));
      }
    }

    return values;
  }

  return [];
}

function parseRules(text: string): ExpenseRule[] {
  const starts: Array<{ index: number; ruleId: string }> = [];
  const ruleStartRegex = /^-\s+rule_id:\s*(.+)$/gm;

  let match: RegExpExecArray | null;

  while ((match = ruleStartRegex.exec(text)) !== null) {
    starts.push({
      index: match.index,
      ruleId: match[1].trim().replace(/^["']|["']$/g, ""),
    });
  }

  return starts.map((start, idx) => {
    const end = starts[idx + 1]?.index ?? text.length;
    const block = text.slice(start.index, end);

    return {
      ruleId: start.ruleId,
      category: simpleValue(block, "category"),
      costFamily: simpleValue(block, "cost_family"),
      calculationType: simpleValue(block, "calculation_type"),
      amount: simpleValue(block, "amount"),
      percentage: simpleValue(block, "percentage"),
      listingIds: listValue(block, "listing_ids"),
      portfolioIds: listValue(block, "portfolio_ids"),
      unitIds: listValue(block, "unit_ids"),
      startDate: simpleValue(block, "start_date"),
      endDate: simpleValue(block, "end_date"),
      blockStart: start.index,
      blockEnd: end,
    };
  });
}

function displayTargets(rule: ExpenseRule): string {
  const parts = [
    rule.listingIds.length ? `Listings: ${rule.listingIds.join(", ")}` : "",
    rule.portfolioIds.length ? `Portfolios: ${rule.portfolioIds.join(", ")}` : "",
    rule.unitIds.length ? `Lots: ${rule.unitIds.join(", ")}` : "",
  ].filter(Boolean);

  return parts.join(" · ") || "Cible globale / non précisée";
}

function editableField(rule: ExpenseRule): "amount" | "percentage" {
  return rule.percentage !== undefined ? "percentage" : "amount";
}

function cleanNumber(value: string): string {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error("Montant invalide.");
  }

  return Number.isInteger(parsed) ? String(parsed) : String(parsed);
}

async function updateExpenseAmount(formData: FormData) {
  "use server";

  await requireAdmin();

  const configPath = await findExpenseConfigPath();

  if (!configPath) {
    throw new Error("Fichier de dépenses introuvable.");
  }

  const ruleId = String(formData.get("rule_id") ?? "").trim();
  const field = String(formData.get("field") ?? "").trim();
  const rawValue = String(formData.get("value") ?? "").trim();

  if (!ruleId || !["amount", "percentage"].includes(field)) {
    throw new Error("Règle ou champ invalide.");
  }

  const value = cleanNumber(rawValue);
  const text = await fs.readFile(configPath, "utf8");
  const rules = parseRules(text);
  const rule = rules.find((r) => r.ruleId === ruleId);

  if (!rule) {
    throw new Error(`Règle introuvable : ${ruleId}`);
  }

  const block = text.slice(rule.blockStart, rule.blockEnd);
  const fieldRegex = new RegExp(`^(\\s{2}${field}:\\s*).*$`, "m");

  let updatedBlock: string;

  if (fieldRegex.test(block)) {
    updatedBlock = block.replace(fieldRegex, `$1${value}`);
  } else {
    const calculationRegex = /^(\s{2}calculation_type:\s*.*)$/m;

    if (calculationRegex.test(block)) {
      updatedBlock = block.replace(calculationRegex, `$1\n  ${field}: ${value}`);
    } else {
      updatedBlock = block.replace(/\n$/, `\n  ${field}: ${value}\n`);
    }
  }

  const updatedText =
    text.slice(0, rule.blockStart) + updatedBlock + text.slice(rule.blockEnd);

  const backupPath = `${configPath}.backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;

  await fs.copyFile(configPath, backupPath);
  await fs.writeFile(configPath, updatedText, "utf8");

  revalidatePath("/admin/settings/expenses");
}

function categoryLabel(value?: string): string {
  const labels: Record<string, string> = {
    cleaning_actual_cost: "Ménage",
    loan_payment: "Emprunt",
    copro_charges: "Copropriété",
    concierge: "Conciergerie",
    insurance: "Assurance",
    utilities: "Charges / énergie",
    tax: "Taxes",
    maintenance: "Maintenance",
  };

  return labels[value ?? ""] ?? value ?? "Autre";
}

export default async function ExpensesSettingsPage() {
  await requireAdmin();

  const configPath = await findExpenseConfigPath();

  if (!configPath) {
    return (
      <main className="min-h-screen bg-[#F6F3EF] px-3 py-4 text-[#112532] sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] bg-white/92 p-6 shadow-sm ring-1 ring-[#112532]/8">
          <Link href="/admin/settings" className="text-sm font-bold text-[#112532]/48">
            ← Back office
          </Link>
          <h1 className="mt-4 text-3xl font-black">Dépenses</h1>
          <p className="mt-2 text-sm font-semibold text-red-700">
            Fichier introuvable. Ajoutez EXPENSE_CONFIG_PATH ou vérifiez que
            config/clients/daniel_aurore_expenses.yaml est bien dans l’image Docker.
          </p>
        </div>
      </main>
    );
  }

  const text = await fs.readFile(configPath, "utf8");
  const rules = parseRules(text);
  const editableRules = rules.filter(
    (rule) => rule.amount !== undefined || rule.percentage !== undefined,
  );

  const totalFixed = editableRules.reduce((sum, rule) => {
    if (rule.amount === undefined) return sum;
    const n = Number(rule.amount);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);

  const categories = Array.from(
    new Set(editableRules.map((rule) => rule.category ?? "other")),
  ).sort();

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-3 py-4 text-[#112532] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin/settings" className="text-sm font-bold text-[#112532]/48">
              ← Back office
            </Link>
            <h1 className="mt-4 text-3xl font-black tracking-tight">
              Dépenses
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-[#112532]/48">
              Première version : visualisation et modification des montants du fichier YAML.
              Les règles, dates, logements et méthodes de calcul ne changent pas.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-4 text-right shadow-sm ring-1 ring-[#112532]/10">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
              Fichier
            </p>
            <p className="mt-1 max-w-[360px] truncate text-xs font-bold text-[#112532]/60">
              {configPath}
            </p>
            <p className="mt-2 text-sm font-black text-[#112532]">
              {editableRules.length} montant(s)
            </p>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.75rem] bg-white/92 p-4 shadow-sm ring-1 ring-[#112532]/8">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
              Total montants fixes listés
            </p>
            <p className="mt-2 text-2xl font-black">
              {totalFixed.toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
              })}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#112532]/48">
              Simple total brut des champs amount visibles, sans appliquer les règles.
            </p>
          </div>

          <div className="rounded-[1.75rem] bg-white/92 p-4 shadow-sm ring-1 ring-[#112532]/8">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
              Règles totales
            </p>
            <p className="mt-2 text-2xl font-black">{rules.length}</p>
            <p className="mt-1 text-xs font-semibold text-[#112532]/48">
              Certaines règles n’ont pas de montant modifiable.
            </p>
          </div>

          <div className="rounded-[1.75rem] bg-white/92 p-4 shadow-sm ring-1 ring-[#112532]/8">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
              Catégories
            </p>
            <p className="mt-2 text-2xl font-black">{categories.length}</p>
            <p className="mt-1 text-xs font-semibold text-[#112532]/48">
              {categories.map(categoryLabel).join(", ")}
            </p>
          </div>
        </section>

        {categories.map((category) => {
          const categoryRules = editableRules.filter((rule) => rule.category === category);

          return (
            <section key={category} className="space-y-3">
              <h2 className="text-xl font-black text-[#112532]">
                {categoryLabel(category)}
              </h2>

              <div className="grid gap-3">
                {categoryRules.map((rule) => {
                  const field = editableField(rule);
                  const value = field === "percentage" ? rule.percentage : rule.amount;

                  return (
                    <form
                      key={rule.ruleId}
                      action={updateExpenseAmount}
                      className="rounded-[1.75rem] bg-white/92 p-4 shadow-sm ring-1 ring-[#112532]/8"
                    >
                      <input type="hidden" name="rule_id" value={rule.ruleId} />
                      <input type="hidden" name="field" value={field} />

                      <div className="grid gap-4 md:grid-cols-[1fr_190px_120px] md:items-end">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[#112532]/6 px-2 py-1 text-[10px] font-black text-[#112532]/60">
                              {rule.costFamily ?? "cost"}
                            </span>
                            <span className="rounded-full bg-[#112532]/6 px-2 py-1 text-[10px] font-black text-[#112532]/60">
                              {rule.calculationType ?? "calculation"}
                            </span>
                            <span className="rounded-full bg-[#112532]/6 px-2 py-1 text-[10px] font-black text-[#112532]/60">
                              {rule.startDate ?? "—"} → {rule.endDate ?? "∞"}
                            </span>
                          </div>

                          <h3 className="mt-3 text-base font-black text-[#112532]">
                            {rule.ruleId}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-[#112532]/48">
                            {displayTargets(rule)}
                          </p>
                        </div>

                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
                            {field === "percentage" ? "Pourcentage" : "Montant"}
                          </span>
                          <div className="mt-1 flex rounded-2xl border border-[#112532]/10 bg-[#F6F3EF]">
                            <input
                              name="value"
                              defaultValue={value ?? ""}
                              className="min-w-0 flex-1 rounded-2xl bg-transparent px-3 py-2 text-right text-sm font-black text-[#112532] outline-none"
                            />
                            <span className="px-3 py-2 text-sm font-black text-[#112532]/36">
                              {field === "percentage" ? "%" : "€"}
                            </span>
                          </div>
                        </label>

                        <button className="rounded-full bg-[#E0680E] px-4 py-2 text-sm font-black text-white shadow-sm shadow-[#E0680E]/20">
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
          <OwnerBottomNav active="settings" />
</main>
  );
}
