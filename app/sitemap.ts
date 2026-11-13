import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { cities, landSports } from "@/lib/live";
import { sports } from "@/lib/sports";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/hoe-werkt-het", "/sporten", "/weer-en-uv", "/prijzen", "/over", "/sponsoring", "/support", "/privacy", "/voorwaarden"];
  return [
    ...pages.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 })),
    ...sports.map((sport) => ({ url: `${SITE_URL}/sporten/${sport.id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...landSports.flatMap((sport) =>
      cities.map((city) => ({ url: `${SITE_URL}/sporten/${sport.id}/${city.slug}`, changeFrequency: "hourly" as const, priority: 0.5 })),
    ),
  ];
}
