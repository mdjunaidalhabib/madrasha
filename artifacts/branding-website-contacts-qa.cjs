const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: {
        token: 'qa-token', madrasaSlug: 'contacts-qa',
        user: { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'MUHTAMIM' },
        permissions: ['website.manage', 'settings.manage', 'settings.view'], modules: ['website', 'settings'],
      }, version: 0 }));
      localStorage.setItem('app-language', 'en');
      localStorage.setItem('app-institution', JSON.stringify({ type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] }));
    });
    let settings = {
      theme_key: 'modern', theme_color: '#123456', hero_title: 'Keep this title',
      show_gallery: 0, map_url: 'https://maps.app.goo.gl/old',
      social_links: [{ platform: 'facebook', label: 'Campus', url: 'https://facebook.com/campus' }],
    };
    const saved = [];
    await page.route('**/api/**', route => {
      const url = route.request().url();
      if (url.includes('/website/admin/settings')) {
        if (route.request().method() === 'PUT') {
          settings = route.request().postDataJSON();
          saved.push(settings);
          return route.fulfill({ json: { success: true } });
        }
        return route.fulfill({ json: { data: {
          madrasa: { name: 'QA School', address: 'Dhaka', phone: '01700000000', email: 'office@example.com', social_links: [] },
          settings, pages: [], notices: [], gallery: [], videos: [], slides: [], committee: [],
        } } });
      }
      if (url.includes('/settings/branding')) return route.fulfill({ json: { data: { name: 'QA School', address: 'Dhaka', phones: [], emails: [], social_links: [] } } });
      if (url.includes('/sidebar')) return route.fulfill({ json: [] });
      if (url.includes('/auth/me')) return route.fulfill({ json: { id: 7, madrasa_id: 42, role: 'MUHTAMIM', permissions: ['settings.manage', 'website.manage'], modules: ['settings', 'website'], institution: { type: 'MADRASA', default_language: 'en', languages: ['en', 'bn'] } } });
      if (url.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_name: 'QA', plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: { students: 0, users: 1 } } } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });
    for (const width of [360, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('http://127.0.0.1:5195/settings/branding');
      await page.getByRole('heading', { name: 'Location map', exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Open Campus', exact: true }).count(), 1);
      assert.equal(await page.getByRole('heading', { name: 'Social links', exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/branding-website-contacts-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Edit social links', exact: true }).click();
      assert.equal(await page.getByLabel('Platform', { exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Add another link', exact: true }).click();
      assert.equal(await page.locator('input[value="https://facebook.com/campus"]').count(), 1);
      assert.equal(await page.getByLabel('Quick add a link', { exact: true }).count(), 0);
      await page.getByLabel('Other link', { exact: true }).fill('https://community.example.com');
      assert.equal(await page.getByLabel('Platform', { exact: true }).nth(1).inputValue(), 'other');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/branding-website-contacts-edit-${width}.png`, fullPage: true });
      await page.locator('fieldset').getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(saved.length, 0);
    }
    await page.getByRole('button', { name: 'Edit social links', exact: true }).click();
    await page.getByRole('button', { name: 'Telegram', exact: true }).click();
    await page.getByLabel('Telegram link', { exact: true }).fill('https://t.me/campus-news');
    await page.getByRole('button', { name: 'Move up 2', exact: true }).click();
    assert.equal(await page.getByLabel('Platform', { exact: true }).nth(0).inputValue(), 'telegram');
    await page.getByRole('button', { name: 'Add another link', exact: true }).click();
    await page.getByLabel('Other link', { exact: true }).fill('https://community.example.com');
    assert.equal(await page.getByLabel('Platform', { exact: true }).nth(2).inputValue(), 'other');
    await page.locator('input[value="https://facebook.com/campus"]').fill('https://facebook.com/new-campus');
    await page.getByRole('button', { name: 'Add another link', exact: true }).click();
    await page.locator('fieldset').getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Edit social links', exact: true }).waitFor();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].social_links[0].platform, 'telegram');
    assert.equal(saved[0].social_links[1].url, 'https://facebook.com/new-campus');
    assert.equal(saved[0].social_links[2].platform, 'other');
    assert.equal(await page.getByRole('link', { name: 'Open Telegram', exact: true }).getAttribute('href'), 'https://t.me/campus-news');
    const map = page.getByRole('heading', { name: 'Location map', exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await map.getByRole('button', { name: 'Edit', exact: true }).click();
    await map.getByPlaceholder('https://maps.app.goo.gl/...').fill('javascript:alert(1)');
    await map.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(saved.length, 1);
    await map.getByPlaceholder('https://maps.app.goo.gl/...').fill('https://maps.app.goo.gl/new');
    await map.getByRole('button', { name: 'Save', exact: true }).click();
    await map.locator('a[href="https://maps.app.goo.gl/new"]').waitFor();
    assert.equal(saved.length, 2);
    assert.equal(saved[1].map_url, 'https://maps.app.goo.gl/new');
    for (const payload of saved) {
      assert.equal(payload.hero_title, 'Keep this title');
      assert.equal(payload.theme_color, '#123456');
      assert.equal(payload.show_gallery, 0);
      assert.equal(payload.name, 'QA School');
      assert.equal(payload.address, 'Dhaka');
      assert.equal(payload.phone, '01700000000');
    }
    await page.reload();
    await page.getByRole('link', { name: 'Open Campus', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Open Campus', exact: true }).getAttribute('href'), 'https://facebook.com/new-campus');
    await page.getByText('https://maps.app.goo.gl/new', { exact: true }).waitFor();
    await page.goto('http://127.0.0.1:5195/settings/website');
    await page.locator('aside.settings-sidebar').waitFor();
    assert.equal(await page.locator('aside.settings-sidebar').getByRole('button', { name: /Social media|Location map/ }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: preview, pencil edit, platform buttons, removed quick-add section, custom platform, reorder, cancel, responsive layouts, saves, map validation, reload, preserved website settings, removed old section and website tabs');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
