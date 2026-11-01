import type { Metadata, Viewport } from "next";
import "./globals.css";
import { requestSeason, siteUrl } from "@/lib/request";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "AllTen", template: "%s · AllTen" },
  description: "Trending nail looks picked for you, with the shades and specs your nail tech needs.",
  applicationName: "AllTen",
  appleWebApp: { capable: true, title: "AllTen", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FCF9F7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const season = requestSeason();
  return (
    <html lang="en" data-season={season}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=DM+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
