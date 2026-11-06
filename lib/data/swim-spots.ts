export type OfficialSwimSpot = {
  spotId: string;
  placeId: string;
  label: string;
  waterKind: "stilstaand" | "stromend" | "kust";
};

/**
 * Official swim-location lookup.
 * No provider is linked and no spot list is shipped here.
 * A place therefore does not resolve to a swim spot until a source with rights is connected.
 */
export function resolveOfficialSwimSpot(placeId: string): OfficialSwimSpot | null {
  if (!placeId.startsWith("wpl-")) return null;
  return null;
}
