import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";

/**
 * Web Push without dependencies: RFC 8291 (aes128gcm payload encryption) and RFC 8292 (VAPID).
 * Keys come from NEXT_PUBLIC_VAPID_PUBLIC_KEY (65-byte uncompressed P-256 point) and VAPID_PRIVATE_KEY (32 bytes),
 * both base64url. Generate them with `npm run vapid`.
 */

const b64u = {
  encode: (buf: Buffer) => buf.toString("base64url"),
  decode: (value: string) => Buffer.from(value.replace(/=+$/, ""), "base64url"),
};

function hmac(key: Buffer, data: Buffer) {
  return createHmac("sha256", key).update(data).digest();
}

/** HKDF with a single output block, enough for 16/12/32-byte keys. */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number) {
  const prk = hmac(salt, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

export function encryptPayload(payload: Buffer, uaPublicB64: string, authSecretB64: string, opts?: { salt?: Buffer; ecdh?: ReturnType<typeof createECDH> }) {
  const uaPublic = b64u.decode(uaPublicB64);
  const authSecret = b64u.decode(authSecretB64);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("Ongeldige pushsleutels");
  const local = opts?.ecdh ?? createECDH("prime256v1");
  if (!opts?.ecdh) local.generateKeys();
  const asPublic = local.getPublicKey();
  const shared = local.computeSecret(uaPublic);
  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32);
  const salt = opts?.salt ?? randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

export function vapidConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export function vapidAuthorization(endpoint: string, publicKeyB64: string, privateKeyB64: string, subject: string, nowSec = Math.floor(Date.now() / 1000)) {
  const publicKey = b64u.decode(publicKeyB64);
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: privateKeyB64.replace(/=+$/, ""),
      x: b64u.encode(publicKey.subarray(1, 33)),
      y: b64u.encode(publicKey.subarray(33, 65)),
    },
    format: "jwk",
  });
  const header = b64u.encode(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u.encode(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: subject })));
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64u.encode(signature)}, k=${publicKeyB64.replace(/=+$/, "")}`;
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; error: string };

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  message: { title: string; body: string; url: string; tag?: string },
): Promise<PushResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:meldingen@weersport.nl";
  if (!publicKey || !privateKey) return { ok: false, gone: false, error: "VAPID-sleutels ontbreken" };
  try {
    const body = encryptPayload(Buffer.from(JSON.stringify(message)), subscription.p256dh, subscription.auth);
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        authorization: vapidAuthorization(subscription.endpoint, publicKey, privateKey, subject),
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: String(12 * 3600),
        urgency: "normal",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404 || response.status === 410) return { ok: false, gone: true, error: `HTTP ${response.status}` };
    if (!response.ok) return { ok: false, gone: false, error: `HTTP ${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, gone: false, error: error instanceof Error ? error.message : "Onbekende fout" };
  }
}
