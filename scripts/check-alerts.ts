// Static checks for weather alerts: window choice, push encryption round trip and VAPID signature.
import assert from "node:assert/strict";
import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from "node:crypto";
import { findAlertWindow } from "../lib/alerts/evaluate";
import { encryptPayload, vapidAuthorization } from "../lib/alerts/webpush";

// 1. Window selection: a mild Saturday morning should be found; weekend filter and threshold must hold.
const now = new Date("2026-11-13T06:00:00Z"); // Friday 07:00 in Amsterdam
const hours = Array.from({ length: 48 }, (_, index) => {
  const time = new Date(now.getTime() + index * 3600e3);
  const local = new Date(time.getTime() + 3600e3).toISOString().slice(0, 16);
  const saturdayMorning = index >= 26 && index <= 29; // Sat 09:00–12:00 local
  return {
    time: local,
    temperatureC: saturdayMorning ? 17 : 4,
    windKmh: saturdayMorning ? 8 : 45,
    precipitationProbability: saturdayMorning ? 0 : 90,
    uvIndex: 1,
  };
});
const any = findAlertWindow({ sportId: "fietsen", hours, minScore: 80, days: "any", now });
assert.ok(any, "a good Saturday window is found");
assert.equal(any.dayLabel, "Morgen");
assert.equal(any.date, "2026-11-14");
const weekend = findAlertWindow({ sportId: "fietsen", hours, minScore: 80, days: "weekend", now });
assert.equal(weekend?.date, "2026-11-14", "weekend alert accepts Saturday");
assert.equal(findAlertWindow({ sportId: "fietsen", hours, minScore: 101, days: "any", now }), null, "threshold respected");
assert.equal(findAlertWindow({ sportId: "schaatsen", hours, minScore: 50, days: "any", now }), null, "no-score sports never alert");

// 2. Push encryption (RFC 8291): decrypt as the browser would.
const ua = createECDH("prime256v1");
ua.generateKeys();
const authSecret = Buffer.alloc(16, 7);
const payload = Buffer.from(JSON.stringify({ title: "Test", body: "Hallo", url: "/" }));
const record = encryptPayload(payload, ua.getPublicKey().toString("base64url"), authSecret.toString("base64url"));
const salt = record.subarray(0, 16);
assert.equal(record.readUInt32BE(16), 4096);
const idLen = record.readUInt8(20);
const asPublic = record.subarray(21, 21 + idLen);
const cipher = record.subarray(21 + idLen);
const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();
const expand = (saltKey: Buffer, ikm: Buffer, info: Buffer, len: number) => hmac(hmac(saltKey, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, len);
const shared = ua.computeSecret(asPublic);
const ikm = expand(authSecret, shared, Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublic]), 32);
const cek = expand(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
const nonce = expand(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
decipher.setAuthTag(cipher.subarray(cipher.length - 16));
const plain = Buffer.concat([decipher.update(cipher.subarray(0, cipher.length - 16)), decipher.final()]);
assert.equal(plain[plain.length - 1], 2, "last-record delimiter");
assert.deepEqual(plain.subarray(0, plain.length - 1), payload, "payload round trip");

// 3. VAPID: the JWT must verify with the public key and target the push service origin.
const server = createECDH("prime256v1");
server.generateKeys();
const pub = server.getPublicKey().toString("base64url");
const header = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", pub, server.getPrivateKey().toString("base64url"), "mailto:test@example.nl", 1_800_000_000);
const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
assert.ok(match, "vapid header shape");
const claims = JSON.parse(Buffer.from(match[2], "base64url").toString());
assert.equal(claims.aud, "https://fcm.googleapis.com");
assert.equal(match[4], pub);
const publicKey = createPublicKey({
  key: { kty: "EC", crv: "P-256", x: server.getPublicKey().subarray(1, 33).toString("base64url"), y: server.getPublicKey().subarray(33).toString("base64url") },
  format: "jwk",
});
assert.ok(verify("sha256", Buffer.from(`${match[1]}.${match[2]}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(match[3], "base64url")), "vapid signature verifies");

console.log("alerts checks ok");
