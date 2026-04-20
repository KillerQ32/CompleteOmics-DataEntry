import { AdminWorkspace, loadAdminWorkspaceData } from "../../page";

export default async function AdminPackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await loadAdminWorkspaceData(await searchParams);
  return <AdminWorkspace {...data} activePage="packages" />;
}
