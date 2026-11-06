import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { ConsentRoot } from "@/components/consent-root";
import { robotsDirective, SITE_DESCRIPTION, SITE_NAME, siteOrigin } from "@/lib/site";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

const origin = siteOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  robots: robotsDirective(),
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: origin,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="nl" className={manrope.variable}>
      <head>
        <link rel="preload" href="/home/halo.svg" as="image" type="image/svg+xml" />
        <link rel="preload" href="/home/lime-dot.svg" as="image" type="image/svg+xml" />
      </head>
      <body>
        {children}
        <ConsentRoot />
      </body>
    </html>
  );
}
