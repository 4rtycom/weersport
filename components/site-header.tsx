"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const links = [
  { href: "/#stappen", label: "Hoe werkt het" },
  { href: "/sporten", label: "Alle sporten" },
  { href: "/#weer-uv", label: "Weer & UV" },
  { href: "/account", label: "Account" },
];

export function SiteHeader({ account: _account }: { account?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <a className="skip-link" href="#inhoud">
        Naar inhoud
      </a>
      <Link className="brand-lockup" href="/" aria-label="WeerSport, naar de homepage">
        <BrandMark size={42} />
        <span>WeerSport.</span>
      </Link>
      <nav className="desktop-nav" aria-label="Hoofdmenu">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
        <Link className="button button-lime nav-cta" href="/account/momenten">
          Mijn momenten →
        </Link>
      </nav>
      <button
        className="menu-button"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="visually-hidden">{open ? "Sluit menu" : "Open menu"}</span>
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
      </button>
      {open ? (
        <nav id="mobile-menu" className="mobile-nav" aria-label="Mobiel menu">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link className="button button-lime" href="/account/momenten" onClick={() => setOpen(false)}>
            Mijn momenten →
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
