"use client";

import { useMemo, useState } from "react";
import { submitCleaningReport } from "./actions";
import { useFormStatus } from "react-dom";

type Section = {
  section_key: string;
  title: string;
  high_level_check_label: string;
  detail_items: string[];
  required: boolean;
  photo_requirement: string;
  reference_photo_count: number;
  existing_checked?: boolean;
  existing_details_viewed?: boolean;
  existing_notes?: string | null;
};

type ReportFormProps = {
  token: string;
  sections: Section[];
  alreadySubmitted: boolean;
};

function PendingOverlay() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 px-6 backdrop-blur-sm">
      <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />

        <h2 className="text-lg font-bold text-slate-950">
          Envoi du rapport en cours…
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Les photos peuvent prendre quelques secondes. Merci de ne pas fermer cette page.
        </p>
      </div>
    </div>
  );
}

function SubmitButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!canSubmit || pending}
      className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 py-4 text-base font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {pending && (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {pending ? "Envoi en cours…" : "Envoyer le rapport"}
    </button>
  );
}

export function ReportForm({
  token,
  sections,
  alreadySubmitted,
}: ReportFormProps) {
  const initialViewed = Object.fromEntries(
    sections.map((section) => [
      section.section_key,
      Boolean(section.existing_details_viewed),
    ])
  );

  const initialChecked = Object.fromEntries(
    sections.map((section) => [
      section.section_key,
      Boolean(section.existing_checked),
    ])
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [viewedSections, setViewedSections] =
    useState<Record<string, boolean>>(initialViewed);
  const [checkedSections, setCheckedSections] =
    useState<Record<string, boolean>>(initialChecked);

  const [photoNames, setPhotoNames] = useState<Record<string, string>>({});

  const requiredSections = useMemo(
    () => sections.filter((section) => section.required),
    [sections]
  );

  const allRequiredChecked = requiredSections.every(
    (section) => checkedSections[section.section_key]
  );

  function openDetails(sectionKey: string) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));

    setViewedSections((current) => ({
      ...current,
      [sectionKey]: true,
    }));
  }

  return (
    <form action={submitCleaningReport} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <PendingOverlay />
      {Object.entries(viewedSections).map(([sectionKey, viewed]) =>
        viewed ? (
          <input
            key={sectionKey}
            type="hidden"
            name="viewedSections"
            value={sectionKey}
          />
        ) : null
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Checklist de ménage
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Ouvrez chaque rubrique pour voir les points à vérifier, puis validez
          uniquement la case principale.
        </p>
      </div>

      {sections.map((section) => {
        const isOpen = Boolean(openSections[section.section_key]);
        const hasViewed = Boolean(viewedSections[section.section_key]);
        const isChecked = Boolean(checkedSections[section.section_key]);

        return (
          <section
            key={section.section_key}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {section.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {section.detail_items.length} point
                  {section.detail_items.length > 1 ? "s" : ""} à vérifier
                </p>
              </div>

              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                onClick={() => openDetails(section.section_key)}
              >
                {isOpen ? "Masquer" : "Voir les points"}
              </button>
            </div>

            {isOpen && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {section.detail_items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                disabled={section.reference_photo_count === 0}
                title={
                  section.reference_photo_count === 0
                    ? "Photos modèle à ajouter plus tard"
                    : "Voir les photos modèle"
                }
              >
                Photos modèle{" "}
                {section.reference_photo_count > 0
                  ? `(${section.reference_photo_count})`
                  : "à venir"}
              </button>

              {section.photo_requirement !== "none" && !alreadySubmitted && (
                <div className="mt-4">
                  <input
                    id={`photo_${section.section_key}`}
                    type="file"
                    name={`photo_${section.section_key}`}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setPhotoNames((current) => ({
                        ...current,
                        [section.section_key]: file?.name ?? "",
                      }));
                    }}
                  />

                  <label
                    htmlFor={`photo_${section.section_key}`}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-4"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
                      📷
                    </span>

                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-emerald-950">
                        Prendre une photo après ménage
                      </span>
                      <span className="mt-1 block text-xs text-emerald-800">
                        Optionnel pour l’instant. Utile pour confirmer l’état final.
                      </span>

                      {photoNames[section.section_key] && (
                        <span className="mt-2 block text-xs font-medium text-emerald-700">
                          Photo sélectionnée ✅
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              )}
            </div>

            <label
              className={`mt-4 flex items-start gap-3 rounded-xl border p-3 ${
                hasViewed
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
            <input
              type="checkbox"
              name="checkedSections"
              value={section.section_key}
              checked={isChecked}
              disabled={!hasViewed || alreadySubmitted}
              onChange={(event) => {
                const checked = event.target.checked;

                setCheckedSections((current) => ({
                  ...current,
                  [section.section_key]: checked,
                }));

                if (checked) {
                  setOpenSections((current) => ({
                    ...current,
                    [section.section_key]: false,
                  }));
                }
              }}
              className="mt-1 h-5 w-5"
            />

              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  {section.high_level_check_label}
                </span>

                {!hasViewed && (
                  <span className="mt-1 block text-xs text-slate-500">
                    Ouvrez d'abord les points à vérifier.
                  </span>
                )}
              </span>
            </label>

            <textarea
              name={`section_notes_${section.section_key}`}
              placeholder="Note éventuelle pour cette rubrique"
              defaultValue={section.existing_notes ?? ""}
              disabled={alreadySubmitted}
              className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </section>
        );
      })}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Problèmes à signaler
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Cochez uniquement s'il y a quelque chose à signaler.
        </p>

        <div className="mt-4 space-y-4">
          <ProblemField
            name="damage_found"
            notesName="damage_notes"
            label="Dégât constaté"
          />
          <ProblemField
            name="missing_items"
            notesName="missing_items_notes"
            label="Objet ou équipement manquant"
          />
          <ProblemField
            name="guest_left_items"
            notesName="guest_left_items_notes"
            label="Objet oublié par un voyageur"
          />
          <ProblemField
            name="linen_problem"
            notesName="linen_notes"
            label="Problème de linge"
          />
          <ProblemField
            name="consumables_problem"
            notesName="consumables_notes"
            label="Produits d’accueil manquants"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-slate-900">
          Notes générales
        </label>
        <textarea
          name="general_notes"
          placeholder="Informations utiles pour le propriétaire"
          disabled={alreadySubmitted}
          className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm"
        />
      </section>

      {!alreadySubmitted && (
      <SubmitButton canSubmit={allRequiredChecked} />

      )}

      {!allRequiredChecked && !alreadySubmitted && (
        <p className="text-center text-sm text-slate-500">
          Toutes les rubriques obligatoires doivent être validées avant l’envoi.
        </p>
      )}
    </form>
  );
}

function ProblemField({
  name,
  notesName,
  label,
}: {
  name: string;
  notesName: string;
  label: string;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <label className="flex items-center gap-3 text-sm font-medium text-slate-900">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="h-5 w-5"
        />
        {label}
      </label>

      {checked && (
        <textarea
          name={notesName}
          placeholder="Précisez le problème"
          className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
        />
      )}
    </div>
  );
}