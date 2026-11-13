import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { sports } from "@/lib/sports";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/hoe-werkt-het", "/sporten", "/weer-en-uv", "/prijzen", "/sponsoring", "/support", "/privacy", "/voorwaarden"];
  return [
    ...pages.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 })),
    ...sports.map((sport) => ({ url: `${SITE_URL}/sporten/${sport.id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
