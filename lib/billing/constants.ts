export const BASIS_MONTHLY_LIMIT = 5;
export const PRO_MONTHLY_LIMIT = 100;
export const PRO_PRICE_EUR = "4.95";
export const PRO_PRICE_CENTS = 495;
export const PRO_CURRENCY = "EUR";
export const CACHE_TTL_MS = 60 * 60 * 1000;

export type PlanId = "basis" | "pro";

export type BillingState =
  | "checkout_created"
  | "payment_pending"
  | "payment_paid"
  | "payment_failed"
  | "subscription_active"
  | "past_due"
  | "cancel_requested"
  | "cancelled"
  | "refunded";

export const BILLING_DISCLOSURE =
  "Browserredirect is geen betaalbewijs. Pro activeert pas na geverifieerde Mollie-status.";
