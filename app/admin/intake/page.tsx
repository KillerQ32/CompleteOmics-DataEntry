import { AdminWorkspace, loadAdminWorkspaceData } from "../../page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminIntakePage({ searchParams }: { searchParams: SearchParams }) {
  const data = await loadAdminWorkspaceData(await searchParams);
  return <AdminWorkspace {...data} activePage="intake" />;
}
