import { getOwnerCockpitData } from "../cockpit/data";
import { OwnerCockpit } from "../cockpit/OwnerCockpit";

export const dynamic = "force-dynamic";

export default async function OwnerOperationsPage({
  params,
}: {
  params: Promise<{ ownerToken: string }>;
}) {
  const { ownerToken } = await params;
  const data = await getOwnerCockpitData(ownerToken);
  return <OwnerCockpit data={data} view="operations" />;
}
