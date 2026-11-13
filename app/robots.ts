import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/auth", "/checkout", "/moment", "/admin", "/release-gate", "/api", "/sponsoring/beheer", "/sponsoring/betaling", "/meldingen"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
