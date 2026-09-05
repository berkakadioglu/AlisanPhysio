import type { SupabaseClient } from "@supabase/supabase-js";

export interface CatalogListItem {
  id: string;
  title: string;
  updated_at: string;
  dayCount: number;
  exerciseCount: number;
  clientCount: number;
  assignmentCount: number;
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

export function catalogListItems(rows: CatalogRow[], assignments: AssignmentRow[]): CatalogListItem[] {
  const counts = new Map<string, { clients: Set<string>; total: number }>();
  for (const row of assignments) {
    const count = counts.get(row.source_program_id) ?? { clients: new Set<string>(), total: 0 };
    count.clients.add(row.client_id);
    count.total++;
    counts.set(row.source_program_id, count);
  }
  return rows.map((row) => ({
    id: row.id, title: row.title, updated_at: row.updated_at,
    dayCount: row.program_days[0]?.count ?? 0,
    exerciseCount: row.exercises[0]?.count ?? 0,
    clientCount: counts.get(row.id)?.clients.size ?? 0,
    assignmentCount: counts.get(row.id)?.total ?? 0,
  }));
}

/** Page every flat result so Supabase's row cap cannot silently lower counts. */
export async function loadCatalogPrograms(supabase: SupabaseClient) {
  const [rows, assignments] = await Promise.all([
    (async () => {
      const rows: CatalogRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("programs")
          .select("id, title, updated_at, program_days(count), exercises(count)")
          .eq("kind", "catalog").order("updated_at", { ascending: false }).order("id")
          .range(offset, offset + 999).returns<CatalogRow[]>();
        if (error) throw new Error("Could not load catalogue programmes");
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) return rows;
      }
    })(),
    (async () => {
      const rows: AssignmentRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("programs").select("source_program_id, client_id")
          .eq("kind", "client").not("source_program_id", "is", null).order("id")
          .range(offset, offset + 999).returns<AssignmentRow[]>();
        if (error) throw new Error("Could not load catalogue assignment counts");
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
