import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Cifrado del token de Instagram en la base (AES-256-GCM).
 * La clave se deriva de un secreto del servidor que nunca se guarda en la base.
 */

export function deriveTokenKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "relojes-carrasco", "instagram-token", 32));
}

export function encryptToken(token: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decryptToken(payload: string, key: Buffer): string {
  const [version, iv, ciphertext, tag] = payload.split(".");
  if (version !== "v1" || !iv || !ciphertext || !tag) {
    throw new Error("Token cifrado con un formato desconocido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
