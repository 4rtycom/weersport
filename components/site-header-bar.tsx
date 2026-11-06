import { SiteHeader } from "@/components/site-header";

/** Homepage header chrome: the same SiteHeader markup, inside the hero bar. */
export function SiteHeaderBar({ account }: { account?: boolean }) {
  return (
    <section className="hero site-header-bar">
      <SiteHeader account={account} />
    </section>
  );
}
