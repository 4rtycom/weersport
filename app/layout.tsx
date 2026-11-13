import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { ConsentRoot } from "@/components/consent-root";
import { SiteFooter } from "@/components/site-footer";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "WeerSport · Het beste moment om buiten te sporten",
    template: "%s · WeerSport",
  },
  description:
    "Kies je buitensport en je plek in Nederland. WeerSport rekent de komende 48 uur door en laat zien wanneer het weer het beste past.",
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: "WeerSport",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="nl" className={manrope.variable}>
      <body>
        {children}
        <SiteFooter />
        <ConsentRoot />
        {/* Cookieless page-view counts. Turn on Web Analytics in Vercel, then set NEXT_PUBLIC_ANALYTICS=vercel. */}
        {process.env.NEXT_PUBLIC_ANALYTICS === "vercel" ? <script defer src="/_vercel/insights/script.js" /> : null}
      </body>
    </html>
  );
}
