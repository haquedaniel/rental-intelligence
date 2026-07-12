import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminHealthRedirect() {
  redirect("/admin/ops-health");
}
