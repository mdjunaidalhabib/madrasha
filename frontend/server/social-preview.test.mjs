import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderSocialPreview } from "./social-preview.mjs";

const template = await readFile(new URL("../index.html", import.meta.url), "utf8");
const config = { apiBase: "https://api.example.com/api", platformHost: "ems.example.com" };
const req = (url, host = "ems.example.com") => ({ url, headers: { host, "x-forwarded-proto": "https" } });
const tenants = {
  ahmadiya: { name: 'আহমদিয়া & "মাদ্রাসা"', slug: "ahmadiya", description: "নিজস্ব প্রতিষ্ঠান", logoVersion: "abc" },
  school: { name: "Another School", slug: "school", description: "School address", logoVersion: "def" },
};
const fetcher = async (url) => ({ ok: true, json: async () => ({ data: tenants[url.includes("school") ? "school" : "ahmadiya"] }) });

test("each tenant receives its own metadata in HTML without JavaScript", async () => {
  for (const path of ["/m/ahmadiya", "/m/ahmadiya/contact", "/school", "/school/admission", "/school/guardian/login"]) {
    const result = await renderSocialPreview(template, req(path), config, fetcher);
    const slug = path.includes("school") ? "school" : "ahmadiya";
    assert.ok(result.includes(`/website/public/${slug}/icon/icon-512.png?v=${tenants[slug].logoVersion}`));
    assert.ok(result.includes(`content="https://ems.example.com${path}"`));
    assert.equal((result.match(/property="og:title"/g) || []).length, 1);
    assert.ok(!result.includes("__EMS_SOCIAL_IMAGE_URL__"));
    assert.ok(!result.includes('content="EMS'));
    assert.ok(result.includes('id="root"'));
  }
});

test("escapes institution text and preserves scripts", async () => {
  const result = await renderSocialPreview(template, req("/m/ahmadiya"), config, fetcher);
  assert.ok(result.includes("আহমদিয়া &amp; &quot;মাদ্রাসা&quot;"));
  assert.ok(result.includes('src="/src/main.tsx"'));
});

test("custom domains resolve using a query, without overriding the API host", async () => {
  const result = await renderSocialPreview(template, req("/contact", "school.edu.bd"), config, async (url, options) => {
    assert.equal(url, "https://api.example.com/api/website/share?host=school.edu.bd");
    assert.equal(options.headers.Host, undefined);
    return { ok: true, json: async () => ({ data: tenants.school }) };
  });
  assert.ok(result.includes('content="Another School"'));
  assert.ok(result.includes('content="https://school.edu.bd/contact"'));
});

test("no logo and unavailable tenants do not inherit the platform logo", async () => {
  const noLogo = async () => ({ ok: true, json: async () => ({ data: { ...tenants.school, logoVersion: null } }) });
  for (const api of [noLogo, async () => ({ ok: false, status: 403 }), async () => { throw new Error("offline"); }]) {
    const result = await renderSocialPreview(template, req("/school"), config, api);
    assert.ok(!result.includes('property="og:image'));
    assert.ok(!result.includes('name="twitter:image'));
    assert.ok(!result.includes("__EMS_SOCIAL_IMAGE_URL__"));
  }
});

test("platform home retains platform metadata and does not query a tenant", async () => {
  const result = await renderSocialPreview(template, req("/"), config, () => { throw new Error("must not fetch"); });
  assert.ok(result.includes('content="EMS'));
  assert.ok(result.includes('content="https://ems.example.com/"'));
});

test("internal API routing keeps public image URLs and drops tracking parameters", async () => {
  const result = await renderSocialPreview(template, req("/school?fbclid=123"), { ...config, internalApiBase: "http://backend:5000/api" }, async (url) => {
    assert.equal(url, "http://backend:5000/api/website/public/school/share");
    return { ok: true, json: async () => ({ data: tenants.school }) };
  });
  assert.ok(result.includes("https://api.example.com/api/website/public/school/icon/"));
  assert.ok(!result.includes("backend:5000"));
  assert.ok(!result.includes("fbclid"));
});
