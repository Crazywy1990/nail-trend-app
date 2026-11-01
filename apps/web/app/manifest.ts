import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AllTen",
    short_name: "AllTen",
    description: "Trending nail looks picked for you, with the specs your nail tech needs.",
    start_url: "/?ref=pwa",
    display: "standalone",
    background_color: "#FCF9F7",
    theme_color: "#C2416B",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
