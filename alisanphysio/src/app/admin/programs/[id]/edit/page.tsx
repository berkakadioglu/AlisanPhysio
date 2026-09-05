import CatalogProgramPage from "../../../catalog-program-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CatalogProgramPage id={(await params).id} />;
}
