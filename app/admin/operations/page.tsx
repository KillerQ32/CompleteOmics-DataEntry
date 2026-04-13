import { AdminWorkspace, loadAdminWorkspaceData } from "../../page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminOperationsPage({ searchParams }: { searchParams: SearchParams }) {
  const data = await loadAdminWorkspaceData(await searchParams);
  return <AdminWorkspace {...data} activePage="operations" />;
}
