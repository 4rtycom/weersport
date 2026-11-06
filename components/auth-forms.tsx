"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

async function postJson(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; next?: string };
  return { ok: response.ok, data };
}

export function LoginForm({ confirmed = false, restored = false }: { confirmed?: boolean; restored?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [googleNote, setGoogleNote] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await postJson("/api/auth/inloggen", { email, password });
    setPending(false);
    if (!result.ok || !result.data.next) {
      setError(result.data.error ?? "E-mail of wachtwoord klopt niet. Probeer opnieuw.");
      requestAnimationFrame(() => document.querySelector(".auth-error")?.scrollIntoView({ block: "center" }));
      return;
    }
    router.push(result.data.next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="auth-eyebrow">{error ? "Account / error" : "Account / login"}</p>
      <h1>{error ? "We helpen je weer inloggen." : "Welkom terug."}</h1>
      <p className="auth-lead">
        {error ? "Controleer je gegevens of herstel je wachtwoord." : "Log in en plan jouw volgende buitensportmoment."}
      </p>
      {confirmed ? <p className="auth-inline-note">Je e-mailadres is geverifieerd. Log in om verder te gaan.</p> : null}
      {restored ? <p className="auth-inline-note">Je wachtwoord is opgeslagen. Log in met het nieuwe wachtwoord.</p> : null}
      <label className="auth-label" htmlFor="email">
        E-mailadres
      </label>
      <input
        id="email"
        className="auth-input"
        type="email"
        autoComplete="email"
        required
        placeholder="jij@voorbeeld.nl"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <div className="auth-label-row">
        <label className="auth-label" htmlFor="wachtwoord">
          Wachtwoord
        </label>
      </div>
      <input
        id="wachtwoord"
        className="auth-input"
        type="password"
        autoComplete="current-password"
        required
        placeholder="••••••••••••"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <p className="auth-forgot">
        <Link href="/auth/herstel">Wachtwoord vergeten?</Link>
      </p>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button button-dark auth-button" type="submit" disabled={pending}>
        Inloggen
      </button>
      <button
        className="button auth-button auth-button-soft"
        type="button"
        onClick={() => setGoogleNote("Doorgaan met Google is een concept en is nog niet gekoppeld.")}
      >
        Doorgaan met Google (optioneel)
      </button>
      {googleNote ? <p className="auth-inline-note">{googleNote}</p> : null}
      <p className="auth-switch">
        Nog geen account? <Link href="/auth/registreren">Gratis registreren</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await postJson("/api/auth/registreren", { name, email, password, terms });
    setPending(false);
    if (!result.data.next) {
      setError(result.data.error ?? "Account aanmaken is niet gelukt.");
      return;
    }
    router.push(result.data.next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="auth-eyebrow">Account / register</p>
      <h1>Maak je WeerSport-account.</h1>
      <p className="auth-lead">Start met Basis. Upgrade wanneer jij meer wilt zoeken.</p>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <label className="auth-label" htmlFor="naam">
        Naam
      </label>
      <input
        id="naam"
        className="auth-input"
        autoComplete="nickname"
        required
        placeholder="Voornaam of schermnaam"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <label className="auth-label" htmlFor="email">
        E-mailadres
      </label>
      <input
        id="email"
        className="auth-input"
        type="email"
        autoComplete="email"
        required
        placeholder="jij@voorbeeld.nl"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label className="auth-label" htmlFor="wachtwoord">
        Wachtwoord
      </label>
      <input
        id="wachtwoord"
        className="auth-input"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        placeholder="Minimaal 12 tekens"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <label className="auth-check">
        <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
        <span>
          Ik ga akkoord met de <Link href="/voorwaarden">voorwaarden</Link> en het{" "}
          <Link href="/privacy">privacybeleid</Link>.
        </span>
      </label>
      <button className="button button-dark auth-button" type="submit" disabled={pending}>
        Gratis account aanmaken
      </button>
      <p className="auth-switch">
        Al een account? <Link href="/auth/inloggen">Inloggen</Link>
      </p>
    </form>
  );
}

export function VerifyActions({
  email,
  mailPath,
  authClosed = false,
  delivery = "mailbox",
  sendFailed = false,
}: {
  email: string;
  mailPath: string | null;
  authClosed?: boolean;
  delivery?: "closed" | "inbox" | "mailbox";
  sendFailed?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [changing, setChanging] = useState(false);

  async function resend() {
    setError("");
    const result = await postJson("/api/auth/verifieer", {});
    if (!result.ok) {
      setError(result.data.error ?? "Opnieuw versturen is niet gelukt.");
      return;
    }
    if (result.data.next) {
      router.push(result.data.next);
      return;
    }
    setMessage("Er staat een nieuwe verificatielink klaar.");
    router.refresh();
  }

  async function prototype() {
    setError("");
    const result = await postJson("/api/auth/verifieer", { prototype: true });
    if (!result.ok || !result.data.next) {
      setError(result.data.error ?? "Verificatie is niet gelukt.");
      return;
    }
    router.push(result.data.next);
    router.refresh();
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = await postJson("/api/auth/email", { email: nextEmail });
    if (!result.ok) {
      setError(result.data.error ?? "Het e-mailadres is niet gewijzigd.");
      return;
    }
    setChanging(false);
    setMessage("Het adres is gewijzigd. Open de nieuwe verificatielink.");
    router.refresh();
  }

  return (
    <>
      <p className="auth-eyebrow">Account / verify</p>
      <h1>Controleer je e-mail.</h1>
      <p className="auth-lead">Verifieer je adres om veilig verder te gaan.</p>
      <div className="auth-panel">
        <h2>{sendFailed ? "Account aangemaakt" : "E-mailverificatie verzonden"}</h2>
        <p>
          {sendFailed
            ? `We konden nog geen verificatielink naar ${email} sturen. Vraag hieronder een nieuwe mail aan. Daarna ga je verder met de eerder gekozen sport, locatie en periode.`
            : `Open de link in je mailbox voor ${email}. Daarna ga je automatisch verder met de eerder gekozen sport, locatie en periode.`}
        </p>
      </div>
      {sendFailed ? (
        <p className="auth-error" role="alert">
          De verificatiemail kon niet worden verstuurd. Vraag hieronder een nieuwe mail aan.
        </p>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="auth-inline-note">{message}</p> : null}
      {authClosed ? (
        <p className="auth-inline-note">
          Browserverificatie en prototype-bypass zijn uitgeschakeld op deze omgeving totdat beveiligde
          e-mailbezorging beschikbaar is.
        </p>
      ) : (
        <>
          {delivery === "inbox" && !sendFailed ? (
            <p className="auth-inline-note">
              We hebben een beveiligde link naar {email} gestuurd. Er verschijnt geen token in deze browser.
            </p>
          ) : null}
          <button className="button button-dark auth-button" type="button" onClick={resend}>
            Verificatiemail opnieuw sturen
          </button>
          <button
            className="button auth-button auth-button-soft"
            type="button"
            onClick={() => setChanging((value) => !value)}
          >
            Ander e-mailadres gebruiken
          </button>
          {changing ? (
            <form className="auth-inline-form" onSubmit={changeEmail}>
              <label className="auth-label" htmlFor="nieuw-email">
                Nieuw e-mailadres
              </label>
              <input
                id="nieuw-email"
                className="auth-input"
                type="email"
                required
                value={nextEmail}
                onChange={(event) => setNextEmail(event.target.value)}
              />
              <button className="button button-dark auth-button" type="submit">
                Adres opslaan
              </button>
            </form>
          ) : null}
          {delivery === "mailbox" ? (
            <button className="button button-lime auth-button" type="button" onClick={prototype}>
              Prototype: e-mailverificatie voltooid →
            </button>
          ) : null}
          {mailPath ? (
            <p className="auth-dev-mail">
              Er is geen mailserver gekoppeld. Dezelfde verificatie staat in deze ontwikkelmailbox:{" "}
              <Link href={mailPath}>Open de verificatielink</Link>
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

export function ResetRequestForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await postJson("/api/auth/herstel", { email });
    setPending(false);
    if (!result.ok || !result.data.next) {
      setError(result.data.error ?? "De herstelmail is niet aangevraagd.");
      return;
    }
    router.push(result.data.next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="auth-eyebrow">Account / reset</p>
      <h1>Wachtwoord vergeten?</h1>
      <p className="auth-lead">Ontvang een beveiligde link om een nieuw wachtwoord in te stellen.</p>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <label className="auth-label" htmlFor="email">
        E-mailadres
      </label>
      <input
        id="email"
        className="auth-input"
        type="email"
        autoComplete="email"
        required
        placeholder="jij@voorbeeld.nl"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button className="button button-dark auth-button" type="submit" disabled={pending}>
        Stuur herstel-link
      </button>
      <p className="auth-inline-note">Resetlinks zijn tijdelijk geldig. Deel de link nooit.</p>
      <Link className="button auth-button auth-button-soft" href="/auth/inloggen">
        Terug naar inloggen
      </Link>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await postJson("/api/auth/wachtwoord", { token, password });
    setPending(false);
    if (!result.ok || !result.data.next) {
      setError(result.data.error ?? "Het wachtwoord is niet opgeslagen.");
      return;
    }
    router.push(result.data.next);
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="auth-eyebrow">Account / reset</p>
      <h1>Kies een nieuw wachtwoord.</h1>
      <p className="auth-lead">De herstel-link werkt één keer. Daarna log je opnieuw in.</p>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <label className="auth-label" htmlFor="nieuw-wachtwoord">
        Nieuw wachtwoord
      </label>
      <input
        id="nieuw-wachtwoord"
        className="auth-input"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        placeholder="Minimaal 12 tekens"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button className="button button-dark auth-button" type="submit" disabled={pending}>
        Wachtwoord opslaan
      </button>
      <Link className="button auth-button auth-button-soft" href="/auth/inloggen">
        Terug naar inloggen
      </Link>
    </form>
  );
}
