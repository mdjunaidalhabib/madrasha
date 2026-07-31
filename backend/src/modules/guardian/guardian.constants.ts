/** Mirrors auth.constants.ts's lockout values so guardian login behaves
 * identically to admin login under repeated failed attempts. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/** Default password for an auto-provisioned guardian account is the last
 * N digits of the student's guardianPhone. Guardian must change it before
 * doing anything else (see Guardian.mustChangePassword). */
export const DEFAULT_PASSWORD_SUFFIX_LENGTH = 4;

export const GUARDIAN_TOKEN_EXPIRY = "30d";

export const GUARDIAN_NOTICES_LIMIT = 20;
