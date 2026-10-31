import { createServer } from "vite";
import { chromium } from "../../backend/node_modules/playwright/index.mjs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

process.chdir(fileURLToPath(new URL("../../admin", import.meta.url)));

const server = await createServer({
  root: new URL("../../admin", import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"),
  server: { host: "127.0.0.1", port: 5198 },
  plugins: [{ name: "routine-preview", configureServer(server) {
    server.middlewares.use("/__routine-preview", async (req, res, next) => {
      if (req.url.includes("html-proxy")) return next();
      const html = await server.transformIndexHtml("/__routine-preview", `<!doctype html><html lang="bn"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import Routine from '/src/features/routine/ClassExamRoutinePage.tsx';
        import '@madrasha/shared-ui/src/index.css';
        createRoot(document.getElementById('root')).render(React.createElement(Routine));
      </script></body></html>`);
      res.setHeader("Content-Type", "text/html"); res.end(html);
    });
  } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  page.setDefaultTimeout(15000);
  const classes = [1, 2, 3, 4].map((id) => ({ classId: id, className: `Class ${id}`, divisionId: 1, divisionName: "Academic division", periodCount: id === 4 ? 0 : 24 }));
  const examRows = classes.map((row) => ({ ...row, examId: 1, examName: "First term examination", examYear: "2026", subjectCount: row.periodCount ? 4 : 0, status: row.periodCount ? "DRAFT" : "NONE" }));
  const examSlots = ["DRAFT", "CANCELLED"].map((status, i) => ({ id: i + 1, examId: 1, classId: 1, subject: i ? "Mathematics" : "Arabic", examDate: "2026-12-10", startTime: "10:00", endTime: "12:00", status }));
  const writes = [];
  const classWrites = [];
  const classSlots = [6, 0, 1, 2, 3, 4].flatMap((dayOfWeek) => [0, 1].map((i) => ({ id: dayOfWeek * 2 + i + 1, classId: 1, dayOfWeek, subject: i ? "Mathematics" : "Arabic", startTime: i ? "08:50" : "08:00", endTime: i ? "09:30" : "08:40" })));
  await page.addInitScript(() => { window.__INTERNAL_API_BASE__ = "http://127.0.0.1:5198/api"; });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === "POST" && path.endsWith("/class-routine")) {
      const payload = route.request().postDataJSON();
      classWrites.push(payload);
      for (const dayOfWeek of payload.days_of_week ?? [payload.day_of_week]) classSlots.push({ id: 100 + classSlots.length, classId: payload.class_id, dayOfWeek, subject: payload.subject, startTime: payload.start_time, endTime: payload.end_time });
      await route.fulfill({ json: { success: true } });
      return;
    }
    if (route.request().method() === "PUT" && path.includes("/exam-routine/")) {
      const payload = route.request().postDataJSON();
      const row = examSlots.find((row) => row.id === Number(path.split("/").pop()));
      assert.ok(row);
      writes.push(payload.status);
      row.status = payload.status;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({ json: { success: true } });
      return;
    }
    let data = [];
    if (path.endsWith("/class-routine/overview")) data = classes;
    else if (path.endsWith("/exam-routine/overview")) data = examRows;
    else if (path.endsWith("/madrasa-divisions")) data = [{ division_id: 1, division_name_bn: "Academic division" }];
    else if (path.endsWith("/madrasa-classes")) data = classes.map((row) => ({ class_id: row.classId, class_name_bn: row.className }));
    else if (path.endsWith("/madrasa-books")) data = [{ book_id: 20, book_name_bn: "Arabic" }];
    else if (path.endsWith("/exams")) data = [{ id: 1, name: "First term examination", year: "2026", isActive: false }];
    else if (path.endsWith("/class-routine")) data = classSlots;
    else if (path.endsWith("/exam-routine")) data = examSlots;
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto("http://127.0.0.1:5198/__routine-preview");
  await page.getByRole("button").filter({ hasText: "Class 1" }).waitFor();
  await mkdir(new URL(".", import.meta.url), { recursive: true });
  await page.screenshot({ path: new URL("class-desktop.png", import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"), fullPage: true });
  await page.getByRole("button").filter({ hasText: "Class 1" }).click();
  const classTable = page.getByRole("table");
  await classTable.getByText("Mathematics", { exact: true }).first().waitFor();
  assert.equal(await classTable.locator("thead th").count(), 9);
  assert.equal(await classTable.locator("tbody tr").count(), 6);
  assert.ok((await classTable.locator("thead").textContent()).includes("০৮:০০–০৮:৪০"));
  await page.screenshot({ path: new URL("class-entry.png", import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"), fullPage: true });
  await page.getByRole("button", { name: "প্রিভিউ", exact: true }).click();
  const classPrint = page.getByRole("dialog").last().getByRole("table");
  assert.equal(await classPrint.locator("tbody tr").count(), 6);
  assert.equal(await classPrint.locator("thead th").count(), 9);
  await page.screenshot({ path: fileURLToPath(new URL("class-period-preview.png", import.meta.url)), fullPage: true });
  await page.keyboard.press("Escape");
  await page.locator('select').nth(3).selectOption("Arabic");
  await page.locator('input[type="time"]').nth(0).fill("14:00");
  await page.locator('input[type="time"]').nth(1).fill("14:40");
  await page.getByRole("button", { name: "যোগ করুন", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('table thead')?.textContent.includes("১৪:০০–১৪:৪০"));
  assert.equal(await classTable.locator("thead th").count(), 9);
  assert.deepEqual(classWrites[0].days_of_week, [6, 0, 1, 2, 3, 4]);
  assert.equal(classSlots.filter((row) => row.startTime === "14:00").length, 6);
  await page.keyboard.press("Escape");
  await page.locator('button[aria-pressed="false"]').first().click();
  await page.getByText("First term examination", { exact: false }).first().waitFor();
  await page.getByRole("button").filter({ hasText: "Class 1" }).click();
  const activation = page.getByRole("switch").last();
  await activation.waitFor();
  const table = page.getByRole("dialog").getByRole("table");
  assert.deepEqual(await table.locator("thead th").allTextContents(), ["তারিখ", "বার", "সময়", "কিতাব", "কার্যক্রম"]);
  assert.deepEqual((await table.locator("tbody tr").first().locator("td").allTextContents()).slice(0, 3).map((value) => value.trim()), ["১০/১২/২০২৬", "বৃহস্পতিবার", "১০:০০–১২:০০"]);
  await page.getByRole("button", { name: "প্রিভিউ", exact: true }).click();
  const printTable = page.getByRole("dialog").last().getByRole("table");
  assert.deepEqual((await printTable.locator("thead th").allTextContents()).slice(0, 2), ["তারিখ", "বার"]);
  assert.equal((await printTable.locator("thead th").allTextContents()).length, 5);
  assert.deepEqual((await printTable.locator("tbody tr").first().locator("td").allTextContents()).slice(0, 4).map((value) => value.trim()), ["১০/১২/২০২৬", "বৃহস্পতিবার", "১০:০০", "১২:০০"]);
  await page.screenshot({ path: fileURLToPath(new URL("exam-preview.png", import.meta.url)), fullPage: true });
  await page.keyboard.press("Escape");
  assert.equal(await activation.getAttribute("aria-checked"), "false");
  assert.equal(await page.locator('select option[value="CANCELLED"]').count(), 0);
  await activation.click();
  await page.waitForFunction(() => document.querySelectorAll('[role="switch"]')[1]?.getAttribute("aria-busy") === "false");
  assert.equal(await activation.getAttribute("aria-checked"), "true");
  assert.deepEqual(examSlots.map((row) => row.status), ["PUBLISHED", "PUBLISHED"]);
  await page.screenshot({ path: fileURLToPath(new URL("exam-active.png", import.meta.url)), fullPage: true });
  await activation.press("Space");
  await page.waitForFunction(() => document.querySelectorAll('[role="switch"]')[1]?.getAttribute("aria-busy") === "false");
  assert.equal(await activation.getAttribute("aria-checked"), "false");
  assert.deepEqual(examSlots.map((row) => row.status), ["DRAFT", "DRAFT"]);
  assert.deepEqual(writes, ["PUBLISHED", "PUBLISHED", "DRAFT", "DRAFT"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: fileURLToPath(new URL("exam-toggle-mobile.png", import.meta.url)), fullPage: true });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: new URL("exam-desktop.png", import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Mobile page overflows horizontally");
  await page.screenshot({ path: new URL("exam-mobile.png", import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"), fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({ path: new URL("exam-dark.png", import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"), fullPage: true });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Verified period timetable and print matrix, all-days period creation, exam formatting/toggles, keyboard operation, mobile width and dark mode with mock API data.");
} finally {
  await browser?.close();
  await server.close();
}
