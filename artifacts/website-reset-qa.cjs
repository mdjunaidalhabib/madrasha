const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('../backend/node_modules/playwright');
require('../backend/node_modules/ts-node').register({ transpileOnly: true, project: path.resolve(__dirname, '../backend/tsconfig.json') });
const { DEFAULT_WEBSITE_TEMPLATE } = require('../backend/src/modules/public-website/website-template.schema.ts');

async function checkFlow(page, open, resetCount, bn, screenshot) {
  const next = [/হ্যাঁ, পরের ধাপ|Yes, next step/, /বুঝেছি, এগিয়ে যান|I understand, continue/];
  const titles = bn ? [/১\/৩/, /২\/৩/, /৩\/৩/] : [/1\/3/, /2\/3/, /3\/3/];
  const cancel = () => page.getByRole('button', { name: /^(বাতিল|Cancel)$/ });
  for (let stop = 0; stop < 3; stop++) {
    await open();
    for (let step = 0; step <= stop; step++) {
      await page.getByRole('heading', { name: titles[step] }).waitFor();
      assert.equal(resetCount(), 0, 'Opening or advancing confirmations must never reset');
      if (step < stop) await page.getByRole('button', { name: next[step] }).click();
    }
    if (stop === 2) {
      assert.match(await page.locator('body').innerText(), /Al Noor Academy/, 'The final confirmation identifies the institution');
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.resolve(__dirname, screenshot) });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await cancel().click();
    await page.getByRole('heading', { name: titles[stop] }).waitFor({ state: 'hidden' });
    assert.equal(resetCount(), 0, 'Cancellation at every step must leave the website untouched');
  }
  return async () => {
    await open();
    await page.getByRole('heading', { name: titles[0] }).waitFor();
    await page.getByRole('button', { name: next[0] }).click();
    await page.getByRole('heading', { name: titles[1] }).waitFor();
    assert.match(await page.locator('body').innerText(), bn ? /ভর্তি আবেদন, শিক্ষার্থী/ : /Admission applications, students/);
    await page.getByRole('button', { name: next[1] }).click();
    await page.getByRole('heading', { name: titles[2] }).waitFor();
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const errors = [];
    const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    admin.on('pageerror', e => errors.push(e.message));
    await admin.addInitScript(() => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'theme-qa', user: { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'admin' }, permissions: ['website.manage'], modules: ['website'] }, version: 0 }));
      localStorage.setItem('app-language', 'en');
    });
    await admin.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    let adminResets = 0;
    let adminReads = 0;
    let failAdmin = true;
    let settings = { theme_key: 'editorial', theme_color: '#0f766e', hero_title: 'Custom website headline' };
    await admin.route('**/api/**', async route => {
      const url = route.request().url();
      if (url.includes('/website/admin/reset')) {
        adminResets++;
        await new Promise(resolve => setTimeout(resolve, 400));
        if (failAdmin) return route.fulfill({ status: 500, json: { message: 'QA reset unavailable' } });
        settings = { ...settings, theme_key: 'modern', hero_title: 'Main demo headline' };
        return route.fulfill({ json: { message: 'Website restored' } });
      }
      if (url.includes('/website/admin/settings')) {
        adminReads++;
        return route.fulfill({ json: { data: { madrasa: { name: 'Al Noor Academy', slug: 'theme-qa' }, settings, pages: [], notices: [], gallery: [], slides: [], videos: [], committee: [] } } });
      }
      if (url.includes('/sidebar')) return route.fulfill({ json: [] });
      if (url.includes('/auth/me')) return route.fulfill({ json: { id: 7, madrasa_id: 42, name: 'QA Admin', permissions: ['website.manage'], modules: ['website'], institution: { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] } } });
      if (url.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_name: 'QA', plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: { students: 0, users: 1 } } } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });
    await admin.goto('http://127.0.0.1:5194/settings/website');
    const openAdmin = () => admin.getByRole('button', { name: 'Reset website', exact: true }).click();
    const adminFinal = await checkFlow(admin, openAdmin, () => adminResets, false, 'website-reset-admin-mobile.png');
    await adminFinal();
    await admin.getByRole('button', { name: 'Confirm, reset website', exact: true }).click();
    assert.equal(await admin.getByRole('button', { name: /Please wait/ }).isDisabled(), true);
    await admin.getByText('QA reset unavailable', { exact: true }).first().waitFor();
    assert.equal(adminResets, 1);
    assert.equal(settings.theme_key, 'editorial');
    failAdmin = false;
    await adminFinal();
    const readsBefore = adminReads;
    await Promise.all([
      admin.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      admin.getByRole('button', { name: 'Confirm, reset website', exact: true }).click(),
    ]);
    await admin.getByRole('button', { name: 'Reset website', exact: true }).waitFor();
    assert.equal(adminResets, 2);
    assert.ok(adminReads > readsBefore, 'A successful reset reloads the saved settings');
    await admin.getByRole('button', { name: /Theme & hero banner/ }).click();
    assert.equal(await admin.locator('input[value="modern"]').isChecked(), true);

    const superPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    superPage.on('pageerror', e => errors.push(e.message));
    await superPage.addInitScript(() => localStorage.setItem('admin_token', 'qa-token'));
    await superPage.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    let superResets = 0;
    let failSuper = true;
    let superTheme = 'editorial';
    await superPage.route('**/api/**', async route => {
      const url = route.request().url();
      if (url.includes('/super/madrasas/42/reset')) {
        superResets++;
        if (failSuper) return route.fulfill({ status: 500, json: { message: 'QA super reset unavailable' } });
        superTheme = 'modern';
        return route.fulfill({ json: { message: 'Website restored' } });
      }
      if (url.includes('/super/madrasas/42/theme')) return route.fulfill({ json: { theme_key: superTheme } });
      if (url.includes('/website/super/default-template')) return route.fulfill({ json: { data: { content: DEFAULT_WEBSITE_TEMPLATE, updatedAt: null } } });
      if (/\/madrasas(?:\?|$)/.test(url)) return route.fulfill({ json: { data: [{ id: 42, name: 'Al Noor Academy', slug: 'theme-qa', website_status: 'active' }], total: 1 } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });
    await superPage.goto('http://127.0.0.1:5195/websites');
    await superPage.getByRole('button', { name: /প্রতিষ্ঠানের থিম ও স্ট্যাটাস/ }).click();
    const openSuper = () => superPage.getByRole('button', { name: 'ওয়েবসাইট রিসেট', exact: true }).click();
    const superFinal = await checkFlow(superPage, openSuper, () => superResets, true, 'website-reset-super-mobile.png');
    await superFinal();
    await superPage.getByRole('button', { name: 'নিশ্চিত, ওয়েবসাইট রিসেট করুন', exact: true }).click();
    await superPage.getByRole('alert').filter({ hasText: 'QA super reset unavailable' }).waitFor();
    assert.equal(superResets, 1);
    failSuper = false;
    await superFinal();
    await superPage.getByRole('button', { name: 'নিশ্চিত, ওয়েবসাইট রিসেট করুন', exact: true }).click();
    await superPage.getByText('ওয়েবসাইট মূল ডেমোতে ফিরে এসেছে।', { exact: true }).waitFor();
    assert.equal(superResets, 2);
    await superPage.waitForFunction(() => document.querySelector('[role="group"] button[aria-pressed="true"]')?.textContent.includes('মডার্ন'));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ panels: ['admin', 'super-admin'], confirmations: 3, cancelEachStep: 'passed', noEarlyReset: 'passed', failureRecovery: 'passed', savedDemoReload: 'passed', pageErrors: errors }));
  } finally { await browser.close(); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
