import crypto from "crypto";
import { env } from "../../shared/config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export class DeviceSecretConfigError extends Error {
  constructor() {
    super("DEVICE_SECRET_ENC_KEY must be set to a 64-character hex string (32 bytes)");
    this.name = "DeviceSecretConfigError";
  }
}

const getKey = (): Buffer => {
  const key = env.deviceSecretEncKey;
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) throw new DeviceSecretConfigError();
  return Buffer.from(key, "hex");
};

/** AES-256-GCM: returns "iv:authTag:ciphertext" (base64 parts). */
export const encryptDeviceSecret = (plain: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
};

export const decryptDeviceSecret = (payload: string): string => {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted device secret");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
};

/** Raw connector key; shown to the admin exactly once. */
export const generateDeviceKey = (): string => `adk_${crypto.randomBytes(32).toString("hex")}`;

/** SHA-256 hex of a raw connector key (same scheme as the kiosk device key). */
export const hashDeviceKey = (rawKey: string): string => crypto.createHash("sha256").update(rawKey).digest("hex");

/** 01712345678 -> 017****78 (for logs and API responses; never log full numbers). */
export const maskPhone = (phone: string | null | undefined): string => {
  const p = String(phone || "");
  if (p.length <= 5) return "***";
  return `${p.slice(0, 3)}****${p.slice(-2)}`;
};

/** Short single-line text safe to store/log: control chars stripped, length capped. */
export const sanitizeShortText = (value: unknown, max = 200): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
