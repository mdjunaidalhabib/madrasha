const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const harnessPath = path.resolve(__dirname, '../super-admin/clean-modal-qa.html');
  const harness = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Clean modal QA</title></head><body><div id="root"></div><script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import CleanMadrasaModal from '/src/components/super-admin/CleanMadrasaModal.tsx';
import '@madrasha/shared-ui/src/index.css';
createRoot(document.getElementById('root')).render(React.createElement(CleanMadrasaModal, {
  madrasaId: 7, madrasaName: 'QA Institution', onClose: () => {}, onConfirm: payload => { window.qaPayload = payload; }
}));
</script></body></html>`;
  fs.writeFileSync(harnessPath, harness, { flag: 'wx' });
  let browser;
  try {
  console.log('Launching browser');
  browser = await chromium.launch({ headless: true });
    for (const lang of ['en', 'bn']) {
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 950 } });
        page.setDefaultTimeout(10000);
        page.setDefaultNavigationTimeout(10000);
        console.log(`Checking ${lang}, ${width}px`);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(lang => {
          localStorage.setItem('app-language', lang);
          localStorage.setItem('app-institution', JSON.stringify({ type: 'MADRASA', default_language: lang, languages: ['bn', 'en'] }));
        }, lang);
        await page.route('**/api/**', route => route.fulfill({ json: { data: { students: 80, invoices: 100, exams: 3, attendanceRecords: 200, users: 4, staff: 2, teachers: 5 } } }));
        await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
        await page.goto('http://127.0.0.1:5197/clean-modal-qa.html', { waitUntil: 'domcontentloaded' });
        const parts = page.locator('fieldset input[type=checkbox]');
        await parts.first().waitFor();
        assert.equal(await parts.count(), 9);
        assert.equal(await page.locator('fieldset input:checked').count(), 0);
        const submit = page.getByRole('button', { name: lang === 'en' ? 'Clean data' : 'ডেটা ক্লিন করুন', exact: true });
        const acknowledge = page.locator('input[type=checkbox]').last();
        const fillConfirmation = async () => {
          await page.locator('input:not([type])').fill('QA Institution');
          await page.locator('input[type=password]').fill('qa-only');
          await acknowledge.check();
        };
        await fillConfirmation();
        assert.equal(await submit.isDisabled(), true, 'empty selection must not submit');
        await parts.nth(4).check();
        assert.equal(await page.locator('input:not([type])').inputValue(), '');
        assert.equal(await page.locator('input[type=password]').inputValue(), '');
        assert.equal(await acknowledge.isChecked(), false);
        await fillConfirmation();
        await submit.click();
        assert.deepEqual(await page.evaluate(() => window.qaPayload.sections), ['attendance']);
        await page.getByRole('button', { name: lang === 'en' ? 'Clear selection' : 'নির্বাচন বাতিল', exact: true }).click();
        for (const [index, section] of [[1, 'fees'], [2, 'accounts']]) {
          await parts.nth(index).check();
          assert.equal(await parts.nth(index === 1 ? 2 : 1).isChecked(), false);
          await fillConfirmation();
          await submit.click();
          assert.deepEqual(await page.evaluate(() => window.qaPayload.sections), [section]);
          await page.getByRole('button', { name: lang === 'en' ? 'Clear selection' : 'নির্বাচন বাতিল', exact: true }).click();
        }
        await parts.nth(0).check();
        for (const index of [1, 2, 3, 4, 5, 6, 7, 8]) {
          assert.equal(await parts.nth(index).isChecked(), false);
          assert.equal(await parts.nth(index).isDisabled(), false);
        }
        await fillConfirmation();
        await submit.click();
        assert.deepEqual(await page.evaluate(() => window.qaPayload.sections), ['students']);
        assert.equal(await parts.nth(5).isChecked(), false);
        assert.equal(await parts.nth(8).isChecked(), false);
        await parts.nth(5).check();
        assert.equal(await parts.nth(7).isChecked(), false);
        await page.locator('h3').evaluate(element => element.parentElement.scrollTop = 0);
        await page.screenshot({ path: `artifacts/clean-modal-${width}-${lang}.png` });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.locator('input[type=radio]').nth(1).check();
        assert.equal(await page.locator('fieldset').count(), 0);
        assert.equal(await submit.isDisabled(), true);
        await fillConfirmation();
        await submit.click();
        const full = await page.evaluate(() => window.qaPayload);
        assert.equal(full.mode, 'full');
        assert.equal(Object.hasOwn(full, 'sections'), false);
        await page.locator('input[type=radio]').nth(0).check();
        assert.equal(await page.locator('fieldset input:checked').count(), 0);
        assert.deepEqual(errors, []);
        console.log(`Passed: ${lang}, ${width}px, independent selections, confirmation reset and full reset`);
        await page.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    fs.unlinkSync(harnessPath);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
