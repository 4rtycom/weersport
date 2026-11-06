"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const links = [
  { href: "/#stappen", label: "Hoe werkt het" },
  { href: "/sporten", label: "Alle sporten" },
  { href: "/#weer-uv", label: "Weer & UV" },
];

export function SiteHeader({ account = false }: { account?: boolean }) {
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
        {account ? <Link href="/account">Account</Link> : null}
        {account ? (
          <Link className="button button-lime nav-cta" href="/account/momenten">
            Mijn momenten →
          </Link>
        ) : (
          <Link className="button button-lime nav-cta" href="/auth/inloggen">
            Inloggen →
          </Link>
        )}
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
          {account ? (
            <Link href="/account" onClick={() => setOpen(false)}>
              Account
            </Link>
          ) : null}
          {account ? (
            <Link className="button button-lime" href="/account/momenten" onClick={() => setOpen(false)}>
              Mijn momenten →
            </Link>
          ) : (
            <Link className="button button-lime" href="/auth/inloggen" onClick={() => setOpen(false)}>
              Inloggen →
            </Link>
          )}
        </nav>
      ) : null}
    </header>
  );
}
