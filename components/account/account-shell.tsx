import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeaderBar } from "@/components/site-header-bar";

const links = [
  { href: "/account", label: "Overzicht", match: "overview" as const },
  { href: "/account/momenten", label: "Sportmomenten", match: "momenten" as const },
  { href: "/account/zoekopdrachten", label: "Zoekopdrachten", match: "zoekopdrachten" as const },
  { href: "/account/sporten", label: "Mijn sporten", match: "sporten" as const },
  { href: "/account/voorkeuren", label: "Voorkeuren", match: "voorkeuren" as const },
  { href: "/account/abonnement", label: "Abonnement", match: "abonnement" as const },
  { href: "/account/facturering", label: "Facturering", match: "facturering" as const },
  { href: "/account/privacy", label: "Privacy", match: "privacy" as const },
];

/**
 * Account pages share the homepage pattern: the dark header band continues with the account tabs and the
 * page heading, and the first card overlaps the band like the planner does on the homepage.
 */
export function AccountShell({
  active,
  accountName,
  breadcrumb: _breadcrumb,
  planLabel = "Basis",
  children,
}: {
  active: (typeof links)[number]["match"];
  accountName: string;
  /** Kept for existing callers; the tabs now show where you are. */
  breadcrumb: string;
  planLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="account-frame">
      <a className="skip-link" href="#inhoud">
        Naar inhoud
      </a>
      <SiteHeaderBar account />
      <div className="account-band">
        <div className="account-band-inner">
          <nav className="account-tabs" aria-label="Accountnavigatie">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={active === link.match ? "is-active" : undefined}
                aria-current={active === link.match ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="account-who">
            {accountName}
            <span>{planLabel}</span>
          </p>
        </div>
      </div>
      <main className="account-content" id="inhoud">
        {children}
      </main>
    </div>
  );
}
