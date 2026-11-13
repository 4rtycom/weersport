import type { MetadataRoute } from "next";

/** Lets people add WeerSport to their home screen; on iPhone that is required for push. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WeerSport",
    short_name: "WeerSport",
    description: "Het beste moment om buiten te sporten in Nederland.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b2530",
    theme_color: "#0b2530",
    lang: "nl",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/app-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
