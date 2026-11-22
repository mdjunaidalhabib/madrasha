import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

function load(path, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(code, { exports, ...globals });
  return exports;
}

const validation = load("../src/features/guardian/guardianLoginValidation.ts");
const cooldown = load("../src/features/guardian/loginCooldown.ts");
test("lockout uses server remaining time and ignores ordinary login errors", () => {
  assert.equal(cooldown.getLoginRetrySeconds({ status: 400, data: { code: "GUARDIAN_LOGIN_LOCKED", retryAfterSeconds: 900 } }), 900);
  assert.equal(cooldown.getLoginRetrySeconds({ status: 429, data: { retryAfterSeconds: 23 } }), 23);
  assert.equal(cooldown.getLoginRetrySeconds({ status: 429, headers: { "retry-after": "45" } }), 45);
  assert.equal(cooldown.getLoginRetrySeconds({ status: 400, data: { message: "Invalid credentials" } }), 0);
  assert.equal(cooldown.getLoginRetrySeconds({ status: 423, data: { message: "Tenant suspended" } }), 0);
});
test("countdown rounds up and unlocks only after the deadline", () => {
  assert.equal(cooldown.remainingLoginSeconds(10000, 9999), 1);
  assert.equal(cooldown.remainingLoginSeconds(10000, 10000), 0);
  assert.equal(cooldown.remainingLoginSeconds(10000, 11000), 0);
  assert.equal(cooldown.formatLoginCountdown(900), "15:00");
  assert.equal(cooldown.formatLoginCountdown(65), "01:05");
});
test("login validation handles empty fields, invalid numbers and Bangla digits", () => {
  assert.equal(validation.validateGuardianLogin(" ", "").phone, "phoneRequired");
  assert.equal(validation.validateGuardianLogin("01712345678", " ").password, "passwordRequired");
  assert.equal(validation.validateGuardianLogin("hello", "pass").phone, "phoneInvalid");
  assert.equal(validation.validateGuardianLogin("০১৭১২ ৩৪৫৬৭৮", "pass").phone, null);
  assert.equal(validation.normalizeGuardianPhone("০১৭১২ ৩৪৫৬৭৮"), "01712345678");
});

function brandApi(storage = new Map()) {
  let calls = 0;
  let reject = false;
  const modules = {
    axios: { default: { create: () => ({ get: async (url) => {
      calls++;
      if (reject) throw new Error("Unavailable");
      const slug = url.split("/").at(-2);
      return { data: { data: { slug, name: `Name ${slug}`, address: "Address", logo_url: "logo.png" } } };
    } }) } },
    "@madrasha/shared-ui/src/i18n": { attachLanguageHeader() {}, useLanguageStore: { getState: () => ({ setInstitution() {} }) } },
    "@madrasha/shared-ui/src/services/apiConfig": { API_BASE_URL: "/api" },
  };
  const api = load("../src/services/publicWebsiteApi.ts", {
    require: (id) => { assert.ok(modules[id], id); return modules[id]; },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  return { ...api, calls: () => calls, fail: () => { reject = true; } };
}

test("manifest and login share one brand request and recent results", async () => {
  const api = brandApi();
  const [a, b] = await Promise.all([api.getPublicBrand("school"), api.getPublicBrand("school")]);
  assert.equal(a, b);
  assert.equal(api.calls(), 1);
  await api.getPublicBrand("school");
  assert.equal(api.calls(), 1);
});

test("reload shows cached name/address immediately and keeps institutions separate", async () => {
  const storage = new Map();
  await brandApi(storage).getPublicBrand("school");
  const reloaded = brandApi(storage);
  assert.equal(reloaded.getCachedPublicBrand("school").address, "Address");
  assert.equal(reloaded.calls(), 0);
  assert.equal(reloaded.getCachedPublicBrand("other"), null);
  await reloaded.getPublicBrand("school");
  assert.equal(reloaded.calls(), 1);
});

test("failed brand revalidation clears saved branding", async () => {
  const storage = new Map();
  await brandApi(storage).getPublicBrand("school");
  const api = brandApi(storage);
  api.fail();
  await assert.rejects(api.getPublicBrand("school"));
  assert.equal(api.getCachedPublicBrand("school"), null);
});
