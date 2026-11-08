/**
 * Separate launch switches. Webhooks and reconciliation keep running for work
 * that already started; these flags only stop new signup, publication,
 * affiliate display, or new collection orders.
 */
export type SponsorFlags = {
  signup: boolean;
  publish: boolean;
  affiliate: boolean;
  collect: boolean;
  fixtures: boolean;
};

function on(name: string) {
  return process.env[name] === "1";
}

export function sponsorFlags(): SponsorFlags {
  const production = process.env.NODE_ENV === "production";
  return {
    signup: on("WEERSPORT_SPONSOR_SIGNUP"),
    publish: on("WEERSPORT_SPONSOR_PUBLISH"),
    affiliate: on("WEERSPORT_AFFILIATE_DISPLAY"),
    collect: on("WEERSPORT_SPONSOR_COLLECT"),
    fixtures: on("WEERSPORT_AFFILIATE_FIXTURES") && !production,
  };
}
