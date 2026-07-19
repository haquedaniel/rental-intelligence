import { getOwnerCockpitData } from "./data";
import { OwnerCockpit } from "./OwnerCockpit";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pilotys Owner",
  manifest: "/owner/cockpit/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pilotys",
    statusBarStyle: "default",
  },
};

type PageProps = {
  params: Promise<{ ownerToken: string }>;
};

export default async function OwnerTokenCockpitPage({ params }: PageProps) {
  const { ownerToken } = await params;
  const data = await getOwnerCockpitData(ownerToken);

  return <OwnerCockpit data={data} />;
}
