/**
 * Phase 7 — evidence pack schema for Gates A–C and Phase 6 exit.
 * Classification: a source-string assertion alone cannot certify browser UAT.
 */

export type EvidenceClass = "static" | "automated" | "manual_uat" | "untested";

export type EvidencePack = {
  gate: string;
  title: string;
  commit: string;
  environment: string;
  date: string;
  fixtureOrProviderRef: string;
  expected: string;
  actual: string;
  evidence: string;
  classification: EvidenceClass;
  reviewer: string;
  unresolvedDefects: string[];
  decision: "GO" | "NO_GO" | "PENDING";
};

export const EVIDENCE_GATES = [
  { id: "gate-a", title: "Gate A — durable identity / inbox", phase: "1" },
  { id: "gate-b", title: "Gate B — quota metering", phase: "4" },
  { id: "gate-c", title: "Gate C — Mollie lifecycle", phase: "5" },
  { id: "phase-6-exit", title: "Phase 6 UX / SEO exit evidence", phase: "6" },
  { id: "phase-7-journeys", title: "Phase 7 staging journeys + isolation", phase: "7" },
] as const;

export const EVIDENCE_CLASS_LABEL: Record<EvidenceClass, string> = {
  static: "Static review",
  automated: "Automated integration",
  manual_uat: "Manual UAT",
  untested: "Untested",
};
