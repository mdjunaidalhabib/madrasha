import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL("../src/utils/pwaManifest.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness({ platform = true, loadBrand } = {}) {
  let manifest = null;
  const modules = {
    "@madrasha/shared-ui/src/pwa/pwa": {
      disablePwaInstall: () => { manifest = null; },
      setPwaManifest: (value) => { manifest = value; },
    },
    "@madrasha/shared-ui/src/pwa/brandIcons": {
      applyBrandFavicon() {}, logoVersion: (logo) => logo,
      tenantIconBase: (slug) => `/icons/${slug}`, platformIconBase: () => "/platform-icons",
    },
    "@madrasha/shared-ui/src/services/apiConfig": { API_BASE_URL: "/api" },
    "../services/domainResolve": { resolveDomainToSlug: async () => "school" },
    "../services/publicWebsiteApi": {
      getPublicBrand: async (slug) => (await (loadBrand || (async (slug) => ({ madrasa: { slug, name: `Name ${slug}`, logo_url: "logo.png" } })))(slug)).madrasa,
    },
    "./platformHost": { isPlatformRootHost: () => platform },
    "@madrasha/shared-ui/src/i18n": { getText: (dict) => dict.en },
    "../app/app.text": { appText: { en: { appName: "School", pwaDescription: (name) => name } } },
    "../features/guardian/guardianPwa.text": { guardianPwaText: { en: { title: "Guardian", description: "Guardian app" } } },
  };
  const exports = {};
  runInNewContext(code, {
    exports, require: (id) => modules[id] || require(id),
    document: { title: "Platform" }, window: { location: { pathname: "/" } },
    fetch: async () => ({ ok: false }),
  });
  return { ...exports, manifest: () => manifest };
}

test("guardian app has its own identity, launch URL and scope across login/logout", async () => {
  const app = harness();
  await app.setupTenantManifest("/school/");
  const publicId = app.manifest().id;
  await app.setupTenantManifest("/school/guardian/login");
  assert.notEqual(app.manifest().id, publicId);
  assert.equal(app.manifest().name, "Name school — Guardian");
  assert.equal(app.manifest().scope, "/school/guardian/");
  assert.equal(app.manifest().startUrl, "/school/guardian/dashboard");
  const guardianId = app.manifest().id;
  await app.setupTenantManifest("/school/guardian/dashboard");
  await app.setupTenantManifest("/school/guardian/login");
  assert.equal(app.manifest().id, guardianId);
  await app.setupTenantManifest("/m/school");
  assert.equal(app.manifest().id, publicId);
  assert.equal(app.manifest().scope, "/school/");
});

test("demo guardian routes enable their own app while the bare demo route stays disabled", async () => {
  const app = harness();
  assert.equal(app.getTenantStartUrl("/demo"), "/");
  await app.setupTenantManifest("/demo/guardian/login");
  assert.equal(app.manifest().id, "/demo/guardian");
  assert.equal(app.manifest().scope, "/demo/guardian/");
  assert.equal(app.manifest().startUrl, "/demo/guardian/dashboard");
  await app.setupTenantManifest("/demo/guardian/dashboard");
  assert.equal(app.manifest().id, "/demo/guardian");
  await app.setupTenantManifest("/demo");
  assert.equal(app.manifest(), null);
});

test("custom domains install a guardian app scoped only to the guardian portal", async () => {
  const app = harness({ platform: false });
  await app.setupTenantManifest("/guardian/login");
  assert.equal(app.manifest().id, "/school/guardian");
  assert.equal(app.manifest().scope, "/guardian/");
  assert.equal(app.manifest().startUrl, "/guardian/dashboard");
  await app.setupTenantManifest("/");
  assert.equal(app.manifest().id, "/school");
});

test("late institution responses cannot replace the active guardian app", async () => {
  let resolveOld;
  const app = harness({ loadBrand: (slug) => slug === "old"
    ? new Promise((resolve) => { resolveOld = resolve; })
    : Promise.resolve({ madrasa: { slug, name: "Current", logo_url: "current.png" } }) });
  const pending = app.setupTenantManifest("/old/guardian/login");
  await app.setupTenantManifest("/current/guardian/login");
  resolveOld({ madrasa: { slug: "old", name: "Old", logo_url: "old.png" } });
  await pending;
  assert.equal(app.manifest().id, "/current/guardian");
});

test("institutions without a verified logo cannot install a generic app", async () => {
  const app = harness({ loadBrand: async (slug) => ({ madrasa: { slug, name: "School", logo_url: null } }) });
  await app.setupTenantManifest("/school/guardian/login");
  assert.equal(app.manifest(), null);
});
