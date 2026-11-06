"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const links = [
  { href: "/#stappen", label: "Hoe werkt het" },
  { href: "/sporten", label: "Alle sporten" },
  { href: "/#weer-uv", label: "Weer & UV" },
];

export function SiteHeader({ account }: { account?: boolean }) {
  const [open, setOpen] = useState(false);
  // Omitted `account` is unknown (static guides and legal pages), not logged out.
  const [signedIn, setSignedIn] = useState(account ?? false);
  const [ready, setReady] = useState(account !== undefined);

  useEffect(() => {
    if (account !== undefined) {
      setSignedIn(account);
      setReady(true);
      return;
    }

    const controller = new AbortController();
    fetch("/api/auth/sessie", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("sessie");
        return (await response.json()) as { signedIn?: boolean };
      })
      .then((data) => {
        setSignedIn(Boolean(data.signedIn));
        setReady(true);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setSignedIn(false);
        setReady(true);
      });
    return () => controller.abort();
  }, [account]);

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
        {ready && signedIn ? <Link href="/account">Account</Link> : null}
        {ready ? (
          signedIn ? (
            <Link className="button button-lime nav-cta" href="/account/momenten">
              Mijn momenten →
            </Link>
          ) : (
            <Link className="button button-lime nav-cta" href="/auth/inloggen">
              Inloggen →
            </Link>
          )
        ) : null}
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
          {ready && signedIn ? (
            <Link href="/account" onClick={() => setOpen(false)}>
              Account
            </Link>
          ) : null}
          {ready ? (
            signedIn ? (
              <Link className="button button-lime" href="/account/momenten" onClick={() => setOpen(false)}>
                Mijn momenten →
              </Link>
            ) : (
              <Link className="button button-lime" href="/auth/inloggen" onClick={() => setOpen(false)}>
                Inloggen →
              </Link>
            )
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
