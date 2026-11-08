import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { ensureCommercialSchema } from "@/lib/sponsoring/commercial-schema";
import { resolveMonthlyRate } from "@/lib/sponsoring/rate";

export type ProviderEnvironment = "test" | "live";

export type SponsorPayment = {
  id: string;
  status: "open" | "paid" | "expired" | "canceled" | "failed";
  amountCents: number;
  currency: "EUR";
  checkoutId: string;
  environment: ProviderEnvironment;
  mandateId: string | null;
  sequenceType: "first";
};

export type SponsorProviderInvoice = {
  id: string;
  number: string | null;
  status: "paid" | "issued" | "open";
  emailStatus: "not_delivered_tested" | "requested" | "delivered";
};

/** Public origin for Mollie redirect and webhook URLs. Matches Pro checkout. */
export function publicRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export function providerEnvironment(): ProviderEnvironment {
  const rate = resolveMonthlyRate();
  if (!rate.ok || rate.mode !== "confirmed") return "test";
  if (!process.env.MOLLIE_API_KEY?.trim()) return "test";
  return "live";
}

function centsToValue(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

async function mollie(path: string, init?: RequestInit) {
  const key = process.env.MOLLIE_API_KEY?.trim() ?? "";
  if (!key) throw new Error("MOLLIE_API_KEY ontbreekt");
  const response = await fetch(`https://api.mollie.com/v2${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Mollie HTTP ${response.status}`);
  return body;
}

function saveObject(object: { providerId: string; kind: string; localId: string; status: string; payload: unknown; environment: string }) {
  ensureCommercialSchema();
  db()
    .prepare(
      `INSERT INTO sponsor_provider_objects (provider_id, kind, local_id, status, payload_json, environment)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider_id) DO UPDATE SET status = excluded.status, payload_json = excluded.payload_json`,
    )
    .run(object.providerId, object.kind, object.localId, object.status, JSON.stringify(object.payload), object.environment);
}

function readObject(providerId: string) {
  ensureCommercialSchema();
  return db().prepare("SELECT * FROM sponsor_provider_objects WHERE provider_id = ?").get(providerId) as
    | { provider_id: string; kind: string; local_id: string; status: string; payload_json: string; environment: string }
    | undefined;
}

export async function createSponsorCustomer(input: { localId: string; name: string; email: string }) {
  const environment = providerEnvironment();
  if (environment === "live") {
    const customer = await mollie("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        metadata: { scope: "sponsoring", localId: input.localId },
      }),
    });
    const id = String(customer.id);
    saveObject({ providerId: id, kind: "customer", localId: input.localId, status: "open", payload: customer, environment });
    return { id, environment };
  }
  const id = `cst_sponsor_test_${input.localId.slice(0, 8)}`;
  saveObject({
    providerId: id,
    kind: "customer",
    localId: input.localId,
    status: "open",
    payload: { test: true },
    environment,
  });
  return { id, environment };
}

export async function createFirstIdealPayment(input: {
  checkoutId: string;
  customerId: string;
  amountCents: number;
  origin: string;
  returnToken: string;
  description: string;
}) {
  if (process.env.WEERSPORT_SPONSOR_PROVIDER_FAIL === "1") {
    throw new Error("gesimuleerde providerfout");
  }
  const environment = providerEnvironment();
  if (environment === "live") {
    const payment = await mollie("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: { currency: "EUR", value: centsToValue(input.amountCents) },
        description: input.description,
        method: "ideal",
        sequenceType: "first",
        customerId: input.customerId,
        redirectUrl: `${input.origin}/sponsoring/betaling?token=${input.returnToken}`,
        webhookUrl: `${input.origin}/api/sponsoring/webhook`,
        metadata: { scope: "sponsoring", checkoutId: input.checkoutId, environment },
      }),
    });
    const id = String(payment.id);
    const links = payment._links as { checkout?: { href?: string } } | undefined;
    saveObject({
      providerId: id,
      kind: "payment",
      localId: input.checkoutId,
      status: "open",
      payload: payment,
      environment,
    });
    return { id, checkoutUrl: links?.checkout?.href ?? "", environment, mandateId: null as string | null };
  }
  const id = `tr_sponsor_test_${input.checkoutId.slice(0, 12)}`;
  saveObject({
    providerId: id,
    kind: "payment",
    localId: input.checkoutId,
    status: "open",
    payload: {
      amountCents: input.amountCents,
      currency: "EUR",
      checkoutId: input.checkoutId,
      mandateId: null,
      sequenceType: "first",
    },
    environment,
  });
  return {
    id,
    checkoutUrl: `${input.origin}/sponsoring/betaling?token=${input.returnToken}`,
    environment,
    mandateId: null as string | null,
  };
}

export async function readSponsorPayment(paymentId: string): Promise<SponsorPayment | null> {
  if (providerEnvironment() === "live" && !paymentId.startsWith("tr_sponsor_test_")) {
    const payment = await mollie(`/payments/${paymentId}`);
    const amount = payment.amount as { value?: string; currency?: string } | undefined;
    const metadata = payment.metadata as { checkoutId?: string; environment?: string } | undefined;
    const value = amount?.value ?? "0.00";
    const [euros, cents] = value.split(".");
    const mandate = payment.mandateId ? String(payment.mandateId) : null;
    return {
      id: paymentId,
      status: normalizeStatus(String(payment.status)),
      amountCents: Number(euros) * 100 + Number(cents ?? 0),
      currency: amount?.currency === "EUR" ? "EUR" : "EUR",
      checkoutId: metadata?.checkoutId ?? "",
      environment: metadata?.environment === "live" ? "live" : "test",
      mandateId: mandate,
      sequenceType: "first",
    };
  }
  const row = readObject(paymentId);
  if (!row || row.kind !== "payment") return null;
  const payload = JSON.parse(row.payload_json) as {
    amountCents: number;
    checkoutId: string;
    mandateId: string | null;
  };
  return {
    id: paymentId,
    status: normalizeStatus(row.status),
    amountCents: payload.amountCents,
    currency: "EUR",
    checkoutId: payload.checkoutId,
    environment: row.environment === "live" ? "live" : "test",
    mandateId: payload.mandateId,
    sequenceType: "first",
  };
}

function normalizeStatus(status: string): SponsorPayment["status"] {
  if (status === "paid") return "paid";
  if (status === "expired") return "expired";
  if (status === "canceled" || status === "cancelled") return "canceled";
  if (status === "failed") return "failed";
  return "open";
}

/** Test adapter only. A browser return never calls this. */
export function markTestPayment(paymentId: string, status: SponsorPayment["status"], options?: { mandate?: boolean }) {
  const row = readObject(paymentId);
  if (!row || row.environment === "live") {
    throw new Error("Alleen de testadapter kan een betaling lokaal markeren.");
  }
  const payload = JSON.parse(row.payload_json) as { mandateId: string | null; checkoutId: string };
  if (status === "paid" && options?.mandate !== false) {
    payload.mandateId = payload.mandateId ?? `mdt_sponsor_test_${payload.checkoutId.slice(0, 8)}`;
  }
  if (status === "paid" && options?.mandate === false) payload.mandateId = null;
  saveObject({
    providerId: paymentId,
    kind: "payment",
    localId: row.local_id,
    status,
    payload,
    environment: "test",
  });
}

export async function createSalesInvoice(input: {
  localInvoiceId: string;
  customerId: string;
  paymentId?: string | null;
  mandateId?: string | null;
  kind: "first_paid" | "collection";
  lines: Array<{ description: string; netCents: number; vatRate: string }>;
  subject: string;
}) {
  const environment = providerEnvironment();
  if (input.kind === "collection" && !input.mandateId) {
    throw new Error("Incasso vraagt een mandaat. Er is geen abonnement gestart.");
  }
  const stored = readInvoiceForLocal(input.localInvoiceId);
  if (stored) return stored;
  if (environment === "live") {
    const sellerReady = Boolean(
      process.env.WEERSPORT_SELLER_LEGAL_NAME &&
        process.env.WEERSPORT_SELLER_VAT_ID &&
        process.env.WEERSPORT_SELLER_ADDRESS,
    );
    if (!sellerReady) throw new Error("Verkopersgegevens ontbreken. Er is geen factuur bij Mollie gestart.");
    const body: Record<string, unknown> = {
      customerId: input.customerId,
      vatMode: "exclusive",
      lines: input.lines.map((line) => ({
        description: line.description,
        quantity: 1,
        vatRate: line.vatRate,
        unitPrice: { currency: "EUR", value: centsToValue(line.netCents) },
      })),
      emailDetails: { subject: input.subject },
      metadata: { scope: "sponsoring", localInvoiceId: input.localInvoiceId, kind: input.kind },
    };
    if (input.kind === "first_paid") {
      body.status = "paid";
      body.paymentDetails = { source: "payment", sourceReference: input.paymentId };
    } else {
      body.status = "issued";
      body.mandateId = input.mandateId;
    }
    const invoice = await mollie("/sales-invoices", {
      method: "POST",
      headers: { "Idempotency-Key": input.localInvoiceId },
      body: JSON.stringify(body),
    });
    const id = String(invoice.id);
    const number = typeof invoice.invoiceNumber === "string" ? invoice.invoiceNumber : null;
    saveObject({ providerId: id, kind: "invoice", localId: input.localInvoiceId, status: input.kind === "first_paid" ? "paid" : "issued", payload: invoice, environment });
    return {
      id,
      number,
      status: input.kind === "first_paid" ? "paid" : "issued",
      emailStatus: "requested",
    } satisfies SponsorProviderInvoice;
  }
  const id = `sinv_test_${input.localInvoiceId.slice(0, 12)}_${randomUUID().slice(0, 8)}`;
  saveObject({
    providerId: id,
    kind: "invoice",
    localId: input.localInvoiceId,
    status: input.kind === "first_paid" ? "paid" : "issued",
    payload: {
      test: true,
      kind: input.kind,
      paymentId: input.paymentId ?? null,
      mandateId: input.mandateId ?? null,
      descriptions: input.lines.map((line) => line.description),
    },
    environment: "test",
  });
  return {
    id,
    number: null,
    status: input.kind === "first_paid" ? "paid" : "issued",
    emailStatus: "not_delivered_tested",
  } satisfies SponsorProviderInvoice;
}

function readInvoiceForLocal(localInvoiceId: string): SponsorProviderInvoice | null {
  ensureCommercialSchema();
  const row = db()
    .prepare("SELECT provider_id, status, payload_json, environment FROM sponsor_provider_objects WHERE kind = 'invoice' AND local_id = ? ORDER BY rowid LIMIT 1")
    .get(localInvoiceId) as { provider_id: string; status: string; payload_json: string; environment: string } | undefined;
  if (!row) return null;
  const payload = JSON.parse(row.payload_json) as { invoiceNumber?: unknown };
  return {
    id: row.provider_id,
    number: typeof payload.invoiceNumber === "string" ? payload.invoiceNumber : null,
    status: row.status === "paid" ? "paid" : "issued",
    emailStatus: row.environment === "live" ? "requested" : "not_delivered_tested",
  };
}

export async function readSalesInvoice(providerId: string): Promise<SponsorProviderInvoice | null> {
  if (providerEnvironment() === "live" && !providerId.startsWith("sinv_test_")) {
    const invoice = await mollie(`/sales-invoices/${providerId}`);
    const status = String(invoice.status) === "paid" ? "paid" : "issued";
    return {
      id: providerId,
      number: typeof invoice.invoiceNumber === "string" ? invoice.invoiceNumber : null,
      status,
      emailStatus: "requested",
    };
  }
  const row = readObject(providerId);
  if (!row) return null;
  return {
    id: providerId,
    number: null,
    status: row.status === "paid" ? "paid" : "issued",
    emailStatus: "not_delivered_tested",
  };
}
