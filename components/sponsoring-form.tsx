"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PlaceField } from "@/components/place-field";
import { FietsMomentPage } from "@/components/fiets-moment-page";
import { placeSelectionLabel } from "@/lib/place-label";
import {
  AREA_CHOICES,
  CAMPAIGN_REQUEST_TYPE,
  areaFromChoice,
  formatDutchDate,
  formatPeriod,
  inclusiveCampaignEnd,
  isEmailAddress,
  parseCampaignStart,
  parseWeeks,
  plainLine,
  summaryTitle,
  weeksLabel,
  type AreaKind,
} from "@/lib/sponsoring/campaign";
import { amsterdamToday } from "@/lib/sponsoring/period";
import styles from "@/app/sponsoring/partners.module.css";

type Step = "campaign" | "contact" | "received";
type Errors = Partial<
  Record<"sport" | "region" | "area" | "start" | "weeks" | "organisation" | "name" | "email" | "form", string>
>;

type Receipt = {
  id: string;
  sportName: string;
  placeLabel: string;
  areaKind: AreaKind;
  radiusKm: number | null;
  startDate: string;
  endDate: string;
  title: string;
  detail: string;
};

const SPONSOR_DRAFT_KEY = "weersport-sponsor-campaign";
const SPONSOR_RECEIPT_KEY = "weersport-sponsor-receipt";

type CampaignDraft = {
  step: "campaign" | "contact";
  sportId: string;
  placeQuery: string;
  placeId: string;
  placeLabel: string;
  areaChoice: string;
  start: string;
  weeks: string;
  organisation: string;
  name: string;
  email: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readSponsorDraft(): CampaignDraft | null {
  try {
    const raw = sessionStorage.getItem(SPONSOR_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<CampaignDraft>;
    if (!data || typeof data !== "object") return null;
    return {
      step: data.step === "contact" ? "contact" : "campaign",
      sportId: text(data.sportId),
      placeQuery: text(data.placeQuery),
      placeId: text(data.placeId),
      placeLabel: text(data.placeLabel),
      areaChoice: text(data.areaChoice),
      start: text(data.start),
      weeks: text(data.weeks),
      organisation: text(data.organisation),
      name: text(data.name),
      email: text(data.email),
    };
  } catch {
    return null;
  }
}

function readSponsorReceipt(): Receipt | null {
  try {
    const raw = sessionStorage.getItem(SPONSOR_RECEIPT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Receipt>;
    if (!data || typeof data !== "object") return null;
    if (!text(data.id) || !text(data.title) || !text(data.detail)) return null;
    if (data.areaKind !== "place" && data.areaKind !== "radius") return null;
    return {
      id: text(data.id),
      sportName: text(data.sportName),
      placeLabel: text(data.placeLabel),
      areaKind: data.areaKind,
      radiusKm: typeof data.radiusKm === "number" ? data.radiusKm : null,
      startDate: text(data.startDate),
      endDate: text(data.endDate),
      title: text(data.title),
      detail: text(data.detail),
    };
  } catch {
    return null;
  }
}

const fieldOrder = ["sport", "region", "area", "start", "weeks", "organisation", "name", "email", "form"] as const;

const fieldIds: Record<(typeof fieldOrder)[number], string> = {
  sport: "sponsor-sport",
  region: "sponsor-region",
  area: "sponsor-area",
  start: "sponsor-start",
  weeks: "sponsor-weeks",
  organisation: "sponsor-organisation",
  name: "sponsor-name",
  email: "sponsor-email",
  form: "sponsor-form-alert",
};

export function SponsoringForm({ sports }: { sports: { id: string; name: string }[] }) {
  const [step, setStep] = useState<Step>("campaign");
  const [sportId, setSportId] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [areaChoice, setAreaChoice] = useState("");
  const [start, setStart] = useState("");
  const [weeks, setWeeks] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const skipFocus = useRef(false);
  const attempt = useRef<{ key: string; body: string } | null>(null);
  const mounted = useRef(false);
  const statusId = useId();
  const today = amsterdamToday();
  const sportName = sports.find((sport) => sport.id === sportId)?.name ?? "";
  const area = areaFromChoice(areaChoice);
  const parsedWeeks = parseWeeks(weeks);
  const summary =
    sportName && placeLabel && area && parsedWeeks && parseCampaignStart(start, today).ok
      ? {
          title: summaryTitle(sportName, placeLabel, area.areaKind, area.radiusKm),
          period: `${formatPeriod(start, inclusiveCampaignEnd(start, parsedWeeks))} · ${weeksLabel(parsedWeeks)}`,
        }
      : null;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const storedReceipt = readSponsorReceipt();
    if (storedReceipt) {
      skipFocus.current = true;
      setReceipt(storedReceipt);
      setStep("received");
      setDraftReady(true);
      return;
    }
    const draft = readSponsorDraft();
    if (draft) {
      skipFocus.current = draft.step === "contact";
      setStep(draft.step);
      setSportId(draft.sportId);
      setPlaceQuery(draft.placeQuery);
      setPlaceId(draft.placeId);
      setPlaceLabel(draft.placeLabel);
      setAreaChoice(draft.areaChoice);
      setStart(draft.start);
      setWeeks(draft.weeks);
      setOrganisation(draft.organisation);
      setName(draft.name);
      setEmail(draft.email);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (step === "received" && receipt) {
      sessionStorage.setItem(SPONSOR_RECEIPT_KEY, JSON.stringify(receipt));
      sessionStorage.removeItem(SPONSOR_DRAFT_KEY);
      return;
    }
    if (step === "received") return;
    const draft: CampaignDraft = {
      step: step === "contact" ? "contact" : "campaign",
      sportId,
      placeQuery,
      placeId,
      placeLabel,
      areaChoice,
      start,
      weeks,
      organisation,
      name,
      email,
    };
    sessionStorage.removeItem(SPONSOR_RECEIPT_KEY);
    sessionStorage.setItem(SPONSOR_DRAFT_KEY, JSON.stringify(draft));
  }, [
    draftReady,
    step,
    receipt,
    sportId,
    placeQuery,
    placeId,
    placeLabel,
    areaChoice,
    start,
    weeks,
    organisation,
    name,
    email,
  ]);

  function focusError(next: Errors) {
    const key = fieldOrder.find((item) => next[item]);
    if (!key) return;
    requestAnimationFrame(() => {
      if (key === "form") {
        alertRef.current?.focus();
        return;
      }
      document.getElementById(fieldIds[key])?.focus();
    });
  }

  function campaignErrors(): Errors {
    const next: Errors = {};
    if (!sports.some((sport) => sport.id === sportId)) next.sport = "Kies een sport.";
    if (!placeId || !placeLabel) next.region = "Kies een plaats uit de lijst.";
    if (!area) next.area = "Kies het bereik rondom de plaats.";
    if (!parseCampaignStart(start, today).ok) next.start = "Kies vandaag of een latere datum.";
    if (parsedWeeks == null) next.weeks = "Vul een geheel aantal weken in, van 1 tot en met 52.";
    return next;
  }

  function contactErrors(): Errors {
    const next: Errors = {};
    const organisationName = plainLine(organisation);
    const contactName = plainLine(name);
    if (organisationName.length < 2 || organisationName.length > 120) {
      next.organisation = "Vul de organisatienaam in (2–120 tekens).";
    }
    if (contactName.length < 2 || contactName.length > 80) next.name = "Vul de contactpersoon in (2–80 tekens).";
    if (!isEmailAddress(email)) next.email = "Vul een geldig zakelijk e-mailadres in.";
    return next;
  }

  function goNext() {
    const next = campaignErrors();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusError(next);
      return;
    }
    setErrors({});
    setStep("contact");
  }

  function payloadBody() {
    return JSON.stringify({
      requestType: CAMPAIGN_REQUEST_TYPE,
      name: plainLine(name),
      organisation: plainLine(organisation),
      email: email.trim(),
      sportId,
      placeId,
      placeLabel,
      areaKind: area?.areaKind,
      radiusKm: area?.radiusKm ?? null,
      desiredStart: start,
      durationWeeks: parsedWeeks,
      wsHp: honeypot,
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === "campaign") {
      goNext();
      return;
    }
    if (step !== "contact" || lock.current) return;
    const next = { ...campaignErrors(), ...contactErrors() };
    if (Object.keys(next).length > 0) {
      setErrors(next);
      if (next.sport || next.region || next.area || next.start || next.weeks) setStep("campaign");
      focusError(next);
      return;
    }
    const body = payloadBody();
    if (!attempt.current || attempt.current.body !== body) {
      attempt.current = { key: crypto.randomUUID(), body };
    }
    lock.current = true;
    setPending(true);
    setErrors({});
    setRetryable(false);
    try {
      const response = await fetch("/api/sponsoring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...JSON.parse(body), idempotencyKey: attempt.current.key }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        errors?: Errors;
        receipt?: Receipt;
      };
      if (!response.ok || !data.ok || !data.id || !data.receipt) {
        const serverErrors = data.errors ?? { form: "De aanvraag is niet ontvangen. Probeer het opnieuw." };
        if (response.status === 409) attempt.current = null;
        setRetryable(response.status >= 500 || response.status === 0);
        setErrors(serverErrors);
        setPending(false);
        lock.current = false;
        if (serverErrors.sport || serverErrors.region || serverErrors.area || serverErrors.start || serverErrors.weeks) {
          setStep("campaign");
        }
        focusError(serverErrors);
        return;
      }
      setReceipt(data.receipt);
      setPending(false);
      setStep("received");
    } catch {
      setErrors({ form: "De aanvraag is niet ontvangen. Je gegevens blijven staan." });
      setRetryable(true);
      setPending(false);
      lock.current = false;
      focusError({ form: "netwerk" });
    }
  }

  const title =
    step === "received" ? "Aanvraag ontvangen" : step === "contact" ? "Controleer je aanvraag" : "Stel je campagne samen";
  const lead =
    step === "received"
      ? "We hebben je wensen voor de sponsorplaatsing ontvangen."
      : step === "contact"
        ? "Vul je gegevens in en bekijk je campagnekeuzes."
        : "Kies waar en wanneer je merk zichtbaar wordt.";
  const errorEntries = fieldOrder.filter((key) => errors[key]);

  return (
    <>
      <h1 id="aanvraag" tabIndex={-1} ref={titleRef}>
        {title}
      </h1>
      <p className={styles.lead}>{lead}</p>
      <p className={styles.momentLink}>
        <Link href="/sponsoring/voorbeeld">Bekijk volledige momentpagina · Fietsen</Link>
      </p>
      {step === "received" && receipt ? (
        <div className={styles.receipt} role="status">
          <p className={styles.receiptLabel}>Je aangevraagde plaatsing</p>
          <p className={styles.receiptTitle}>{receipt.title}</p>
          <p className={styles.receiptDetail}>{receipt.detail}</p>
          <p className={styles.reference}>
            Aanvraagnummer <strong>{receipt.id}</strong>
          </p>
          <p className={styles.receiptNote}>
            We bekijken de beschikbaarheid en nemen via je zakelijke e-mailadres contact op over de plaatsing en de
            prijs. Er wordt niets ingepland of afgeschreven, en er gaat geen automatische bevestigingsmail uit.
          </p>
        </div>
      ) : (
        <form className={styles.layout} data-step={step} onSubmit={onSubmit} noValidate>
          <div className={styles.card} data-step={step}>
            <div className={styles.steps}>
              <ol>
                <li aria-current={step === "campaign" ? "step" : undefined}>Campagne</li>
                <li aria-hidden="true" className={styles.slash}>
                  /
                </li>
                <li aria-current={step === "contact" ? "step" : undefined}>Contact en controle</li>
              </ol>
            </div>
            <div className={styles.track} aria-hidden="true">
              <div className={styles.bar} />
            </div>
            {errorEntries.length > 0 ? (
              <div className={styles.alert} id="sponsor-form-alert" role="alert" tabIndex={-1} ref={alertRef}>
                <p>Controleer de aanvraag.</p>
                <ul>
                  {errorEntries.map((key) => (
                    <li key={key}>{errors[key]}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {step === "campaign" ? (
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label htmlFor="sponsor-sport">Sport</label>
                  <select
                    id="sponsor-sport"
                    className={`${styles.control} ${styles.select} ${sportId ? "" : styles.placeholder}`}
                    value={sportId}
                    aria-invalid={Boolean(errors.sport)}
                    aria-describedby={errors.sport ? "sponsor-sport-error" : undefined}
                    onChange={(event) => setSportId(event.target.value)}
                  >
                    <option value="">Kies een sport</option>
                    {sports.map((sport) => (
                      <option key={sport.id} value={sport.id}>
                        {sport.name}
                      </option>
                    ))}
                  </select>
                  {errors.sport ? (
                    <p className={styles.error} id="sponsor-sport-error">
                      {errors.sport}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor="sponsor-region">Omgeving</label>
                  <PlaceField
                    variant="plain"
                    inputId="sponsor-region"
                    label={placeQuery}
                    placeId={placeId}
                    invalid={Boolean(errors.region)}
                    describedBy={[errors.region ? "sponsor-region-error" : "", statusId].filter(Boolean).join(" ")}
                    statusId={statusId}
                    onChange={(next) => {
                      if (next.placeId) {
                        setPlaceQuery(placeSelectionLabel(next.label, next.detail ?? ""));
                        setPlaceId(next.placeId);
                        setPlaceLabel(next.label);
                      } else {
                        setPlaceQuery(next.label);
                        setPlaceId("");
                        setPlaceLabel("");
                      }
                    }}
                  />
                  {errors.region ? (
                    <p className={styles.error} id="sponsor-region-error">
                      {errors.region}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor="sponsor-area">Bereik rondom plaats</label>
                  <select
                    id="sponsor-area"
                    className={`${styles.control} ${styles.select} ${areaChoice ? "" : styles.placeholder}`}
                    value={areaChoice}
                    aria-invalid={Boolean(errors.area)}
                    aria-describedby={errors.area ? "sponsor-area-error" : undefined}
                    onChange={(event) => setAreaChoice(event.target.value)}
                  >
                    <option value="">Kies een bereik</option>
                    {AREA_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                  {errors.area ? (
                    <p className={styles.error} id="sponsor-area-error">
                      {errors.area}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor="sponsor-start">Gewenste startdatum</label>
                  <div className={styles.date}>
                    <input
                      id="sponsor-start"
                      className={styles.control}
                      type="date"
                      lang="nl-NL"
                      min={today}
                      max="2100-12-31"
                      value={start}
                      aria-invalid={Boolean(errors.start)}
                      aria-describedby={errors.start ? "sponsor-start-error" : "sponsor-start-hint"}
                      onChange={(event) => setStart(event.target.value)}
                    />
                    <span className={`${styles.dateFace} ${start ? "" : styles.dateFaceEmpty}`} aria-hidden="true">
                      {start ? formatDutchDate(start, true) : "Kies een datum"}
                    </span>
                    <span className={styles.dateChevron} aria-hidden="true">
                      ⌄
                    </span>
                  </div>
                  <span className="visually-hidden" id="sponsor-start-hint">
                    Vandaag of een latere dag. De datum wordt als kalenderdatum bewaard.
                  </span>
                  {errors.start ? (
                    <p className={styles.error} id="sponsor-start-error">
                      {errors.start}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor="sponsor-weeks">Looptijd</label>
                  <div className={styles.affix}>
                    <input
                      id="sponsor-weeks"
                      className={styles.control}
                      inputMode="decimal"
                      autoComplete="off"
                      value={weeks}
                      aria-invalid={Boolean(errors.weeks)}
                      aria-describedby={errors.weeks ? "sponsor-weeks-error" : "sponsor-weeks-hint"}
                      onChange={(event) => setWeeks(event.target.value)}
                    />
                    <span className={styles.suffix} aria-hidden="true">
                      weken
                    </span>
                  </div>
                  <span className="visually-hidden" id="sponsor-weeks-hint">
                    Een geheel aantal weken, van 1 tot en met 52.
                  </span>
                  {errors.weeks ? (
                    <p className={styles.error} id="sponsor-weeks-error">
                      {errors.weeks}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={styles.fields}>
                {summary ? (
                  <div className={styles.summary}>
                    <p className={styles.summaryLabel}>Je campagne</p>
                    <p className={styles.summaryTitle}>{summary.title}</p>
                    <p className={styles.summaryMeta}>{summary.period}</p>
                    <button
                      type="button"
                      className={styles.change}
                      disabled={pending}
                      onClick={() => {
                        setErrors({});
                        setStep("campaign");
                      }}
                    >
                      Keuzes wijzigen
                    </button>
                  </div>
                ) : null}
                <div className={styles.field}>
                  <label htmlFor="sponsor-organisation">Organisatie</label>
                  <input
                    id="sponsor-organisation"
                    className={styles.control}
                    name="organization"
                    autoComplete="organization"
                    value={organisation}
                    aria-invalid={Boolean(errors.organisation)}
                    aria-describedby={errors.organisation ? "sponsor-organisation-error" : undefined}
                    onChange={(event) => setOrganisation(event.target.value)}
                  />
                  {errors.organisation ? (
                    <p className={styles.error} id="sponsor-organisation-error">
                      {errors.organisation}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor="sponsor-name">Contactpersoon</label>
                  <input
                    id="sponsor-name"
                    className={styles.control}
                    name="name"
                    autoComplete="name"
                    value={name}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "sponsor-name-error" : undefined}
                    onChange={(event) => setName(event.target.value)}
                  />
                  {errors.name ? (
                    <p className={styles.error} id="sponsor-name-error">
                      {errors.name}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor="sponsor-email">Zakelijk e-mailadres</label>
                  <input
                    id="sponsor-email"
                    className={styles.control}
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                    value={email}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "sponsor-email-error" : undefined}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  {errors.email ? (
                    <p className={styles.error} id="sponsor-email-error">
                      {errors.email}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
            {step === "contact" ? (
              <p className={styles.note}>Je vraagt een voorstel aan. We stemmen beschikbaarheid en prijs met je af.</p>
            ) : null}
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
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
              />
            </div>
            {step === "campaign" ? (
              <button className={styles.primary} type="submit">
                <span>Verder naar contactgegevens</span>
                <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button className={styles.primary} type="submit" disabled={pending} aria-busy={pending}>
                <span>{pending ? "Versturen…" : retryable ? "Opnieuw proberen" : "Sponsoraanvraag versturen"}</span>
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          <div className={styles.showcase}>
            <FietsMomentPage embedded />
          </div>
        </form>
      )}
    </>
  );
}
