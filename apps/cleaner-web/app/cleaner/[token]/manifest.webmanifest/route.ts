import { NextResponse } from "next/server";

type Context = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;

  return NextResponse.json(
    {
      id: `/cleaner/${token}`,
      name: "Pilotys",
      short_name: "Pilotys",
      description: "Missions de ménage",
      start_url: `/cleaner/${token}`,
      scope: "/",
      display: "standalone",
      background_color: "#f5f8f7",
      theme_color: "#0f172a",
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store",
      },
    },
  );
}