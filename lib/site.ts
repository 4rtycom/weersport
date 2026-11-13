/** Public base URL for sitemap, robots and share metadata. Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://weersport.nl").replace(/\/$/, "");

/** Main navigation, shared by the header. */
export const mainNav = [
  { href: "/hoe-werkt-het", label: "Hoe werkt het" },
  { href: "/sporten", label: "Sporten" },
  { href: "/weer-en-uv", label: "Weer & UV" },
  { href: "/prijzen", label: "Prijzen" },
] as const;

/** Footer columns: the full map of public pages. */
export const footerNav = [
  {
    title: "WeerSport",
    links: [
      { href: "/hoe-werkt-het", label: "Hoe werkt het" },
      { href: "/sporten", label: "Alle sporten" },
      { href: "/weer-en-uv", label: "Weer & UV" },
      { href: "/prijzen", label: "Prijzen" },
    ],
  },
  {
    title: "Hulp",
    links: [
      { href: "/hoe-werkt-het#vragen", label: "Veelgestelde vragen" },
      { href: "/support", label: "Support" },
      { href: "/support/terugbetaling", label: "Terugbetalingen" },
      { href: "/account", label: "Mijn account" },
    ],
  },
  {
    title: "Over",
    links: [
      { href: "/sponsoring", label: "Samenwerken" },
      { href: "/privacy", label: "Privacy" },
      { href: "/voorwaarden", label: "Voorwaarden" },
    ],
  },
] as const;

export function formatEuro(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value);
  return `€ ${amount.toFixed(2).replace(".", ",")}`;
}
