import type { MetadataRoute } from "next";
import { allowPublicIndexing, INDEXABLE_PUBLIC_PATHS, siteOrigin } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!allowPublicIndexing()) return [];
  const origin = siteOrigin();
  const now = new Date();
  return INDEXABLE_PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
