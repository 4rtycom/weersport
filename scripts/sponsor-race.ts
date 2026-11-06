import { scheduleCampaign } from "@/lib/sponsoring/admin";

const requestId = process.argv[2];
if (!requestId) {
  console.error("request id missing");
  process.exit(1);
}

const result = await scheduleCampaign(
  {
    requestId,
    sportId: "wielrennen",
    placeId: "wpl-ams",
    startDate: "2026-09-01",
    headline: "Gelijktijdig",
    body: "Eén van deze twee boekingen moet worden geweigerd.",
    audience: "test",
  },
  {
    resolvePlace: async (id: string) => (id === "wpl-ams" ? { id, label: "Amsterdam" } : null),
  },
);

if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}
console.log(result.campaign.id);
