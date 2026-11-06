"use client";

import { useRef, useState, type FormEvent } from "react";
import { PlaceField } from "@/components/place-field";

type Field = "name" | "organisation" | "email" | "message" | "sport" | "region" | "start" | "intent";
type Errors = Partial<Record<Field | "form", string>>;
type Intent = "pilot" | "custom";

const fields: { id: "name" | "organisation" | "email"; label: string; autoComplete: string }[] = [
  { id: "name", label: "Naam", autoComplete: "name" },
  { id: "organisation", label: "Organisatie", autoComplete: "organization" },
  { id: "email", label: "E-mailadres", autoComplete: "email" },
];

export function SponsoringForm({
  initialIntent,
  sports,
}: {
  initialIntent: Intent;
  sports: { id: string; name: string }[];
}) {
  const [values, setValues] = useState({
    name: "",
    organisation: "",
    email: "",
    message: "",
    wsHp: "",
    intent: initialIntent,
    sportId: "",
    placeId: "",
    placeLabel: "",
    desiredStart: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [receivedId, setReceivedId] = useState<string | null>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setErrors({});
    try {
      const response = await fetch("/api/sponsoring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          organisation: values.organisation,
          email: values.email,
          message: values.message,
          wsHp: values.wsHp,
          intent: values.intent,
          sportId: values.intent === "pilot" ? values.sportId : undefined,
          placeId: values.intent === "pilot" ? values.placeId : undefined,
          placeLabel: values.intent === "pilot" ? values.placeLabel : undefined,
          desiredStart: values.intent === "pilot" ? values.desiredStart : undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        errors?: Errors;
      };
      if (!response.ok || !data.ok || !data.id) {
        setErrors(data.errors ?? { form: "De aanvraag is niet ontvangen. Probeer het opnieuw." });
        setPending(false);
        lock.current = false;
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      setReceivedId(data.id);
      setPending(false);
      requestAnimationFrame(() => successRef.current?.focus());
    } catch {
      setErrors({ form: "De aanvraag is niet ontvangen. Probeer het opnieuw." });
      setPending(false);
      lock.current = false;
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
          Bewaar je aanvraagnummer <strong>{receivedId}</strong>. Er wordt geen bevestigingsmail verstuurd.
        </p>
      </div>
    );
  }

  const errorEntries = (Object.keys(errors) as (keyof Errors)[]).filter((key) => errors[key]);
  const pilot = values.intent === "pilot";

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
                  <a href={`#sponsor-${key === "region" ? "region" : key}`}>{errors[key]}</a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <fieldset className="sponsor-intent">
        <legend>Type aanvraag</legend>
        <label htmlFor="sponsor-intent-pilot">
          <input
            id="sponsor-intent-pilot"
            type="radio"
            name="intent"
            value="pilot"
            checked={values.intent === "pilot"}
            onChange={() => setValues((current) => ({ ...current, intent: "pilot" }))}
          />
          Pilot, één sport en één regio
        </label>
        <label htmlFor="sponsor-intent-custom">
          <input
            id="sponsor-intent-custom"
            type="radio"
            name="intent"
            value="custom"
            checked={values.intent === "custom"}
            onChange={() => setValues((current) => ({ ...current, intent: "custom" }))}
          />
          Maatwerk
        </label>
      </fieldset>
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
      {pilot ? (
        <>
          <div>
            <label className="auth-label" htmlFor="sponsor-sport">
              Sport
            </label>
            <select
              id="sponsor-sport"
              className="auth-input"
              name="sportId"
              value={values.sportId}
              aria-invalid={Boolean(errors.sport)}
              aria-describedby={errors.sport ? "sponsor-sport-error" : undefined}
              onChange={(event) => setValues((current) => ({ ...current, sportId: event.target.value }))}
            >
              <option value="">Kies een sport</option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
            {errors.sport ? (
              <p className="sponsor-field-error" id="sponsor-sport-error">
                {errors.sport}
              </p>
            ) : null}
          </div>
          <div>
            <label className="auth-label" htmlFor="sponsor-region">
              Regio
            </label>
            <PlaceField
              inputId="sponsor-region"
              label={values.placeLabel}
              placeId={values.placeId}
              invalid={Boolean(errors.region)}
              describedBy={errors.region ? "sponsor-region-error" : "sponsor-region-hint"}
              onChange={(next) => setValues((current) => ({ ...current, placeId: next.placeId, placeLabel: next.label }))}
            />
            <p className="sponsor-hint" id="sponsor-region-hint">
              Eén Nederlandse plaats, bijvoorbeeld Ede.
            </p>
            {errors.region ? (
              <p className="sponsor-field-error" id="sponsor-region-error">
                {errors.region}
              </p>
            ) : null}
          </div>
          <div>
            <label className="auth-label" htmlFor="sponsor-start">
              Gewenste startdatum (optioneel)
            </label>
            <input
              id="sponsor-start"
              className="auth-input"
              name="desiredStart"
              type="date"
              value={values.desiredStart}
              aria-invalid={Boolean(errors.start)}
              aria-describedby={errors.start ? "sponsor-start-error" : "sponsor-start-hint"}
              onChange={(event) => setValues((current) => ({ ...current, desiredStart: event.target.value }))}
            />
            <p className="sponsor-hint" id="sponsor-start-hint">
              We leggen de startdatum pas vast na akkoord. Dit veld is een wens.
            </p>
            {errors.start ? (
              <p className="sponsor-field-error" id="sponsor-start-error">
                {errors.start}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
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
          {pilot
            ? "Beschrijf de vermelding die je voor ogen hebt. Minimaal 20 tekens."
            : "Je kunt meerdere sporten, regio's of een seizoen in dit bericht beschrijven. Minimaal 20 tekens."}
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
