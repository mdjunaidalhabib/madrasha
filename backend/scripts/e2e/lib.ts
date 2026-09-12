import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:5190/api";
// Login is rate-limited (20/15min per IP, see auth.routes.ts's
// loginLimiter) - cache tokens across separate `ts-node` phase-script
// invocations so re-running/debugging one phase doesn't burn through that
// budget and starve the others. Purely a local dev-testing convenience;
// never used by the app itself.
const TOKEN_CACHE_FILE = path.join(__dirname, ".token-cache.json");

export type ApiResult<T = any> = { status: number; body: T };

export async function apiCall<T = any>(
  method: string,
  path: string,
  opts: { slug?: string; token?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.slug) headers["X-Madrasa-Slug"] = opts.slug;
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let body: any = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

export const get = (path: string, opts?: { slug?: string; token?: string }) => apiCall("GET", path, opts);
export const post = (path: string, body: unknown, opts?: { slug?: string; token?: string }) =>
  apiCall("POST", path, { ...opts, body });
export const put = (path: string, body: unknown, opts?: { slug?: string; token?: string }) =>
  apiCall("PUT", path, { ...opts, body });
export const del = (path: string, opts?: { slug?: string; token?: string }) => apiCall("DELETE", path, opts);

type TokenCache = Record<string, { token: string; cachedAt: number }>;

function readCache(): TokenCache {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeCache(cache: TokenCache) {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // best-effort - caching is a convenience, not a requirement
  }
}

// Access tokens expire in 15 minutes (see jwt.util.ts) - treat a cached one
// as stale after 12 to leave a safety margin for a phase script's own
// runtime.
const TOKEN_CACHE_TTL_MS = 12 * 60 * 1000;

export async function login(slug: string, email: string, password: string): Promise<string> {
  const key = `${slug}:${email}`;
  const cache = readCache();
  const cached = cache[key];
  if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL_MS) {
    return cached.token;
  }

  const res = await post("/auth/login", { email, password }, { slug });
  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`Login failed for ${email}@${slug}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  cache[key] = { token: res.body.token, cachedAt: Date.now() };
  writeCache(cache);
  return res.body.token;
}

// Shared state written by earlier phase scripts (madrasa ids from phase0,
// student ids from phase2, exam ids from phase3, ...) and read back by
// later ones - so a DB reset/reseed that shifts auto-increment ids (as
// happened once already - the suite used to hardcode madrasa ids 19/20 and
// student ids 403-412, which silently went stale) can't desync the phases
// again. Same on-disk-cache convention as the token cache above.
const FIXTURE_STATE_FILE = path.join(__dirname, ".fixture-state.json");

export function readFixtureState(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(FIXTURE_STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function writeFixtureState(patch: Record<string, unknown>) {
  const state = { ...readFixtureState(), ...patch };
  fs.writeFileSync(FIXTURE_STATE_FILE, JSON.stringify(state, null, 2));
}

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

export function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passCount++;
    console.log(`  [PASS] ${label}`);
  } else {
    failCount++;
    const msg = `  [FAIL] ${label}${detail !== undefined ? " -> " + JSON.stringify(detail) : ""}`;
    console.log(msg);
    failures.push(`${label}${detail !== undefined ? " -> " + JSON.stringify(detail) : ""}`);
  }
}

export function summary(): boolean {
  console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed ===`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  return failCount === 0;
}
