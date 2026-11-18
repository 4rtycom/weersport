import { AdSlot } from "@/components/ads/ad-slot";
import type { AdDecision } from "@/lib/ads/policy";

/** Server-side decision in, one ad block (or an invisible marker) out. The script itself loads in AdsProvider. */
export function AdsHost({ decision }: { decision: AdDecision; scriptEnabled?: boolean; hideWhenBlocked?: boolean }) {
  return <AdSlot allowed={decision.allowed} reason={decision.reason} />;
}
