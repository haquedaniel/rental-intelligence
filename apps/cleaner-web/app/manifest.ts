// apps/cleaner-web/app/manifest.ts

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Missions ménage",
    short_name: "Ménage",
    description: "Gestion des missions de ménage",
    start_url: "/",
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
  };
}