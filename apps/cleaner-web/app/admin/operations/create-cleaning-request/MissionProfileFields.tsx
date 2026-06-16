"use client";

import { useMemo, useState } from "react";

type Profile = {
  id: string;
  code?: string | null;
  label?: string | null;
  service_type?: string | null;
  estimated_hours?: number | string | null;
  default_linen_required?: boolean | null;
  default_laundry_required?: boolean | null;
};

function serviceLabel(value?: string | null): string {
  switch (value) {
    case "garden_lawn":
      return "Jardin / tonte";
    case "deep_cleaning":
      return "Grand ménage";
    case "linen_laundry":
      return "Linge / lessive";
    case "inventory_check":
      return "Contrôle inventaire";
    case "maintenance_check":
      return "Petite maintenance";
    case "other":
      return "Mission ponctuelle";
    default:
      return "Ménage standard";
  }
}

function serviceIcon(value?: string | null): string {
  switch (value) {
    case "garden_lawn":
      return "🌿";
    case "deep_cleaning":
      return "✨";
    case "linen_laundry":
      return "🧺";
    case "inventory_check":
      return "🔎";
    case "maintenance_check":
      return "🔧";
    case "other":
      return "📌";
    default:
      return "🧹";
  }
}

function hoursValue(value: unknown): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "2";
}

export default function MissionProfileFields({
  profiles,
  defaultProfileId,
}: {
  profiles: Profile[];
  defaultProfileId: string;
}) {
  const initialProfile =
    profiles.find((profile) => profile.id === defaultProfileId) ?? profiles[0];

  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile?.id ?? "");
  const [estimatedHours, setEstimatedHours] = useState(hoursValue(initialProfile?.estimated_hours));
  const [linenRequired, setLinenRequired] = useState(initialProfile?.default_linen_required !== false);
  const [laundryRequired, setLaundryRequired] = useState(initialProfile?.default_laundry_required !== false);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0],
    [profiles, selectedProfileId],
  );

  function handleProfileChange(nextProfileId: string) {
    const nextProfile = profiles.find((profile) => profile.id === nextProfileId);

    setSelectedProfileId(nextProfileId);
    setEstimatedHours(hoursValue(nextProfile?.estimated_hours));
    setLinenRequired(nextProfile?.default_linen_required !== false);
    setLaundryRequired(nextProfile?.default_laundry_required !== false);
  }

  return (
    <section className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-100">
      <h2 className="text-lg font-bold text-slate-950">
        Type de mission
      </h2>

      <p className="mt-1 text-sm text-slate-600">
        La durée, le type de travail et la checklist viennent du profil choisi.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Profil
          </label>

          <select
            name="profile_id"
            value={selectedProfileId}
            onChange={(event) => handleProfileChange(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {serviceIcon(profile.service_type)} {profile.label ?? profile.code} · {hoursValue(profile.estimated_hours)}h
              </option>
            ))}
          </select>

          {selectedProfile && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {serviceIcon(selectedProfile.service_type)} {serviceLabel(selectedProfile.service_type)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Durée estimée
          </label>

          <input
            name="estimated_hours"
            type="number"
            step="0.25"
            min="0.25"
            value={estimatedHours}
            onChange={(event) => setEstimatedHours(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
          />

          <p className="mt-2 text-xs text-slate-500">
            Préremplie depuis le profil, modifiable pour cette mission.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-100">
          <input
            type="checkbox"
            name="linen_required"
            checked={linenRequired}
            onChange={(event) => setLinenRequired(event.target.checked)}
          />
          Linge à prévoir
        </label>

        <label className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-100">
          <input
            type="checkbox"
            name="laundry_required"
            checked={laundryRequired}
            onChange={(event) => setLaundryRequired(event.target.checked)}
          />
          Lessive / retour linge
        </label>
      </div>
    </section>
  );
}
