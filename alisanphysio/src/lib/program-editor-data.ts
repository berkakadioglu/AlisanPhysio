/**
 * Copy values, never row identities. Preserve ungrouped exercises on load/copy.
 * Each day keeps its informational origin (`sourceTemplateLabel`, the saved day
 * it was inserted from) and the saved day's id (`sourceTemplateId`, used only
 * for "Update saved day"); the ungrouped bucket has neither.
 */
export function editorDays<T extends { day_id?: string | null; order_index?: number }>(
  days: {
    id: string;
    title: string | null;
    order_index?: number;
    source_template_label?: string | null;
    source_template_id?: string | null;
  }[],
  exercises: T[],
  ungroupedTitle: string,
): { title: string; sourceTemplateLabel: string | null; sourceTemplateId: string | null; exercises: T[] }[] {
  const ordered = [...exercises].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const result = [...days].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((day) => ({
      title: day.title ?? "",
      sourceTemplateLabel: day.source_template_label?.trim() || null,
      sourceTemplateId: day.source_template_id?.trim() || null,
      exercises: ordered.filter((e) => e.day_id === day.id).map((e) => ({ ...e })),
    }));
  const ids = new Set(days.map((d) => d.id));
  const ungrouped = ordered.filter((e) => !e.day_id || !ids.has(e.day_id));
  if (ungrouped.length) {
    result.push({
      title: ungroupedTitle,
      sourceTemplateLabel: null,
      sourceTemplateId: null,
      exercises: ungrouped.map((e) => ({ ...e })),
    });
  }
  return result;
}
