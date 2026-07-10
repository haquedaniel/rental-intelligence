import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RedirectIssueRequestToMission({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  redirect(`/owner/missions/${requestId}`);
}
