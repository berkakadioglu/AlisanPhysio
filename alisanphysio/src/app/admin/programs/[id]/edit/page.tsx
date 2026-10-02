import CatalogProgramPage from "../../../catalog-program-page";
import { dayIndexFromParam } from "../../../editor/day-ops";
export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ day?: string | string[] }>;
}) {
  const [{ id }, { day }] = await Promise.all([params, searchParams]);
  return <CatalogProgramPage id={id} initialDayIndex={dayIndexFromParam(day)} />;
}
