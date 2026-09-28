import type { MetadataRoute } from "next";

// Lets the site be added to a phone's home screen, which iPhones require
// before a site may send push notifications (the admin's alerts).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "English & Portuguese with Trevor: Schedule",
    short_name: "EPT Schedule",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1b4332",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
