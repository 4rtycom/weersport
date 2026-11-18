import { adsTxtLine } from "@/lib/ads/policy";

export const dynamic = "force-dynamic";

/** Authorised sellers file. Google checks it before paying out; it is built from NEXT_PUBLIC_ADSENSE_CLIENT. */
export function GET() {
  const line = adsTxtLine();
  return new Response(line ? `${line}\n` : "# AdSense is niet ingesteld.\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
