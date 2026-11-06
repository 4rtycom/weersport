import { headers } from "next/headers";
import { resolveReturnTarget, type ReturnTarget } from "@/lib/navigation/return-to";

export async function pageReturn(van?: string | string[]): Promise<ReturnTarget> {
  const headerList = await headers();
  return resolveReturnTarget({
    van,
    referer: headerList.get("referer"),
    host: headerList.get("x-forwarded-host") ?? headerList.get("host"),
  });
}
