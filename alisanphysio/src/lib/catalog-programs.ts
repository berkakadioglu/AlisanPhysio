import type { SupabaseClient } from "@supabase/supabase-js";
import { missingCatalogColumn } from "@/lib/catalog-compatibility";

export interface CatalogListItem {
  id: string;
  title: string;
  updated_at: string | null;
  dayCount: number;
  exerciseCount: number;
  clientCount: number | null;
  assignmentCount: number | null;
}

export interface CatalogClient {
  id: string;
  full_name: string | null;
}

export function isProgramId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

type CatalogRow = Pick<CatalogListItem, "id" | "title" | "updated_at"> & {
  program_days: { count: number }[];
  exercises: { count: number }[];
};
type AssignmentRow = { source_program_id: string; client_id: string };

export function catalogListItems(rows: CatalogRow[], assignments: AssignmentRow[] | null): CatalogListItem[] {
  const counts = new Map<string, { clients: Set<string>; total: number }>();
  for (const row of assignments ?? []) {
    const count = counts.get(row.source_program_id) ?? { clients: new Set<string>(), total: 0 };
    count.clients.add(row.client_id);
    count.total++;
    counts.set(row.source_program_id, count);
  }
  return rows.map((row) => ({
    id: row.id, title: row.title, updated_at: row.updated_at,
    dayCount: row.program_days[0]?.count ?? 0,
    exerciseCount: row.exercises[0]?.count ?? 0,
    clientCount: assignments === null ? null : counts.get(row.id)?.clients.size ?? 0,
    assignmentCount: assignments === null ? null : counts.get(row.id)?.total ?? 0,
  }));
}

/** Page every flat result so Supabase's row cap cannot silently lower counts. */
export async function loadCatalogPrograms(supabase: SupabaseClient) {
  const [rows, assignments] = await Promise.all([
    (async () => {
      const rows: CatalogRow[] = [];
      let hasUpdatedAt = true;
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("programs")
          .select(hasUpdatedAt ? "id, title, updated_at, program_days(count), exercises(count)" : "id, title, program_days(count), exercises(count)")
          .eq("kind", "catalog").order(hasUpdatedAt ? "updated_at" : "created_at", { ascending: false }).order("id")
          .range(offset, offset + 999).returns<CatalogRow[]>();
        if (hasUpdatedAt && offset === 0 && missingCatalogColumn(error, "updated_at")) {
          hasUpdatedAt = false;
          offset -= 1000;
          continue;
        }
        if (error) throw new Error("Could not load catalogue programmes", { cause: error });
        rows.push(...(data ?? []).map((row) => ({ ...row, updated_at: hasUpdatedAt ? row.updated_at : null })));
        if (!data || data.length < 1000) return rows;
      }
    })(),
    (async () => {
      const rows: AssignmentRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("programs").select("source_program_id, client_id")
          .eq("kind", "client").not("source_program_id", "is", null).order("id")
          .range(offset, offset + 999).returns<AssignmentRow[]>();
        if (missingCatalogColumn(error, "source_program_id")) return null;
        if (error) throw new Error("Could not load catalogue assignment counts", { cause: error });
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) return rows;
      }
    })(),
  ]);
  return catalogListItems(rows, assignments);
}

export async function loadCatalogClients(supabase: SupabaseClient) {
  const rows: CatalogClient[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("profiles").select("id, full_name")
      .eq("role", "client").order("full_name").order("id")
      .range(offset, offset + 999).returns<CatalogClient[]>();
    if (error) throw new Error("Could not load clients");
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
