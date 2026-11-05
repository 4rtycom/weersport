import { AdSenseScript, AdSlot } from "@/components/ads/ad-slot";
import type { AdDecision } from "@/lib/ads/policy";

export function AdsHost({
  decision,
  scriptEnabled,
  hideWhenBlocked = true,
}: {
  decision: AdDecision;
  scriptEnabled: boolean;
  /** When true, excluded surfaces render nothing (homepage/auth). When false, show blocked reason for tests. */
  hideWhenBlocked?: boolean;
}) {
  if (!decision.allowed && hideWhenBlocked) {
    return <AdSenseScript enabled={false} />;
  }
  return (
    <>
      <AdSenseScript enabled={scriptEnabled} />
      <AdSlot allowed={decision.allowed} reason={decision.reason} />
    </>
  );
}
