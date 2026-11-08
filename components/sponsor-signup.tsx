"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "@/app/sponsoring/signup.module.css";
import { sports } from "@/lib/sports";

const GROUPS = [
  { title: "Fietsen", ids: ["fietsen", "wielrennen", "gravelbiken", "mountainbiken"] },
  { title: "Lopen en wandelen", ids: ["hardlopen", "trailrunning", "wandelen", "hiken"] },
  { title: "Bal- en racketsporten", ids: ["golf", "tennis-padel", "voetbal", "hockey"] },
  { title: "Watersport", ids: ["zeilen", "windsurfen", "kitesurfen", "surfen", "suppen", "kajakken", "roeien", "openwaterzwemmen"] },
  { title: "Overige buitensporten", ids: ["skeeleren", "paardrijden", "schaatsen", "outdoorfitness"] },
];

type Quote = {
  id: string;
  grossCents: number;
  netCents: number;
  vatCents: number;
  label: string;
  rateMode: "example" | "confirmed";
  lines: Array<{ sportName: string }>;
};

function euros(cents: number) {
  const eurosPart = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `€ ${eurosPart.toLocaleString("nl-NL")},${rest}`;
}

export function SponsorSignup({ signupOpen }: { signupOpen: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [publicName, setPublicName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [legalTouched, setLegalTouched] = useState(false);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [logoId, setLogoId] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [vatId, setVatId] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const names = selected
    .map((id) => sports.find((sport) => sport.id === id)?.name ?? id)
    .sort((a, b) => a.localeCompare(b, "nl"));

  useEffect(() => {
    if (!legalTouched) setLegalName(publicName);
  }, [publicName, legalTouched]);

  useEffect(() => {
    if (window.location.hash === "#kiezer") dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (selected.length === 0) {
      setQuote(null);
      setQuoteError("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch("/api/sponsoring/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sportIds: selected, country: "NL" }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json()) as { ok?: boolean; quote?: Quote; error?: string };
          if (!response.ok || !body.quote) {
            setQuote(null);
            setQuoteError(body.error ?? "De offerte kon niet worden berekend.");
            return;
          }
          setQuote(body.quote);
          setQuoteError("");
        })
        .catch(() => {
          if (!controller.signal.aborted) setQuoteError("De offerte kon niet worden berekend.");
        });
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [selected]);

  function openPicker() {
    setDraft(selected);
    dialogRef.current?.showModal();
  }

  function useSelection() {
    setSelected(draft);
    dialogRef.current?.close();
    openerRef.current?.focus();
  }

  function cancelSelection() {
    setDraft(selected);
    dialogRef.current?.close();
    openerRef.current?.focus();
  }

  async function uploadLogo(file: File) {
    const body = new FormData();
    body.set("logo", file);
    const response = await fetch("/api/sponsoring/logo", { method: "POST", body });
    const payload = (await response.json()) as { ok?: boolean; id?: string; error?: string };
    if (!response.ok || !payload.id) {
      setErrors((current) => ({ ...current, logo: payload.error ?? "Het logo is niet geaccepteerd." }));
      setLogoId("");
      return;
    }
    setLogoId(payload.id);
    setErrors((current) => ({ ...current, logo: "" }));
  }

  async function pay() {
    setPending(true);
    setErrors({});
    try {
      if (!quote) {
        setErrors({ form: quoteError || "Kies eerst minstens één sport." });
        return;
      }
      const response = await fetch("/api/sponsoring/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          attemptId: crypto.randomUUID(),
          publicName,
          destinationUrl,
          logoId,
          consent,
          clientGrossCents: quote.grossCents,
          billing: { legalName, street, postalCode, city, country: "NL", vatId, invoiceEmail },
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        errors?: Record<string, string>;
        checkout?: { checkoutUrl: string };
      };
      if (!response.ok || !payload.checkout?.checkoutUrl) {
        setErrors(payload.errors ?? { form: "De betaling kon niet worden gestart." });
        return;
      }
      window.location.assign(payload.checkout.checkoutUrl);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.main}>
      <p className={styles.kicker}>Word sportsponsor</p>
      <h1>Sponsor een sport, in heel Nederland</h1>
      <p className={styles.lead}>
        Eén vast maandbedrag per sport, één contract en één factuur per periode. De eerste termijn gaat via iDEAL.
        Daarna int WeerSport via een Mollie-verkoopfactuur. Er start geen apart abonnement.
      </p>
      {!signupOpen ? <p className={styles.error} role="alert">De sponsoraanmelding is nog niet open.</p> : null}

      <section className={styles.card} aria-labelledby="publiek">
        <h2 id="publiek">Openbare vermelding</h2>
        <div className={styles.grid}>
          <label>
            Bedrijfsnaam
            <input value={publicName} onChange={(event) => setPublicName(event.target.value)} autoComplete="organization" />
          </label>
          {errors.publicName ? <p className={styles.error} role="alert">{errors.publicName}</p> : null}
          <label>
            Website
            <input value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} inputMode="url" placeholder="https://" />
          </label>
          {errors.destinationUrl ? <p className={styles.error} role="alert">{errors.destinationUrl}</p> : null}
          <label>
            Logo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
          </label>
          {errors.logo ? <p className={styles.error} role="alert">{errors.logo}</p> : null}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="sporten">
        <h2 id="sporten">Sporten</h2>
        <p className={styles.help}>Geen sporten zijn voorgeselecteerd. Een sport geldt in alle plaatsen.</p>
        <div className={styles.actions}>
          <button ref={openerRef} className="button button-dark" type="button" onClick={openPicker}>
            Kies uit 24 sporten
          </button>
        </div>
        {names.length > 4 ? (
          <details className={styles.names}>
            <summary>{names.length} sporten geselecteerd</summary>
            {names.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </details>
        ) : (
          <div className={styles.names}>
            {names.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        )}
        <p className={styles.total} aria-live="polite">
          <span>{selected.length === 0 ? "Nog geen sporten" : `${selected.length} ${selected.length === 1 ? "sport" : "sporten"}`}</span>
          <strong>{quote ? euros(quote.grossCents) : "—"}</strong>
        </p>
        {quote ? <p className={styles.note}>{quote.label} Netto {euros(quote.netCents)}, btw {euros(quote.vatCents)}.</p> : null}
        {quoteError ? <p className={styles.error} role="alert">{quoteError}</p> : null}
      </section>

      <section className={styles.card} aria-labelledby="factuur">
        <h2 id="factuur">Factuurgegevens</h2>
        <p className={styles.help}>Deze gegevens blijven privé en komen niet bij de vermelding.</p>
        <div className={styles.grid}>
          <label>
            Juridische naam
            <input value={legalName} onChange={(event) => { setLegalTouched(true); setLegalName(event.target.value); }} autoComplete="organization" />
          </label>
          {errors.legalName ? <p className={styles.error} role="alert">{errors.legalName}</p> : null}
          <label>
            Straat en huisnummer
            <input value={street} onChange={(event) => setStreet(event.target.value)} autoComplete="street-address" />
          </label>
          {errors.street ? <p className={styles.error} role="alert">{errors.street}</p> : null}
          <label>
            Postcode
            <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} autoComplete="postal-code" />
          </label>
          {errors.postalCode ? <p className={styles.error} role="alert">{errors.postalCode}</p> : null}
          <label>
            Plaats
            <input value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" />
          </label>
          {errors.city ? <p className={styles.error} role="alert">{errors.city}</p> : null}
          <label>
            Land
            <select defaultValue="NL" aria-describedby="land-hulp">
              <option value="NL">Nederland</option>
              <option value="BE" disabled>België — nog niet beschikbaar</option>
            </select>
          </label>
          <p id="land-hulp" className={styles.help}>Facturatie buiten Nederland is nog niet beschikbaar.</p>
          <label>
            Btw-nummer, indien van toepassing
            <input value={vatId} onChange={(event) => setVatId(event.target.value)} />
          </label>
          {errors.vatId ? <p className={styles.error} role="alert">{errors.vatId}</p> : null}
          <label>
            Factuur-e-mail
            <input value={invoiceEmail} onChange={(event) => setInvoiceEmail(event.target.value)} autoComplete="email" inputMode="email" />
          </label>
          {errors.invoiceEmail ? <p className={styles.error} role="alert">{errors.invoiceEmail}</p> : null}
        </div>
      </section>

      <section className={styles.card}>
        <label>
          <span>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Ik machtig de maandelijkse incasso na de eerste iDEAL-betaling.
          </span>
        </label>
        {errors.consent ? <p className={styles.error} role="alert">{errors.consent}</p> : null}
        {errors.form ? <p className={styles.error} role="alert">{errors.form}</p> : null}
        {errors.quote ? <p className={styles.error} role="alert">{errors.quote}</p> : null}
        <div className={styles.actions}>
          <button className="button button-lime" type="button" disabled={!signupOpen || selected.length === 0 || pending || !quote} onClick={() => void pay()}>
            Betalen met iDEAL
          </button>
        </div>
      </section>

      <dialog ref={dialogRef} className={styles.picker} aria-labelledby={titleId} onCancel={cancelSelection}>
        <div className={styles.pickerBody}>
          <h2 id={titleId}>Kies uit 24 sporten</h2>
          <div className={styles.groups}>
            {GROUPS.map((group) => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                {group.ids.map((id) => {
                  const sport = sports.find((item) => item.id === id);
                  return (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={draft.includes(id)}
                        onChange={(event) => {
                          setDraft((current) =>
                            event.target.checked ? [...current, id] : current.filter((item) => item !== id),
                          );
                        }}
                      />
                      <span>{sport?.name ?? id}</span>
                    </label>
                  );
                })}
              </section>
            ))}
          </div>
          <div className={styles.actions}>
            <button className="button button-lime" type="button" onClick={useSelection}>
              Gebruik mijn selectie
            </button>
            <button className="button button-dark" type="button" onClick={cancelSelection}>
              Annuleren
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
