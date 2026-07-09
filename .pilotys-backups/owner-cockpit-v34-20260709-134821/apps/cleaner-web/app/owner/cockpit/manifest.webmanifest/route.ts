import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Pylotis Owner",
    short_name: "Pylotis",
    description: "Cockpit propriétaire Pylotis",
    id: "/owner/cockpit",
    start_url: "/owner/cockpit",
    scope: "/owner/",
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
  });
}