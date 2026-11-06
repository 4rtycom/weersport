"use client";

import { useRef, useState, type FormEvent } from "react";

type Field = "name" | "organisation" | "email" | "message";
type Errors = Partial<Record<Field | "form", string>>;

const fields: { id: Field; label: string; autoComplete: string }[] = [
  { id: "name", label: "Naam", autoComplete: "name" },
  { id: "organisation", label: "Organisatie", autoComplete: "organization" },
  { id: "email", label: "E-mailadres", autoComplete: "email" },
];

export function SponsoringForm() {
  const [values, setValues] = useState({ name: "", organisation: "", email: "", message: "", wsHp: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [receivedId, setReceivedId] = useState<string | null>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const response = await fetch("/api/sponsoring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        errors?: Errors;
      };
      if (!response.ok || !data.ok || !data.id) {
        setErrors(data.errors ?? { form: "De aanvraag is niet ontvangen. Probeer het opnieuw." });
        setPending(false);
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      setReceivedId(data.id);
      setPending(false);
      requestAnimationFrame(() => successRef.current?.focus());
    } catch {
      setErrors({ form: "De aanvraag is niet ontvangen. Probeer het opnieuw." });
      setPending(false);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  if (receivedId) {
    return (
      <div className="sponsor-success" role="status">
        <h2 id="sponsoring-ontvangen" tabIndex={-1} ref={successRef}>
          Aanvraag ontvangen
        </h2>
        <p>
          Bewaar je aanvraagnummer <strong>{receivedId}</strong> voor vragen over je samenwerking.
        </p>
      </div>
    );
  }

  const errorEntries = (Object.keys(errors) as (keyof Errors)[]).filter((key) => errors[key]);

  return (
    <form className="sponsor-form" onSubmit={onSubmit} noValidate>
      {errorEntries.length > 0 ? (
        <div className="sponsor-errors" role="alert" tabIndex={-1} ref={summaryRef}>
          <p>Controleer de aanvraag.</p>
          <ul>
            {errorEntries.map((key) => (
              <li key={key}>
                {key === "form" ? (
                  errors[key]
                ) : (
                  <a href={`#sponsor-${key}`}>{errors[key]}</a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {fields.map((field) => {
        const errorId = `sponsor-${field.id}-error`;
        return (
          <div key={field.id}>
            <label className="auth-label" htmlFor={`sponsor-${field.id}`}>
              {field.label}
            </label>
            <input
              id={`sponsor-${field.id}`}
              className="auth-input"
              name={field.id}
              type={field.id === "email" ? "email" : "text"}
              autoComplete={field.autoComplete}
              required
              aria-invalid={Boolean(errors[field.id])}
              aria-describedby={errors[field.id] ? errorId : undefined}
              value={values[field.id]}
              onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
            />
            {errors[field.id] ? (
              <p className="sponsor-field-error" id={errorId}>
                {errors[field.id]}
              </p>
            ) : null}
          </div>
        );
      })}
      <div>
        <label className="auth-label" htmlFor="sponsor-message">
          Wat heb je in gedachten?
        </label>
        <textarea
          id="sponsor-message"
          className="auth-input sponsor-textarea"
          name="message"
          required
          rows={5}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "sponsor-message-error" : "sponsor-message-hint"}
          value={values.message}
          onChange={(event) => setValues((current) => ({ ...current, message: event.target.value }))}
        />
        <p className="sponsor-hint" id="sponsor-message-hint">
          Bijvoorbeeld een vermelding voor je fietsenwinkel tijdens het voorjaar. Minimaal 20 tekens.
        </p>
        {errors.message ? (
          <p className="sponsor-field-error" id="sponsor-message-error">
            {errors.message}
          </p>
        ) : null}
      </div>
      <div className="sponsor-honeypot" aria-hidden="true">
        <label htmlFor="sponsor-ws-hp">Leeg laten</label>
        <input
          id="sponsor-ws-hp"
          name="wsHp"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          value={values.wsHp}
          onChange={(event) => setValues((current) => ({ ...current, wsHp: event.target.value }))}
        />
      </div>
      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? "Versturen…" : "Verstuur aanvraag"}
      </button>
    </form>
  );
}
