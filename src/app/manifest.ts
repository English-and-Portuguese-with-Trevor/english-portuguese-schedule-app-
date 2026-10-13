import type { MetadataRoute } from "next";

// The schedule site is its own installable app, "EPT Schedule" (Trevor,
// 2026-10-02), separate from the one app the other sites share: it lives on
// its own address. Settings has the Get the app row. No service worker.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EPT Schedule",
    short_name: "EPT Schedule",
    description: "Book your English or Portuguese lesson with Trevor.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1b4332",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
