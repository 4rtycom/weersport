import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const links = [
  { href: "/account", label: "Overzicht", match: "overview" as const },
  { href: "/account/momenten", label: "Mijn sportmomenten", match: "momenten" as const },
  { href: "/account/zoekopdrachten", label: "Opgeslagen zoekopdrachten", match: "zoekopdrachten" as const },
  { href: "/account/sporten", label: "Mijn sporten", match: "sporten" as const },
  { href: "/account/voorkeuren", label: "Voorkeuren", match: "voorkeuren" as const },
];

export function AccountShell({
  active,
  accountName,
  breadcrumb,
  children,
}: {
  active: (typeof links)[number]["match"];
  accountName: string;
  breadcrumb: string;
  children: ReactNode;
}) {
  return (
    <div className="account-app">
      <aside className="account-sidebar" aria-label="Accountnavigatie">
        <Link className="account-brand" href="/" aria-label="WeerSport, naar de homepage">
          <BrandMark size={36} />
          <span>WeerSport.</span>
        </Link>
        <p className="account-sidebar-label">Mijn omgeving</p>
        <nav className="account-side-nav">
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
        <p className="account-sidebar-foot">Sportweer voor Nederland</p>
      </aside>
      <div className="account-main">
        <header className="account-topbar">
          <p>{breadcrumb}</p>
          <span className="account-badge">Basis · opslaan = 0</span>
          <span className="account-user">{accountName}</span>
        </header>
        <div className="account-content">{children}</div>
      </div>
    </div>
  );
}
