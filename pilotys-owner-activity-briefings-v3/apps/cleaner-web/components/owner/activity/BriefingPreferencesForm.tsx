"use client";

import { useActionState } from "react";
import {
  saveBriefingPreferences,
  type SavePreferencesState,
} from "@/app/owner/[ownerToken]/activity/actions";

const initialState: SavePreferencesState = { status: "idle" };

export default function BriefingPreferencesForm({
  ownerToken,
  properties,
  pref,
  checks,
}: {
  ownerToken: string;
  properties: Array<{ id: string; name: string }>;
  pref: Record<string, any>;
  checks: ReadonlyArray<readonly [string, string]>;
}) {
  const [state, action, pending] = useActionState(
    saveBriefingPreferences,
    initialState,
  );
  const selected = new Set(
    pref.included_property_ids ?? properties.map((property) => property.id),
  );

  return (
    <form action={action} className="rounded-3xl bg-white p-5 shadow-sm">
      <input type="hidden" name="owner_token" value={ownerToken} />
      <h2 className="text-xl font-black">Briefing SMS</h2>
      <p className="mt-1 text-sm text-[#112532]/60">
        Un seul briefing peut regrouper tous les logements de ce propriétaire.
      </p>

      <label className="mt-4 flex gap-2 font-bold">
        <input type="checkbox" name="enabled" defaultChecked={!!pref.enabled} />
        Activer les briefings
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Téléphone 1"
          name="recipient_1_phone"
          value={pref.recipient_1_phone}
        />
        <Field
          label="Téléphone 2"
          name="recipient_2_phone"
          value={pref.recipient_2_phone}
        />
        <label className="text-sm font-bold">
          Fréquence
          <select
            name="frequency"
            defaultValue={pref.frequency ?? "morning"}
            className="mt-1 w-full rounded-xl border p-2"
          >
            <option value="immediate">Dès que possible</option>
            <option value="morning">Chaque matin</option>
            <option value="evening">Chaque soir</option>
            <option value="daily">Une fois par jour</option>
            <option value="weekly">Chaque semaine</option>
          </select>
        </label>
        <Field
          label="Heure"
          name="delivery_hour"
          type="number"
          value={pref.delivery_hour ?? 8}
        />
      </div>

      <h3 className="mt-5 font-black">Logements inclus</h3>
      {properties.map((property) => (
        <label key={property.id} className="mt-2 flex gap-2 text-sm">
          <input
            type="checkbox"
            name="property_ids"
            value={property.id}
            defaultChecked={selected.has(property.id)}
          />
          {property.name}
        </label>
      ))}

      <h3 className="mt-5 font-black">À inclure</h3>
      {checks.map(([name, label]) => (
        <label key={name} className="mt-2 flex gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            defaultChecked={pref[name] ?? true}
          />
          {label}
        </label>
      ))}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm font-bold">
          Seuil prix
          <select
            name="pricing_threshold_type"
            defaultValue={pref.pricing_threshold_type ?? "pct"}
            className="mt-1 w-full rounded-xl border p-2"
          >
            <option value="pct">Pourcentage</option>
            <option value="eur">Euros</option>
          </select>
        </label>
        <Field
          label="Valeur"
          name="pricing_threshold_value"
          type="number"
          value={pref.pricing_threshold_value ?? 2}
        />
      </div>

      <label className="mt-3 flex gap-2 text-sm">
        <input
          type="checkbox"
          name="include_temporal_daily"
          defaultChecked={pref.include_temporal_daily ?? true}
        />
        Mentionner chaque jour les ajustements temporels regroupés
      </label>

      <button
        disabled={pending}
        className="mt-5 w-full rounded-2xl bg-[#112532] px-4 py-3 font-black text-white disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>

      {state.status !== "idle" && (
        <div
          className={[
            "mt-3 rounded-2xl px-4 py-3 text-sm font-bold",
            state.status === "saved"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800",
          ].join(" ")}
          role="status"
        >
          {state.status === "saved" ? "✓ " : ""}
          {state.message}
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  value,
  type = "text",
}: {
  label: string;
  name: string;
  value?: any;
  type?: string;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        className="mt-1 w-full rounded-xl border p-2"
      />
    </label>
  );
}
