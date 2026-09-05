/** Copy values, never row identities. Preserve ungrouped exercises on load/copy. */
export function editorDays<T extends { day_id?: string | null; order_index?: number }>(
  days: { id: string; title: string | null; order_index?: number }[],
  exercises: T[],
  ungroupedTitle: string,
) {
  const ordered = [...exercises].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const result = [...days].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((day) => ({ title: day.title ?? "", exercises: ordered.filter((e) => e.day_id === day.id).map((e) => ({ ...e })) }));
  const ids = new Set(days.map((d) => d.id));
  const ungrouped = ordered.filter((e) => !e.day_id || !ids.has(e.day_id));
  if (ungrouped.length) result.push({ title: ungroupedTitle, exercises: ungrouped.map((e) => ({ ...e })) });
  return result;
}
