import { requireAdmin } from "@/lib/adminAuth";
import { OwnerDemoCockpit } from "./OwnerDemoCockpit";

export const dynamic = "force-dynamic";

export default async function OwnerAppDemoPage() {
  await requireAdmin();

  return <OwnerDemoCockpit />;
}
