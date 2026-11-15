// Browser regression check using the production report stylesheet. No API or DB needed.
// Run from the repository root: node backend/scripts/check-report-print.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { chromium } = require("playwright");

function printedPages(pdf) {
  const source = pdf.toString("latin1");
  const objects = new Map(
    [...source.matchAll(/(\d+) 0 obj\b([\s\S]*?)endobj/g)].map((m) => [m[1], m[2]]),
  );
  const forms = new Map([...source.matchAll(/\/(X\d+) (\d+) 0 R/g)].map((m) => [m[1], m[2]]));
  const decode = (id) => {
    const contents = objects.get(id);
    const stream = contents.match(/stream\r?\n([\s\S]*?)\r?\nendstream/)[1];
    return zlib
      .inflateSync(Buffer.from(stream, "latin1"))
      .toString("latin1")
      .replace(/\/(X\d+) Do/g, (command, name) =>
        forms.has(name) ? decode(forms.get(name)) : command,
      );
  };
  return [...objects.values()]
    .filter((body) => /\/Type\s*\/Page\b/.test(body))
    .map((body) => {
      return decode(body.match(/\/Contents (\d+) 0 R/)[1]);
    });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const css = fs.readFileSync(
      path.join(__dirname, "../../packages/shared-ui/src/index.css"),
      "utf8",
    );
    let checked = 0;
    for (const size of ["a4", "a5"]) {
      for (const orientation of ["portrait", "landscape"]) {
        for (const layout of ["standalone", "dashboard", "settings"]) {
          for (const kind of [
            "table",
            "cards",
            ...(orientation === "landscape" ? ["two-up"] : []),
          ]) {
            const pages = Array.from({ length: 3 }, (_, i) =>
              kind === "two-up"
                ? `
            <section class="print-page-preview report-print-page marksheet-sheet"
              style="--tile-w:${size === "a4" ? 148.5 : 105}mm;--tile-h:${size === "a4" ? 210 : 148}mm;--tile-scale:${size === "a4" ? 1 : 148 / 210}">
              ${[1, 2]
                .map(
                  (n) => `<div class="marksheet-tile"><div class="marksheet-tile-scaler">
                <section class="print-page-preview marksheet-half"><h1>Marksheet ${i * 2 + n}</h1>
                  <table><tbody><tr><td>Student ${n}</td></tr></tbody></table></section>
              </div></div>`,
                )
                .join("")}
              <div class="marksheet-cut-line"></div>
            </section>`
                : `
            <section class="print-page-preview report-print-page">
              <h1>Report page ${i + 1}</h1>${
                kind === "cards"
                  ? '<div class="card-grid" style="display:grid;grid-template-columns:1fr 1fr"><article>Front card</article><article>Back card</article></div>'
                  : `<table><tbody><tr><td>Student ${i + 1}</td></tr></tbody></table>`
              }
              <div class="report-page-footer">Page ${i + 1}</div>
            </section>`,
            ).join("");
            const preview = `<div class="print-preview-viewport" data-report-ready="true">
            <div class="print-area print-pages" style="--report-preview-scale:.6">${pages}</div></div>`;
            // Match the dashboard's fixed-height, scrolling/positioned containers,
            // including an open settings panel and unrelated content below the report.
            const content =
              layout === "standalone"
                ? preview
                : `
            <div style="display:flex;height:100vh;overflow:hidden;position:relative">
              <aside style="width:220px">Navigation</aside>
              <main style="flex:1;overflow:auto;padding:24px">
                <div style="min-height:100vh"><header style="height:200px">Toolbar</header>
                  <div style="display:grid;grid-template-columns:220px 1fr">
                    <aside>Report sidebar</aside><main style="overflow:clip;border:1px solid">
                      <div style="display:flex"><div style="flex:1;min-width:0">
                        <div class="print-preview-wrap">${preview}</div>
                      </div>${layout === "settings" ? '<aside style="width:320px;height:1800px">Settings</aside>' : ""}</div>
                    </main>
                  </div>
                </div><footer style="height:2200px">Unrelated content</footer>
              </main>
            </div>`;
            await page.setContent(`<html data-print-size="${size}" data-print-orientation="${orientation}">
            <head><style>${css}</style><style>@page { size:${size} ${orientation};margin:0 }</style></head>
            <body><div id="root"><div aria-hidden="true" style="position:fixed;left:-99999px;visibility:hidden">
              <div class="print-page-preview report-print-page">Measurement only</div>
            </div>${content}</div></body></html>`);
            const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
            const streams = printedPages(pdf);
            const label = `${size} ${orientation} ${layout} ${kind}`;
            assert.equal(streams.length, 3, `${label}: unexpected blank/extra pages`);
            streams.forEach((stream, i) => {
              assert.equal(
                (stream.match(/\bBT\b/g) || []).length,
                kind === "table" ? 3 : 4,
                `${label}: page ${i + 1} has missing report text or unwanted UI`,
              );
            });
            await page.emulateMedia({ media: "print" });
            if (kind === "cards") {
              assert.equal(
                await page
                  .locator(".card-grid")
                  .first()
                  .evaluate((el) => getComputedStyle(el).display),
                "grid",
                `${label}: card layout must survive print isolation`,
              );
            }
            if (kind === "two-up") {
              assert.equal(
                await page
                  .locator(".marksheet-sheet")
                  .first()
                  .evaluate((el) => getComputedStyle(el).display),
                "flex",
                `${label}: two-up layout must survive print isolation`,
              );
              assert.equal(
                await page
                  .locator(".marksheet-half")
                  .first()
                  .evaluate((el) => Math.round(el.offsetHeight)),
                794,
                `${label}: inner page must retain its A5 portrait height`,
              );
            }
            await page.emulateMedia({ media: null });
            checked++;
          }
        }
      }
    }
    console.log(
      `PASS: ${checked} report print layouts; all ${checked * 3} PDF pages contain text, with no extra pages.`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
