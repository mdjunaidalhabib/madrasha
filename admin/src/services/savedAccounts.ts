/** "Remember this device" login list - Facebook-style account switcher.
 * Stores only non-secret identifying info (never the password) in
 * localStorage, scoped to this browser, so a returning user can pick a
 * previously-used madrasa+email and log in with just their password
 * instead of retyping the madrasa code and email every time. Multiple
 * madrasa/email combinations can be saved side by side on the same device. */

const STORAGE_KEY = "saved_login_accounts";
const MAX_ACCOUNTS = 8;

export type SavedAccount = {
  madrasaSlug: string;
  /** As typed by the user at save time - kept as a fallback for display in
   * case `madrasaName` isn't available (older saved entries, or the backend
   * didn't return one). */
  madrasaCode: string;
  /** The madrasa's real display name (from the login response) - shown in
   * the switcher instead of the raw code/slug whenever available. */
  madrasaName: string | null;
  email: string;
  name: string;
  photoUrl: string | null;
  roleLabel: string | null;
  lastUsedAt: number;
};

function readAll(): SavedAccount[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(accounts: SavedAccount[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage errors (e.g. private browsing mode / storage full)
  }
}

const sameAccount = (a: Pick<SavedAccount, "madrasaSlug" | "email">, b: SavedAccount) =>
  a.madrasaSlug === b.madrasaSlug && a.email.toLowerCase() === b.email.toLowerCase();

/** Most-recently-used first, for the switcher list. */
export function getSavedAccounts(): SavedAccount[] {
  return readAll().sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/** Called after every successful login - adds this madrasa+email to the
 * device's saved list, or refreshes its name/photo/role if already saved. */
export function upsertSavedAccount(account: Omit<SavedAccount, "lastUsedAt">) {
  const rest = readAll().filter((a) => !sameAccount(account, a));
  const next = [...rest, { ...account, lastUsedAt: Date.now() }]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_ACCOUNTS);
  writeAll(next);
}

/** "Remove from this list" - forgets one saved account on this device. */
export function removeSavedAccount(madrasaSlug: string, email: string) {
  writeAll(readAll().filter((a) => !sameAccount({ madrasaSlug, email }, a)));
}
