import type { CleanerLocale } from "@/lib/cleanerI18n";

type SupabaseAdmin = ReturnType<typeof import("@/lib/supabaseAdmin").getSupabaseAdmin>;

type ChecklistSectionBase = {
  id?: string | null;
  section_key: string;
  title?: string | null;
  high_level_check_label?: string | null;
  detail_items?: unknown;
  [key: string]: unknown;
};

type ChecklistSectionTranslationRow = {
  section_id: string;
  language: "en" | "ru";
  title: string | null;
  high_level_check_label: string | null;
  detail_items: unknown;
};

function nonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeChecklistDetailItems(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    const lines = value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);

    return lines.length ? lines : fallback;
  }

  if (typeof value === "string") {
    const lines = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    return lines.length ? lines : fallback;
  }

  return fallback;
}

export async function loadTranslatedChecklistSections<T extends ChecklistSectionBase>({
  supabase,
  sections,
  locale,
}: {
  supabase: SupabaseAdmin;
  sections: T[];
  locale: CleanerLocale;
}): Promise<Array<T & { title: string; high_level_check_label: string; detail_items: string[] }>> {
  const normalizedFrenchSections = sections.map((section) => ({
    ...section,
    title: nonEmptyText(section.title) ?? "Section",
    high_level_check_label: nonEmptyText(section.high_level_check_label) ?? nonEmptyText(section.title) ?? "Section validée",
    detail_items: normalizeChecklistDetailItems(section.detail_items),
  }));

  if (locale === "fr" || normalizedFrenchSections.length === 0) {
    return normalizedFrenchSections;
  }

  const sectionIds = normalizedFrenchSections
    .map((section) => section.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (sectionIds.length === 0) {
    return normalizedFrenchSections;
  }

  const { data, error } = await supabase
    .from("cleaning_checklist_section_translations")
    .select("section_id,language,title,high_level_check_label,detail_items")
    .in("section_id", sectionIds)
    .eq("language", locale);

  if (error) {
    console.error("Checklist section translations query failed", error);
    return normalizedFrenchSections;
  }

  const translationsBySectionId = new Map(
    ((data ?? []) as ChecklistSectionTranslationRow[]).map((translation) => [
      translation.section_id,
      translation,
    ]),
  );

  return normalizedFrenchSections.map((section) => {
    const translation = section.id ? translationsBySectionId.get(section.id) : null;

    if (!translation) {
      return section;
    }

    return {
      ...section,
      title: nonEmptyText(translation.title) ?? section.title,
      high_level_check_label:
        nonEmptyText(translation.high_level_check_label) ?? section.high_level_check_label,
      detail_items: normalizeChecklistDetailItems(translation.detail_items, section.detail_items),
    };
  });
}
