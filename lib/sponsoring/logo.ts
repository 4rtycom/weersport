import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { ensureCommercialSchema } from "@/lib/sponsoring/commercial-schema";

const MAX_BYTES = 1_500_000;
const MAX_EDGE = 2400;
const MIN_EDGE = 64;

export type LogoRecord = {
  id: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  body: Buffer;
};

function readUint32(buffer: Buffer, offset: number) {
  return buffer.readUInt32BE(offset);
}

function pngSize(buffer: Buffer) {
  if (buffer.length < 24 || buffer[0] !== 0x89 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  if (buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: readUint32(buffer, 16), height: readUint32(buffer, 20) };
}

function jpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function webpSize(buffer: Buffer) {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunk === "VP8 " && buffer.length > 30) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L" && buffer.length > 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export function inspectLogo(bytes: Uint8Array): { ok: true; contentType: LogoRecord["contentType"]; width: number; height: number } | { ok: false; error: string } {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 16 || buffer.length > MAX_BYTES) {
    return { ok: false, error: "Het logo moet een PNG, JPEG of WebP tot 1,5 MB zijn." };
  }
  const header = buffer.subarray(0, 12).toString("utf8");
  if (header.includes("<svg") || buffer.subarray(0, 5).toString("utf8") === "<?xml") {
    return { ok: false, error: "Het logo moet een PNG, JPEG of WebP tot 1,5 MB zijn." };
  }
  const png = pngSize(buffer);
  const jpeg = png ? null : jpegSize(buffer);
  const webp = png || jpeg ? null : webpSize(buffer);
  const size = png ?? jpeg ?? webp;
  const contentType = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
  if (!size || !contentType) return { ok: false, error: "Het logo moet een PNG, JPEG of WebP tot 1,5 MB zijn." };
  if (size.width < MIN_EDGE || size.height < MIN_EDGE || size.width > MAX_EDGE || size.height > MAX_EDGE) {
    return { ok: false, error: "Het logo moet tussen 64 en 2400 pixels zijn." };
  }
  return { ok: true, contentType, width: size.width, height: size.height };
}

export function storeLogo(bytes: Uint8Array, now = new Date()) {
  const inspected = inspectLogo(bytes);
  if (!inspected.ok) return inspected;
  ensureCommercialSchema();
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO sponsor_logos (id, content_type, body_base64, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, inspected.contentType, Buffer.from(bytes).toString("base64"), inspected.width, inspected.height, now.toISOString());
  return { ok: true as const, id, contentType: inspected.contentType, width: inspected.width, height: inspected.height };
}

export function readLogo(id: string): LogoRecord | null {
  ensureCommercialSchema();
  const row = db().prepare("SELECT * FROM sponsor_logos WHERE id = ?").get(id) as
    | { id: string; content_type: LogoRecord["contentType"]; body_base64: string; width: number; height: number }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    contentType: row.content_type,
    width: row.width,
    height: row.height,
    body: Buffer.from(row.body_base64, "base64"),
  };
}

export function logoIsPublic(id: string) {
  ensureCommercialSchema();
  const row = db()
    .prepare(
      `SELECT sponsor_profiles.id FROM sponsor_profiles
       WHERE logo_id = ? AND moderation_status = 'approved'`,
    )
    .get(id) as { id: string } | undefined;
  return Boolean(row);
}

/** Drop uploads that never became a profile. Issued invoices are untouched. */
export function deleteAbandonedLogos(now = new Date()) {
  ensureCommercialSchema();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  db()
    .prepare(
      `DELETE FROM sponsor_logos
       WHERE created_at < ?
         AND id NOT IN (SELECT logo_id FROM sponsor_profiles WHERE logo_id IS NOT NULL)`,
    )
    .run(cutoff);
}
