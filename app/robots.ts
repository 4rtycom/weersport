import type { MetadataRoute } from "next";
import { allowPublicIndexing, siteHost, siteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  const host = siteHost();
  if (!allowPublicIndexing()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      host,
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account/", "/auth/", "/api/", "/checkout/", "/release-gate", "/ux-states"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host,
  };
}
