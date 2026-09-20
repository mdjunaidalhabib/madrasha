import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ deviceSecretEncKey: "ab".repeat(32) }));
vi.mock("../../../shared/config/env", () => ({ env }));

import {
  decryptDeviceSecret,
  DeviceSecretConfigError,
  encryptDeviceSecret,
  generateDeviceKey,
  hashDeviceKey,
  maskPhone,
  sanitizeShortText,
} from "../device-secret.util";

afterEach(() => {
  env.deviceSecretEncKey = "ab".repeat(32);
});

describe("device secret encryption (AES-256-GCM)", () => {
  it("round-trips and never stores plaintext", () => {
    const enc = encryptDeviceSecret("123456");
    expect(enc).not.toContain("123456");
    expect(enc.split(":")).toHaveLength(3);
    expect(decryptDeviceSecret(enc)).toBe("123456");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptDeviceSecret("123456")).not.toBe(encryptDeviceSecret("123456"));
  });

  it("detects tampering (GCM auth tag)", () => {
    const [iv, tag, data] = encryptDeviceSecret("123456").split(":");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 0xff;
    expect(() => decryptDeviceSecret([iv, tag, flipped.toString("base64")].join(":"))).toThrow();
  });

  it("fails to decrypt with a different key", () => {
    const enc = encryptDeviceSecret("123456");
    env.deviceSecretEncKey = "cd".repeat(32);
    expect(() => decryptDeviceSecret(enc)).toThrow();
  });

  it("refuses to encrypt when DEVICE_SECRET_ENC_KEY is missing or malformed", () => {
    env.deviceSecretEncKey = "";
    expect(() => encryptDeviceSecret("x")).toThrow(DeviceSecretConfigError);
    env.deviceSecretEncKey = "short";
    expect(() => encryptDeviceSecret("x")).toThrow(DeviceSecretConfigError);
  });
});

describe("device key hashing", () => {
  it("hashes deterministically to sha256 hex and never equals the raw key", () => {
    const raw = generateDeviceKey();
    expect(raw).toMatch(/^adk_[0-9a-f]{64}$/);
    const h = hashDeviceKey(raw);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashDeviceKey(raw));
    expect(h).not.toContain(raw);
    // same scheme as the kiosk device key (sha256 hex of the raw key)
    expect(hashDeviceKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("generates unique keys", () => {
    expect(generateDeviceKey()).not.toBe(generateDeviceKey());
  });
});

describe("helpers", () => {
  it("masks phone numbers", () => {
    expect(maskPhone("01712345678")).toBe("017****78");
    expect(maskPhone("123")).toBe("***");
    expect(maskPhone(null)).toBe("***");
  });

  it("sanitizes free text: single line, capped", () => {
    expect(sanitizeShortText("line1\nline2\t\u0000x")).toBe("line1 line2 x");
    expect(sanitizeShortText("a".repeat(500), 50)?.length).toBe(50);
    expect(sanitizeShortText("   ")).toBeNull();
    expect(sanitizeShortText(null)).toBeNull();
  });
});
