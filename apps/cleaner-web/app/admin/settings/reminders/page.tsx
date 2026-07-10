import Link from "next/link";
import OwnerBottomNav from "@/components/owner/OwnerBottomNav";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type ReminderRule = {
  id: string;
  rule_key: string;
  label: string;
  enabled: boolean;
  trigger_event: string;
  timing_type: "minutes_before" | "day_of_at_time";
  minutes_before: number | null;
  local_time: string | null;
  channel: string;
  provider: string;
  grace_minutes: number;
  message_template: string;
};

function intOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function cleanTime(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return raw.length === 5 ? `${raw}:00` : raw;
}

function humanTiming(rule: ReminderRule): string {
  if (rule.timing_type === "day_of_at_time") {
    return `Le jour même à ${(rule.local_time || "09:00").slice(0, 5)}`;
  }

  const minutes = Number(rule.minutes_before || 0);
  if (minutes === 10080) return "7 jours avant";
  if (minutes === 1440) return "1 jour avant";
  if (minutes === 120) return "2 heures avant";
  if (minutes % 1440 === 0) return `${minutes / 1440} jours avant`;
  if (minutes % 60 === 0) return `${minutes / 60} heures avant`;
  return `${minutes} minutes avant`;
}

function previewSms(template: string): string {
  return template
    .replaceAll("{cleaner_first_name}", "Sophie")
    .replaceAll("{cleaner_name}", "Sophie Martin")
    .replaceAll("{property_name}", "La Peskerezh")
    .replaceAll("{scheduled_text}", "27/06/2026 à 10h00")
    .replaceAll("{mission_link}", "https://missions.leclosdelavoilerie.com/mission/exemple");
}

async function updateReminderRule(formData: FormData) {
  "use server";

  await requireAdmin();
  const supabase = getSupabaseAdmin();

  const id = String(formData.get("id") || "");
  const label = String(formData.get("label") || "").trim();
  const enabled = formData.get("enabled") === "on";
  const timingType = String(formData.get("timing_type") || "minutes_before") as
    | "minutes_before"
    | "day_of_at_time";

  const minutesBefore =
    timingType === "minutes_before"
      ? intOrNull(formData.get("minutes_before"))
      : null;

  const localTime =
    timingType === "day_of_at_time"
      ? cleanTime(formData.get("local_time"))
      : null;

  const graceMinutes = intOrNull(formData.get("grace_minutes")) ?? 180;
  const messageTemplate = String(formData.get("message_template") || "").trim();

  if (!id || !label || !messageTemplate) {
    throw new Error("Règle invalide : label et message obligatoires.");
  }

  const { error } = await supabase
    .from("cleaning_reminder_rules")
    .update({
      label,
      enabled,
      timing_type: timingType,
      minutes_before: minutesBefore,
      local_time: localTime,
      grace_minutes: graceMinutes,
      message_template: messageTemplate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Impossible de sauvegarder la règle : ${error.message}`);
  }

  revalidatePath("/admin/settings/reminders");
}

async function createReminderRule(formData: FormData) {
  "use server";

  await requireAdmin();
  const supabase = getSupabaseAdmin();

  const ruleKey = String(formData.get("rule_key") || "").trim();
  const label = String(formData.get("label") || "").trim();
  const minutesBefore = intOrNull(formData.get("minutes_before")) ?? 10080;
  const messageTemplate = String(formData.get("message_template") || "").trim();

  if (!ruleKey || !label || !messageTemplate) {
    throw new Error("Nouvelle règle invalide.");
  }

  const { error } = await supabase.from("cleaning_reminder_rules").insert({
    rule_key: ruleKey,
    label,
    enabled: true,
    trigger_event: "accepted_cleaning",
    timing_type: "minutes_before",
    minutes_before: minutesBefore,
    local_time: null,
    channel: "sms",
    provider: "twilio",
    grace_minutes: 180,
    message_template: messageTemplate,
  });

  if (error) {
    throw new Error(`Impossible de créer la règle : ${error.message}`);
  }

  revalidatePath("/admin/settings/reminders");
}

function RuleCard({ rule }: { rule: ReminderRule }) {
  return (
    <form
      action={updateReminderRule}
      className="rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-[#112532]/10"
    >
      <input type="hidden" name="id" value={rule.id} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                rule.enabled ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
              {rule.rule_key}
            </p>
          </div>

          <input
            name="label"
            defaultValue={rule.label}
            className="mt-1 w-full rounded-xl border border-transparent bg-transparent text-xl font-black tracking-tight text-[#112532] outline-none focus:border-[#112532]/10 focus:bg-[#F6F3EF] focus:px-2"
          />

          <p className="mt-1 text-xs font-semibold text-[#112532]/48">
            {humanTiming(rule)} · délai rattrapage {rule.grace_minutes} min
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-full bg-[#112532]/6 px-3 py-2 text-xs font-black text-[#112532]/76">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={rule.enabled}
            className="h-4 w-4 accent-slate-950"
          />
          Activé
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
            Type de rappel
          </span>
          <select
            name="timing_type"
            defaultValue={rule.timing_type}
            className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-2 text-sm font-black text-[#112532]"
          >
            <option value="minutes_before">X minutes avant</option>
            <option value="day_of_at_time">Jour même à une heure fixe</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
            Minutes avant
          </span>
          <input
            type="number"
            name="minutes_before"
            min="0"
            defaultValue={rule.minutes_before ?? ""}
            placeholder="1440"
            className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-2 text-sm font-black text-[#112532]"
          />
          <p className="mt-1 text-[10px] font-semibold text-[#112532]/36">
            10080 = J-7 · 1440 = J-1 · 120 = 2h
          </p>
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
            Heure jour même
          </span>
          <input
            type="time"
            name="local_time"
            defaultValue={(rule.local_time || "").slice(0, 5)}
            className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-2 text-sm font-black text-[#112532]"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
            Rattrapage max
          </span>
          <input
            type="number"
            name="grace_minutes"
            min="0"
            defaultValue={rule.grace_minutes}
            className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-2 text-sm font-black text-[#112532]"
          />
          <p className="mt-1 text-[10px] font-semibold text-[#112532]/36">
            Évite les vieux SMS si le script était arrêté.
          </p>
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
            Message SMS
          </span>
          <textarea
            name="message_template"
            defaultValue={rule.message_template}
            rows={11}
            className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-3 font-mono text-xs font-semibold text-[#112532]"
          />
        </label>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
            Aperçu
          </p>
          <div className="mt-1 min-h-[220px] whitespace-pre-wrap rounded-2xl bg-[#112532] p-4 text-xs font-semibold text-white shadow-inner">
            {previewSms(rule.message_template)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-2xl bg-[#F6F3EF] px-3 py-2 text-[10px] font-semibold text-[#112532]/48 ring-1 ring-slate-100">
          Variables : {"{cleaner_first_name}"}, {"{cleaner_name}"}, {"{property_name}"},{" "}
          {"{scheduled_text}"}, {"{mission_link}"}
        </div>

        <button
          type="submit"
          className="rounded-full bg-[#112532] px-4 py-2 text-xs font-black text-white"
        >
          Sauvegarder
        </button>
      </div>
    </form>
  );
}

export default async function ReminderSettingsPage() {
  await requireAdmin();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cleaning_reminder_rules")
    .select("*")
    .eq("trigger_event", "accepted_cleaning")
    .order("minutes_before", { ascending: false, nullsFirst: false })
    .order("local_time", { ascending: true });

  if (error) {
    throw new Error(`Impossible de charger les règles de rappel : ${error.message}`);
  }

  const rules = (data ?? []) as ReminderRule[];

  return (
    <main className="min-h-screen bg-[#F6F3EF] px-3 py-4 text-[#112532] sm:px-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
              Paramètres
            </p>
            <h1 className="text-3xl font-black tracking-tight">Rappels ménage</h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold text-[#112532]/48">
              Configure les rappels envoyés aux intervenantes après acceptation d’une mission.
            </p>
          </div>

          <Link
            href="/owner/cockpit"
            className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#112532]/76 shadow-sm ring-1 ring-[#112532]/10"
          >
            Retour planning
          </Link>
        </header>

        <section className="rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-[#112532]/10">
          <h2 className="text-sm font-black text-[#112532]">Créer un rappel simple</h2>

          <form action={createReminderRule} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_160px_auto] md:items-end">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
                Clé
              </span>
              <input
                name="rule_key"
                placeholder="accepted_j_minus_3"
                className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-2 text-sm font-black text-[#112532]"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
                Nom
              </span>
              <input
                name="label"
                placeholder="Rappel J-3"
                className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-2 text-sm font-black text-[#112532]"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wide text-[#112532]/36">
                Minutes avant
              </span>
              <input
                name="minutes_before"
                type="number"
                defaultValue={4320}
                className="mt-1 w-full rounded-2xl border border-[#112532]/10 bg-[#F6F3EF] px-3 py-2 text-sm font-black text-[#112532]"
              />
            </label>

            <input
              type="hidden"
              name="message_template"
              value={"Bonjour {cleaner_first_name} 👋\n\nPetit rappel pour la mission ménage acceptée.\n\n🏠 {property_name}\n📅 {scheduled_text}\n\nDétail mission :\n{mission_link}\n\nMerci !"}
            />

            <button
              type="submit"
              className="rounded-full bg-[#112532] px-4 py-2 text-xs font-black text-white"
            >
              Créer
            </button>
          </form>
        </section>

        <div className="space-y-4">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      </div>
          <OwnerBottomNav active="settings" />
</main>
  );
}
