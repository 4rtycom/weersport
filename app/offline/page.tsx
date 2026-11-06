import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main id="inhoud" className="offline-page">
      <style>{`
        .offline-page { max-width: 36rem; margin: 0 auto; padding: 48px 20px 80px; color: #0b2530; font-family: Manrope, sans-serif; }
        .offline-page h1 { font-size: 2rem; line-height: 1.15; margin: 12px 0; }
        .offline-page p { margin: 0 0 12px; }
        .offline-page a { color: #216c69; font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; }
      `}</style>
      <p className="eyebrow">WeerSport</p>
      <h1>Je bent offline</h1>
      <p>
        Deze pagina heeft geen persoonlijk sportmoment, geen betaling en geen actuele waarschuwing. Die gegevens worden
        niet offline bewaard.
      </p>
      <p>Controleer je verbinding en open WeerSport opnieuw voor een actueel advies.</p>
      <Link href="/">Opnieuw proberen</Link>
    </main>
  );
}
