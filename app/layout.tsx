import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { ConsentRoot } from "@/components/consent-root";
import { PwaInstall } from "@/components/pwa-install";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

export const viewport: Viewport = {
  themeColor: "#0B2530",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "WeerSport",
    template: "%s · WeerSport",
  },
  description: "Ontdek het beste moment om buiten te sporten in Nederland. Voorbeeldinterface, nog zonder live weerdata.",
  applicationName: "WeerSport",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "WeerSport",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="nl" className={manrope.variable}>
      <body>
        {children}
        <ConsentRoot />
        <PwaInstall />
      </body>
    </html>
  );
}
