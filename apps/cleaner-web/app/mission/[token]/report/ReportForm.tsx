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

const SECTION_COPY = {
  fr: {
    toRead: "À lire",
    ready: "Prêt à valider",
    validated: "Validée",
    readPoints: (count: number) => `Lire les ${count} points`,
    reviewPoints: "Revoir les points",
    hidePoints: "Masquer les points",
    pointsTitle: "Points à vérifier avant de valider",
    readFirst: "Ouvrez les points à vérifier avant de valider cette rubrique.",
    validate: "Valider cette rubrique",
    validatedBody: "Rubrique validée. Les points peuvent rester fermés.",
    changeValidation: "Modifier la validation",
    photoRequired: "Photo obligatoire",
    photoOptional: "Photo optionnelle",
    requiredPhotoFirst: "Ajoutez la photo obligatoire avant de valider.",
    selectedPhoto: "Photo sélectionnée",
    point: "point à vérifier",
    points: "points à vérifier",
  },
  en: {
    toRead: "To read",
    ready: "Ready to validate",
    validated: "Validated",
    readPoints: (count: number) => `Read ${count} points`,
    reviewPoints: "Review points",
    hidePoints: "Hide points",
    pointsTitle: "Points to check before validating",
    readFirst: "Open the points to check before validating this section.",
    validate: "Validate this section",
    validatedBody: "Section validated. The points can stay closed.",
    changeValidation: "Change validation",
    photoRequired: "Photo required",
    photoOptional: "Photo optional",
    requiredPhotoFirst: "Add the required photo before validating.",
    selectedPhoto: "Photo selected",
    point: "point to check",
    points: "points to check",
  },
  ru: {
    toRead: "Прочитать",
    ready: "Можно подтвердить",
    validated: "Подтверждено",
    readPoints: (count: number) => `Прочитать ${count} пункт(ов)`,
    reviewPoints: "Посмотреть пункты",
    hidePoints: "Скрыть пункты",
    pointsTitle: "Проверьте эти пункты перед подтверждением",
    readFirst: "Откройте пункты проверки перед подтверждением раздела.",
    validate: "Подтвердить раздел",
    validatedBody: "Раздел подтверждён. Пункты можно оставить закрытыми.",
    changeValidation: "Изменить подтверждение",
    photoRequired: "Фото обязательно",
    photoOptional: "Фото по желанию",
    requiredPhotoFirst: "Добавьте обязательное фото перед подтверждением.",
    selectedPhoto: "Фото выбрано",
    point: "пункт для проверки",
    points: "пункта для проверки",
  },
} as const;

function copyFor(locale: CleanerLocale) {
  if (locale === "en" || locale === "ru") return SECTION_COPY[locale];
  return SECTION_COPY.fr;
}

function PendingOverlay({ locale }: { locale: CleanerLocale }) {
  const { pending } = useFormStatus();

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 px-6 backdrop-blur-sm">
      <div className="max-w-sm rounded-3xl border border-[#112532]/10 bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />

        <h2 className="text-lg font-bold text-[#112532]">
          {t(locale, "form.sendingTitle")}
        </h2>

        <p className="mt-2 text-sm text-[#112532]/62">
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
  const copy = copyFor(locale);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [viewedSections, setViewedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((section) => [
        section.section_key,
        Boolean(section.existing_details_viewed),
      ]),
    ),
  );
  const [checkedSections, setCheckedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((section) => [
        section.section_key,
        Boolean(section.existing_checked),
      ]),
    ),
  );

  const [photoNames, setPhotoNames] = useState<Record<string, string>>({});
  const [selectedReferencePhoto, setSelectedReferencePhoto] =
    useState<ReferencePhoto | null>(null);

  const coverPhoto = referencePhotos.find(
    (photo) => photo.is_cover && photo.signedUrl,
  );

  const requiredSections = useMemo(
    () => sections.filter((section) => section.required),
    [sections],
  );

  const allRequiredChecked = requiredSections.every(
    (section) => checkedSections[section.section_key],
  );

  function openPoints(sectionKey: string) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: true,
    }));

    setViewedSections((current) => ({
      ...current,
      [sectionKey]: true,
    }));
  }

  function togglePoints(sectionKey: string) {
    setOpenSections((current) => {
      const nextOpen = !current[sectionKey];

      if (nextOpen) {
        setViewedSections((viewed) => ({
          ...viewed,
          [sectionKey]: true,
        }));
      }

      return {
        ...current,
        [sectionKey]: nextOpen,
      };
    });
  }

  function validateSection(section: Section) {
    const sectionKey = section.section_key;
    const hasViewed = Boolean(viewedSections[sectionKey]);
    const requiresPhoto = section.photo_requirement === "required";
    const hasPhoto = Boolean(photoNames[sectionKey]);

    if (!hasViewed) {
      openPoints(sectionKey);
      return;
    }

    if (requiresPhoto && !hasPhoto && !alreadySubmitted) {
      openPoints(sectionKey);
      return;
    }

    setCheckedSections((current) => ({
      ...current,
      [sectionKey]: true,
    }));

    setOpenSections((current) => ({
      ...current,
      [sectionKey]: false,
    }));
  }

  function reopenForChange(sectionKey: string) {
    setCheckedSections((current) => ({
      ...current,
      [sectionKey]: false,
    }));

    openPoints(sectionKey);
  }

  return (
    <form action={submitCleaningReport} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <PendingOverlay locale={locale} />

      {Object.entries(viewedSections).map(([sectionKey, viewed]) =>
        viewed ? (
          <input
            key={`viewed_${sectionKey}`}
            type="hidden"
            name="viewedSections"
            value={sectionKey}
          />
        ) : null,
      )}

      {Object.entries(checkedSections).map(([sectionKey, checked]) =>
        checked ? (
          <input
            key={`checked_${sectionKey}`}
            type="hidden"
            name="checkedSections"
            value={sectionKey}
          />
        ) : null,
      )}

      {coverPhoto?.signedUrl && (
        <div className="overflow-hidden rounded-3xl border border-[#112532]/10 bg-white shadow-sm">
          <img
            src={coverPhoto.signedUrl}
            alt={coverPhoto.title ?? t(locale, "form.photoAlt")}
            className="h-40 w-full object-cover"
          />
          <div className="p-4">
            <p className="text-sm font-semibold text-[#112532]">
              {coverPhoto.title ?? t(locale, "form.propertyToPrepare")}
            </p>
            <p className="mt-1 text-xs text-[#112532]/48">
              {t(locale, "form.modelPhotosInfo")}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#112532]/10 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-[#112532]">
          {t(locale, "form.checklistTitle")}
        </h2>
        <p className="mt-1 text-sm text-[#112532]/62">
          {t(locale, "form.checklistBody")}
        </p>
      </div>

      {sections.map((section) => {
        const sectionKey = section.section_key;
        const isOpen = Boolean(openSections[sectionKey]);
        const hasViewed = Boolean(viewedSections[sectionKey]);
        const isChecked = Boolean(checkedSections[sectionKey]);
        const requiresPhoto = section.photo_requirement === "required";
        const allowsPhoto =
          section.photo_requirement === "required" ||
          section.photo_requirement === "optional";
        const hasPhoto = Boolean(photoNames[sectionKey]);
        const canValidate =
          hasViewed && !alreadySubmitted && (!requiresPhoto || hasPhoto);
        const pointCount = section.detail_items.length;

        const sectionReferencePhotos = referencePhotos.filter(
          (photo) =>
            !photo.is_cover &&
            photo.section_key === sectionKey &&
            photo.signedUrl,
        );

        const statusLabel = isChecked
          ? copy.validated
          : hasViewed
            ? copy.ready
            : copy.toRead;

        const statusClass = isChecked
          ? "bg-emerald-100 text-emerald-800"
          : hasViewed
            ? "bg-blue-100 text-blue-800"
            : "bg-amber-100 text-amber-900";

        return (
          <section
            key={sectionKey}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              isChecked ? "border-emerald-200" : "border-[#112532]/10"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-[#112532]">
                  {section.title}
                </h3>
                <p className="mt-1 text-sm text-[#112532]/48">
                  {pointCount} {pointCount > 1 ? copy.points : copy.point}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${statusClass}`}
              >
                {statusLabel}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {requiresPhoto && (
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-800 ring-1 ring-red-100">
                  {copy.photoRequired}
                </span>
              )}
              {section.photo_requirement === "optional" && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-[#112532]/62">
                  {copy.photoOptional}
                </span>
              )}
            </div>

            <button
              type="button"
              className={`mt-4 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold shadow-sm ring-1 ${
                isOpen
                  ? "bg-slate-900 text-white ring-slate-900"
                  : isChecked
                    ? "bg-[#ECFFF6] text-emerald-900 ring-emerald-100"
                    : "bg-[#112532] text-white ring-slate-950"
              }`}
              onClick={() => togglePoints(sectionKey)}
            >
              <span>
                {isOpen
                  ? copy.hidePoints
                  : hasViewed
                    ? copy.reviewPoints
                    : copy.readPoints(pointCount)}
              </span>
              <span className="text-lg leading-none">{isOpen ? "↑" : "↓"}</span>
            </button>

            {!hasViewed && (
              <p className="mt-3 rounded-2xl bg-[#FFF5DD] px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-100">
                {copy.readFirst}
              </p>
            )}

            {isOpen && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-[#ECFFF6] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
                  {copy.pointsTitle}
                </p>
                <ul className="list-disc space-y-2 pl-5 text-sm font-medium text-emerald-950">
                  {section.detail_items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {sectionReferencePhotos.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#112532]/48">
                  {t(locale, "form.referencePhotos")}
                </p>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {sectionReferencePhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelectedReferencePhoto(photo)}
                      className="shrink-0 overflow-hidden rounded-2xl border border-[#112532]/10 bg-white shadow-sm"
                    >
                      <img
                        src={photo.signedUrl ?? ""}
                        alt={photo.title ?? t(locale, "form.modelPhoto")}
                        className="h-20 w-28 object-cover"
                      />
                      <div className="max-w-28 truncate px-2 py-1 text-left text-[11px] text-[#112532]/62">
                        {photo.title ?? t(locale, "form.modelPhoto")}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allowsPhoto && !alreadySubmitted && hasViewed && (
              <div className="mt-4">
                <input
                  id={`photo_${sectionKey}`}
                  type="file"
                  name={`photo_${sectionKey}`}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setPhotoNames((current) => ({
                      ...current,
                      [sectionKey]: file?.name ?? "",
                    }));
                  }}
                />

                <label
                  htmlFor={`photo_${sectionKey}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-4 ${
                    requiresPhoto && !hasPhoto
                      ? "border-red-300 bg-red-50"
                      : "border-emerald-300 bg-[#ECFFF6]"
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl text-white ${
                      requiresPhoto && !hasPhoto ? "bg-red-600" : "bg-emerald-600"
                    }`}
                  >
                    📷
                  </span>

                  <span className="flex-1">
                    <span
                      className={`block text-sm font-semibold ${
                        requiresPhoto && !hasPhoto
                          ? "text-red-950"
                          : "text-emerald-950"
                      }`}
                    >
                      {t(locale, "form.takePhoto")}
                    </span>
                    <span
                      className={`mt-1 block text-xs ${
                        requiresPhoto && !hasPhoto
                          ? "text-red-800"
                          : "text-emerald-800"
                      }`}
                    >
                      {requiresPhoto ? copy.photoRequired : t(locale, "form.takePhotoBody")}
                    </span>

                    {hasPhoto && (
                      <span className="mt-2 block text-xs font-medium text-[#0B6B53]">
                        {copy.selectedPhoto}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}

            <div
              className={`mt-4 rounded-2xl border p-4 ${
                isChecked
                  ? "border-emerald-200 bg-[#ECFFF6]"
                  : hasViewed
                    ? "border-blue-200 bg-blue-50"
                    : "border-[#112532]/10 bg-[#F6F3EF]"
              }`}
            >
              {!hasViewed && (
                <button
                  type="button"
                  onClick={() => openPoints(sectionKey)}
                  className="w-full rounded-2xl bg-[#112532] px-4 py-3 text-sm font-bold text-white"
                >
                  {copy.readPoints(pointCount)}
                </button>
              )}

              {hasViewed && !isChecked && (
                <>
                  {requiresPhoto && !hasPhoto && (
                    <p className="mb-3 text-xs font-semibold text-red-800">
                      {copy.requiredPhotoFirst}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={!canValidate}
                    onClick={() => validateSection(section)}
                    className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {copy.validate}
                  </button>
                </>
              )}

              {isChecked && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-emerald-900">
                    ✅ {copy.validatedBody}
                  </p>

                  {!alreadySubmitted && (
                    <button
                      type="button"
                      onClick={() => reopenForChange(sectionKey)}
                      className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-900 ring-1 ring-emerald-200"
                    >
                      {copy.changeValidation}
                    </button>
                  )}
                </div>
              )}
            </div>

            <textarea
              name={`section_notes_${sectionKey}`}
              placeholder={t(locale, "form.notePlaceholder")}
              defaultValue={section.existing_notes ?? ""}
              disabled={alreadySubmitted}
              className="mt-3 min-h-20 w-full rounded-xl border border-[#112532]/10 p-3 text-sm"
            />
          </section>
        );
      })}

      <section className="rounded-2xl border border-[#112532]/10 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-[#112532]">
          {t(locale, "form.problemsTitle")}
        </h3>
        <p className="mt-1 text-sm text-[#112532]/62">
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

      <section className="rounded-2xl border border-[#112532]/10 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-[#112532]">
          {t(locale, "form.generalNotes")}
        </label>
        <textarea
          name="general_notes"
          placeholder={t(locale, "form.generalNotesPlaceholder")}
          disabled={alreadySubmitted}
          className="mt-2 min-h-28 w-full rounded-xl border border-[#112532]/10 p-3 text-sm"
        />
      </section>

      {!alreadySubmitted && (
        <SubmitButton canSubmit={allRequiredChecked} locale={locale} />
      )}

      {!allRequiredChecked && !alreadySubmitted && (
        <p className="text-center text-sm text-[#112532]/48">
          {t(locale, "form.requiredBeforeSubmit")}
        </p>
      )}

      {selectedReferencePhoto?.signedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setSelectedReferencePhoto(null)}
            className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#112532]"
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
              <p className="font-semibold text-[#112532]">
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
    <div className="rounded-xl border border-[#112532]/10 p-3">
      <label className="flex items-center gap-3 text-sm font-medium text-[#112532]">
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
          className="mt-3 min-h-20 w-full rounded-xl border border-[#112532]/10 p-3 text-sm"
        />
      )}
    </div>
  );
}
