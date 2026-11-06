import { cookies } from "next/headers";
import { accountFromSession, destroySession } from "@/lib/auth/service";
import { parseDraft, type SearchDraft } from "@/lib/draft";

export const SESSION_COOKIE = "ws_session";
export const DRAFT_COOKIE = "ws_draft";
export const MAIL_COOKIE = "ws_dev_mail";

function options(request: Request, maxAge: number) {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-proto");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: forwarded === "https" || url.protocol === "https:",
    path: "/",
    maxAge,
  };
}

export async function readSession() {
  const jar = await cookies();
  return accountFromSession(jar.get(SESSION_COOKIE)?.value);
}

export async function readDraftCookie() {
  const jar = await cookies();
  const raw = jar.get(DRAFT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return parseDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeSession(response: Response, request: Request, token: string) {
  response.headers.append(
    "set-cookie",
    serialize(SESSION_COOKIE, token, options(request, 60 * 60 * 24 * 14)),
  );
}

export function clearSession(response: Response, request: Request, token: string | undefined) {
  destroySession(token);
  response.headers.append("set-cookie", serialize(SESSION_COOKIE, "", { ...options(request, 0), maxAge: 0 }));
}

export function writeDraft(response: Response, request: Request, draft: SearchDraft) {
  response.headers.append(
    "set-cookie",
    serialize(DRAFT_COOKIE, JSON.stringify(draft), options(request, 60 * 60 * 24 * 7)),
  );
}

export function writeDevMail(response: Response, request: Request, path: string) {
  response.headers.append("set-cookie", serialize(MAIL_COOKIE, path, options(request, 60 * 60 * 24)));
}

export function clearDevMail(response: Response, request: Request) {
  response.headers.append("set-cookie", serialize(MAIL_COOKIE, "", { ...options(request, 0), maxAge: 0 }));
}

function serialize(name: string, value: string, opts: { httpOnly: boolean; sameSite: "lax"; secure: boolean; path: string; maxAge: number }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path}`, `Max-Age=${opts.maxAge}`, "SameSite=Lax", "HttpOnly"];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}
