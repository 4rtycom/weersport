"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

const links = [
  { href: "/#stappen", label: "Hoe werkt het" },
  { href: "/sporten", label: "Alle sporten" },
  { href: "/#weer-uv", label: "Weer & UV" },
  { href: "/account", label: "Account" },
];

function isCurrent(pathname: string | null, href: string) {
  if (!pathname || href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ account: _account }: { account?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const momentsCurrent = pathname === "/account/momenten";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
          <Link
            key={link.href}
            href={link.href}
            aria-current={isCurrent(pathname, link.href) && !momentsCurrent ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
        <Link
          className="button button-lime nav-cta"
          href="/account/momenten"
          aria-current={momentsCurrent ? "page" : undefined}
        >
          Mijn momenten →
        </Link>
      </nav>
      <button
        ref={buttonRef}
        className="menu-button"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="visually-hidden">{open ? "Sluit menu" : "Open menu"}</span>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          {open ? (
            <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          ) : (
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          )}
        </svg>
      </button>
      {open ? (
        <nav id="mobile-menu" className="mobile-nav" aria-label="Mobiel menu">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(pathname, link.href) && !momentsCurrent ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
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
