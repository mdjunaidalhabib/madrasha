import { createHash } from "crypto";

// Bind sessions to the current credential so resetting it revokes older tokens.
export const guardianCredentialVersion = (passwordHash: string) =>
  createHash("sha256").update(passwordHash).digest("hex");
