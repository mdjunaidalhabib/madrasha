const { chromium } = require('../backend/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('auth-storage', JSON.stringify({ state: {
      token: 'qa-mocked-token', madrasaSlug: 'skeleton-qa', user: { id: 42, name: 'QA', role: 'MUHTAMIM' },
      permissions: ['website.manage'], modules: ['website', 'settings'],
    }, version: 0 })));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let markRequested;
    const settingsRequested = new Promise(resolve => { markRequested = resolve; });
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let json = { data: {} };
      if (path.endsWith('/auth/me')) json = { id: 42, name: 'QA', role_key: 'MUHTAMIM', permissions: ['website.manage'], modules: ['website', 'settings'] };
      else if (path.endsWith('/sidebar')) json = [{ key: 'settings', label: 'Settings', group: 'core', children: [{ key: 'website', label: 'Website settings' }] }];
      else if (path.endsWith('/settings/plan')) json = { data: { plan_status: 'active', has_active_subscription: true, plan_name: 'QA', days_remaining: 100, usage: { students: 1, users: 1 }, student_limit: 100, user_limit: 5 } };
      else if (path.endsWith('/settings/branding')) json = { data: { name: 'QA institution', branding_phones: [], branding_emails: [] } };
      else if (path.endsWith('/website/admin/donations')) json = { data: { allowed: false, config: null } };
      else if (path.endsWith('/website/admin/settings')) {
        markRequested();
        await gate;
        json = { data: { madrasa: { name: 'QA institution' }, settings: {}, pages: [], notices: [], gallery: [], videos: [], slides: [], committee: [] } };
      }
      await route.fulfill({ json });
    });
    await page.goto('http://127.0.0.1:5187/settings/website');
    await settingsRequested;
    await page.locator('[data-website-settings-skeleton]').waitFor();
    const skeleton = page.locator('[data-website-settings-skeleton]');
    assert.equal(await skeleton.locator('aside > div').last().locator(':scope > div').count(), 12);
    const beforeMenu = await skeleton.locator('aside').boundingBox();
    const beforeTitle = await skeleton.locator('h1').boundingBox();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Loading layout horizontal overflow');
    if (width === 390) {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await skeleton.locator('.animate-pulse').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    }
    await page.screenshot({ path: `artifacts/website-settings-loading-${width}.png`, fullPage: true });
    release();
    await page.locator('.settings-sidebar').waitFor();
    const afterMenu = await page.locator('.settings-sidebar').boundingBox();
    const afterTitle = await page.locator('h1').boundingBox();
    for (const key of ['x', 'width']) assert.ok(Math.abs(beforeMenu[key] - afterMenu[key]) < 2, `Menu ${key} shifted`);
    assert.ok(Math.abs(beforeTitle.x - afterTitle.x) < 2, 'Heading shifted horizontally');
    assert.ok(Math.abs(beforeTitle.y - afterTitle.y) < 3, `Heading shifted vertically: ${beforeTitle.y} -> ${afterTitle.y}`);
    assert.equal(await page.locator('[data-website-settings-skeleton]').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  await browser.close();
  console.log('Slow-response desktop/mobile skeleton, matching menu/header geometry, dark mode, reduced motion and loaded transition checks passed.');
})().catch(error => { console.error(error); process.exit(1); });
