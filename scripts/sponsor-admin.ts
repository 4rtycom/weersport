import {
  agreeRequest,
  campaignReport,
  formatReport,
  formatReportCsv,
  formatRequestList,
  getRequest,
  listRequests,
  pauseCampaign,
  resumeCampaign,
  scheduleCampaign,
  type Audience,
} from "@/lib/sponsoring/admin";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function option(name: string, args: string[]) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`Optie ${name} mist een waarde.`);
  return value;
}

const [command, id, ...rest] = process.argv.slice(2);

const usage = `WeerSport sponsorbeheer (lokaal, zelfde database als de app).

  npm run sponsor -- list
  npm run sponsor -- show <aanvraag-id>
  npm run sponsor -- agree <aanvraag-id> --price 9900
  npm run sponsor -- agree <aanvraag-id> --complimentary
  npm run sponsor -- schedule <aanvraag-id> --start 2026-06-01 --sport hardlopen --place wpl-… --headline "…" --body "…" [--url https://…] [--partner "…"] [--test|--production]
  npm run sponsor -- pause <campagne-id>
  npm run sponsor -- resume <campagne-id>
  npm run sponsor -- report <campagne-id> [--csv]

Standaard is een testcampagne. Die is lokaal zichtbaar en telt niet mee in productierapporten.
Facturen blijven handmatig. Dit commando publiceert niets.`;

async function main() {
  if (!command || command === "help") {
    console.log(usage);
    return;
  }
  if (command === "list") {
    console.log(formatRequestList(listRequests()));
    return;
  }
  if (!id) fail(usage);
  if (command === "show") {
    const request = getRequest(id);
    if (!request) fail("Aanvraag niet gevonden.");
    console.log(JSON.stringify(request, null, 2));
    return;
  }
  if (command === "agree") {
    const complimentary = rest.includes("--complimentary");
    const price = option("--price", rest);
    if (complimentary === Boolean(price)) fail("Kies --price 9900 of --complimentary.");
    if (price && price !== "9900") fail("Het pilotbedrag is 9900 eurocent. Een gratis pilot gaat via --complimentary.");
    const result = agreeRequest(id, complimentary ? "complimentary" : "standard");
    if (!result.ok) fail(result.error);
    console.log(`${result.reused ? "Akkoord stond al vast" : "Akkoord vastgelegd"}: ${result.request.id}`);
    console.log(`Tarief: ${result.request.price_kind} ${result.request.agreed_price_cents} eurocent`);
    console.log("Factuur blijft handmatig. Plan daarna met schedule.");
    return;
  }
  if (command === "schedule") {
    const start = option("--start", rest);
    const sport = option("--sport", rest);
    const place = option("--place", rest);
    const headline = option("--headline", rest);
    const body = option("--body", rest);
    if (!start || !sport || !place || !headline || !body) {
      fail("schedule vraagt --start, --sport, --place, --headline en --body.");
    }
    let audience: Audience = "test";
    if (rest.includes("--production")) audience = "production";
    else if (rest.includes("--demo")) audience = "demo";
    else if (rest.includes("--adminpreview")) audience = "adminpreview";
    if (audience === "production") {
      console.error("Let op: dit wordt een productieve campagne en telt mee in productierapporten.");
    }
    const result = await scheduleCampaign({
      requestId: id,
      startDate: start,
      sportId: sport,
      placeId: place,
      headline,
      body,
      destinationUrl: option("--url", rest),
      partnerName: option("--partner", rest),
      audience,
    });
    if (!result.ok) fail(result.error);
    console.log(`${result.reused ? "Bestaande campagne" : "Campagne gepland"}: ${result.campaign.id}`);
    console.log(`${result.campaign.sport_id} · ${result.campaign.place_label} · ${result.campaign.starts_at} → ${result.campaign.ends_at} exclusief`);
    console.log(`Publiek: ${result.campaign.audience}. Tarief: ${result.campaign.price_cents} eurocent.`);
    return;
  }
  if (command === "pause") {
    const result = pauseCampaign(id);
    if (!result.ok) fail(result.error);
    console.log(`${result.reused ? "Campagne stond al gepauzeerd" : "Campagne gepauzeerd"}: ${result.campaign.id}`);
    return;
  }
  if (command === "resume") {
    const result = resumeCampaign(id);
    if (!result.ok) fail(result.error);
    console.log(`${result.reused ? "Campagne stond al live" : "Campagne hervat"}: ${result.campaign.id}`);
    return;
  }
  if (command === "report") {
    const report = campaignReport(id);
    if (!report) fail("Campagne niet gevonden.");
    console.log(rest.includes("--csv") ? formatReportCsv(report) : formatReport(report));
    return;
  }
  fail(usage);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : "Sponsorbeheer mislukt.");
});
