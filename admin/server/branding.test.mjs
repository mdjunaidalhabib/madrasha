import { test } from "node:test";
import assert from "node:assert/strict";
import { institutionHtml } from "./branding.mjs";
test("custom domain HTML contains only the institution brand and escapes names", () => {
  const html =
    '<title>EMS Admin</title><meta name="description" content="Hikmah IT" /><meta property="og:site_name" content="EMS" /><meta property="og:image" content="platform.png" /><meta name="apple-mobile-web-app-title" content="EMS Admin" />';
  const result = institutionHtml(
    html,
    { name: 'Jamia <A> & "B"', slug: "jamia", logo: "logo.png" },
    "https://api.example.com/api",
  );
  assert.ok(result.includes("Jamia &lt;A&gt; &amp; &quot;B&quot;"));
  assert.ok(result.includes("/website/public/jamia/icon/icon-512.png"));
  assert.doesNotMatch(result, /EMS|Hikmah|platform\.png/);
});
test("missing institution logo never falls back to a platform logo", () => {
  assert.equal(
    institutionHtml(
      '<meta property="og:image" content="platform.png" />',
      { name: "Jamia", slug: "jamia", logo: null },
      "https://api.example.com/api",
    ),
    '<meta property="og:image" content="" />',
  );
});
