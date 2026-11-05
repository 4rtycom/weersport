import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "WeerSport",
    template: "%s · WeerSport",
  },
  description: "Ontdek het beste moment om buiten te sporten in Nederland. Voorbeeldinterface, nog zonder live weerdata.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="nl" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
