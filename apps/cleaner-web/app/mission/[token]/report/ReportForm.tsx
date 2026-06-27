"use client";

import { useMemo, useState } from "react";
import { submitCleaningReport } from "./actions";
import { useFormStatus } from "react-dom";
import { t, type CleanerLocale } from "@/lib/cleanerI18n";

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

type ReferencePhoto = {
  id: string;
  section_key: string | null;
  title: string | null;
  signedUrl: string | null;
  is_cover: boolean;
  display_order: number;
};

type ReportFormProps = {
  token: string;
  sections: Section[];
  alreadySubmitted: boolean;
  referencePhotos: ReferencePhoto[];
  locale: CleanerLocale;
};

function PendingOverlay({ locale }: { locale: CleanerLocale }) {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 px-6 backdrop-blur-sm">
      <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />

        <h2 className="text-lg font-bold text-slate-950">
          {t(locale, "form.sendingTitle")}
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          {t(locale, "form.sendingBody")}
        </p>
      </div>
    </div>
  );
}

function SubmitButton({ canSubmit, locale }: { canSubmit: boolean; locale: CleanerLocale }) {
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
      {pending ? t(locale, "form.sendingShort") : t(locale, "form.submit")}
    </button>
  );
}

export function ReportForm({
  token,
  sections,
  alreadySubmitted,
  referencePhotos,
  locale,
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

  const [selectedReferencePhoto, setSelectedReferencePhoto] =
  useState<ReferencePhoto | null>(null);

  const coverPhoto = referencePhotos.find(
    (photo) => photo.is_cover && photo.signedUrl
  );

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
      <PendingOverlay locale={locale} />
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
      {coverPhoto?.signedUrl && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <img
            src={coverPhoto.signedUrl}
            alt={coverPhoto.title ?? t(locale, "form.photoAlt")}
            className="h-40 w-full object-cover"
          />
          <div className="p-4">
            <p className="text-sm font-semibold text-slate-950">
              {coverPhoto.title ?? t(locale, "form.propertyToPrepare")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(locale, "form.modelPhotosInfo")}
            </p>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          {t(locale, "form.checklistTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(locale, "form.checklistBody")}
        </p>
      </div>

      {sections.map((section) => {
        const isOpen = Boolean(openSections[section.section_key]);
        const hasViewed = Boolean(viewedSections[section.section_key]);
        const isChecked = Boolean(checkedSections[section.section_key]);

        const sectionReferencePhotos = referencePhotos.filter(
          (photo) =>
            !photo.is_cover &&
            photo.section_key === section.section_key &&
            photo.signedUrl
        );

        return (
          <section
            key={section.section_key}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {section.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {section.detail_items.length} {section.detail_items.length > 1 ? t(locale, "form.pointsToCheck") : t(locale, "form.pointToCheck")}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
                    hasViewed
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {hasViewed ? "Points lus" : "À lire"}
                </span>
              </div>

              <button
                type="button"
                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold shadow-sm ring-1 ${
                  isOpen
                    ? "bg-slate-900 text-white ring-slate-900"
                    : hasViewed
                      ? "bg-emerald-50 text-emerald-900 ring-emerald-100"
                      : "bg-slate-950 text-white ring-slate-950"
                }`}
                onClick={() => openDetails(section.section_key)}
              >
                <span>
                  {isOpen
                    ? "Masquer les points"
                    : hasViewed
                      ? "Revoir les points à vérifier"
                      : `1 · Voir les ${section.detail_items.length} points à vérifier`}
                </span>
                <span className="text-lg leading-none">{isOpen ? "↑" : "↓"}</span>
              </button>

              {!hasViewed && (
                <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-100">
                  Ouvrez d’abord les points à vérifier. La validation sera ensuite disponible.
                </p>
              )}
            </div>

            {isOpen && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
                  Points à vérifier avant de valider
                </p>
                <ul className="list-disc space-y-2 pl-5 text-sm font-medium text-emerald-950">
                  {section.detail_items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {sectionReferencePhotos.length > 0 ? (
              <div className="w-full">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t(locale, "form.referencePhotos")}
                </p>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {sectionReferencePhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelectedReferencePhoto(photo)}
                      className="shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <img
                        src={photo.signedUrl ?? ""}
                        alt={photo.title ?? t(locale, "form.modelPhoto")}
                        className="h-20 w-28 object-cover"
                      />
                      <div className="max-w-28 truncate px-2 py-1 text-left text-[11px] text-slate-600">
                        {photo.title ?? t(locale, "form.modelPhoto")}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {t(locale, "form.modelPhotosSoon")}
              </span>
            )}

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
                        {t(locale, "form.takePhoto")}
                      </span>
                      <span className="mt-1 block text-xs text-emerald-800">
                        {t(locale, "form.takePhotoBody")}
                      </span>

                      {photoNames[section.section_key] && (
                        <span className="mt-2 block text-xs font-medium text-emerald-700">
                          {t(locale, "form.photoSelected")}
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              )}
            </div>

            <label
              onClick={(event) => {
                if (!hasViewed && !alreadySubmitted) {
                  event.preventDefault();
                  openDetails(section.section_key);
                }
              }}
              className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${
                hasViewed
                  ? "cursor-pointer border-emerald-200 bg-emerald-50"
                  : "cursor-pointer border-amber-200 bg-amber-50"
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
              className="mt-1 h-6 w-6"
            />

              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  {section.high_level_check_label}
                </span>

                {!hasViewed && (
                  <span className="mt-1 block text-xs font-semibold text-amber-800">
                    Touchez ici pour ouvrir les points, puis vous pourrez cocher.
                  </span>
                )}

                {hasViewed && !isChecked && !alreadySubmitted && (
                  <span className="mt-1 block text-xs font-semibold text-emerald-800">
                    Les points ont été ouverts. Vous pouvez maintenant cocher cette rubrique.
                  </span>
                )}

                {isChecked && (
                  <span className="mt-1 block text-xs font-semibold text-emerald-800">
                    Rubrique validée.
                  </span>
                )}
              </span>
            </label>

            <textarea
              name={`section_notes_${section.section_key}`}
              placeholder={t(locale, "form.notePlaceholder")}
              defaultValue={section.existing_notes ?? ""}
              disabled={alreadySubmitted}
              className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </section>
        );
      })}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          {t(locale, "form.problemsTitle")}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {t(locale, "form.problemsBody")}
        </p>

        <div className="mt-4 space-y-4">
          <ProblemField
            name="damage_found"
            notesName="damage_notes"
            label={t(locale, "form.damage")}
            locale={locale}
          />
          <ProblemField
            name="missing_items"
            notesName="missing_items_notes"
            label={t(locale, "form.missingItems")}
            locale={locale}
          />
          <ProblemField
            name="guest_left_items"
            notesName="guest_left_items_notes"
            label={t(locale, "form.leftItems")}
            locale={locale}
          />
          <ProblemField
            name="linen_problem"
            notesName="linen_notes"
            label={t(locale, "form.linenProblem")}
            locale={locale}
          />
          <ProblemField
            name="consumables_problem"
            notesName="consumables_notes"
            label={t(locale, "form.consumablesProblem")}
            locale={locale}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-slate-900">
          {t(locale, "form.generalNotes")}
        </label>
        <textarea
          name="general_notes"
          placeholder={t(locale, "form.generalNotesPlaceholder")}
          disabled={alreadySubmitted}
          className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm"
        />
      </section>

      {!alreadySubmitted && (
      <SubmitButton canSubmit={allRequiredChecked} locale={locale} />

      )}

      {!allRequiredChecked && !alreadySubmitted && (
        <p className="text-center text-sm text-slate-500">
          {t(locale, "form.requiredBeforeSubmit")}
        </p>
      )}

      {selectedReferencePhoto?.signedUrl && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <button
          type="button"
          onClick={() => setSelectedReferencePhoto(null)}
          className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
        >
          {t(locale, "form.close")}
        </button>

        <div className="max-h-full max-w-3xl overflow-hidden rounded-3xl bg-white">
          <img
            src={selectedReferencePhoto.signedUrl}
            alt={selectedReferencePhoto.title ?? t(locale, "form.modelPhoto")}
            className="max-h-[75vh] w-full object-contain"
          />
          <div className="p-4">
            <p className="font-semibold text-slate-950">
              {selectedReferencePhoto.title ?? t(locale, "form.modelPhoto")}
            </p>
          </div>
        </div>
      </div>
    )}
    </form>
  );
}

function ProblemField({
  name,
  notesName,
  label,
  locale,
}: {
  name: string;
  notesName: string;
  label: string;
  locale: CleanerLocale;
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
          placeholder={t(locale, "form.problemDetailsPlaceholder")}
          className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
        />
      )}
    </div>
  );
}