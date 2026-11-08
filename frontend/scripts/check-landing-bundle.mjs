import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Run after `vite build --manifest`. Follow only static imports, just as
// Vite's modulepreload does; route-specific dynamic imports are intentional.
const manifest = JSON.parse(
  await readFile(new URL("../dist/.vite/manifest.json", import.meta.url), "utf8"),
);
const landingEntries = [
  "index.html",
  "src/features/landing/RootRoute.tsx",
  "src/features/landing/PlatformLandingPage.tsx",
];
const tenantEntries = [
  "src/features/website/PublicWebsitePage.tsx",
  "src/layouts/GuardianRoute.tsx",
];
for (const key of [...landingEntries, ...tenantEntries]) {
  assert.ok(manifest[key], `Expected a separate build entry for ${key}`);
}
const loaded = new Set();
function visit(key) {
  if (loaded.has(key)) return;
  loaded.add(key);
  for (const dependency of manifest[key].imports ?? []) visit(dependency);
}
landingEntries.forEach(visit);
for (const key of tenantEntries) {
  assert.ok(!loaded.has(key), `EMS landing preloads tenant code: ${key}`);
}
for (const key of loaded) {
  assert.doesNotMatch(key, /guardian/i, `EMS landing loads guardian code: ${key}`);
}
console.log("PASS: EMS landing static dependencies exclude institution pages and guardian code.");
