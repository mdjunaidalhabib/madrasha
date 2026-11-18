const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const resets = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: {
        token: 'qa-token', madrasaSlug: 'gallery-qa',
        user: { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'admin' },
        permissions: ['website.manage', 'settings.view'], modules: ['website'],
      }, version: 0 }));
      localStorage.setItem('app-language', 'en');
      localStorage.setItem('app-institution', JSON.stringify({ type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] }));
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    await page.route('**/api/**', route => {
      const url = route.request().url();
      if (url.includes('/website/admin/reset')) {
        const body = route.request().postDataJSON();
        resets.push(body);
        if (body.password === 'correct-password') return route.fulfill({ json: { message: 'Website reset to the main demo' } });
        return route.fulfill({ status: 400, json: { message: 'Incorrect password.' } });
      }
      if (url.includes('/website/admin/settings')) return route.fulfill({ json: { data: {
        madrasa: { id: 42, name: 'Al Noor Academy', slug: 'gallery-qa' },
        settings: { theme_key: 'modern' }, pages: [], notices: [], gallery: [], slides: [], committee: [], videos: [],
      } } });
      if (url.includes('/auth/me')) return route.fulfill({ json: {
        id: 7, madrasa_id: 42, name: 'QA Admin', role: 'admin',
        permissions: ['website.manage', 'settings.view'], modules: ['website'],
        institution: { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] },
      } });
      if (url.includes('/sidebar')) return route.fulfill({ json: [] });
      if (url.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_name: 'QA', plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: { students: 0, users: 1 } } } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });
    await page.goto('http://127.0.0.1:5196/settings/website');
    await page.getByRole('heading', { name: 'Restore main demo', exact: true }).waitFor();
    const menu = page.locator('aside.settings-sidebar nav button');
    for (let index = 1; index < await menu.count(); index++) {
      await menu.nth(index).click();
      assert.equal(await page.getByRole('heading', { name: 'Restore main demo', exact: true }).count(), 0, `tab ${index}`);
    }
    await page.goto('http://127.0.0.1:5196/settings/website?tab=general');
    await page.getByRole('heading', { name: 'Restore main demo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset website', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, next step', exact: true }).click();
    await page.getByRole('button', { name: 'I understand, continue', exact: true }).click();
    const confirm = page.getByRole('button', { name: 'Confirm, reset website', exact: true });
    assert.equal(await confirm.isDisabled(), true);
    assert.deepEqual(resets, []);
    await page.getByLabel('Your current login password').fill('wrong-password');
    await confirm.click();
    await page.getByRole('alert').filter({ hasText: 'Incorrect password.' }).waitFor();
    assert.deepEqual(resets, [{ password: 'wrong-password' }]);
    assert.equal(await page.getByLabel('Your current login password').isVisible(), true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Reset website', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, next step', exact: true }).click();
    await page.getByRole('button', { name: 'I understand, continue', exact: true }).click();
    assert.equal(await page.getByLabel('Your current login password').inputValue(), '');
    await page.getByLabel('Your current login password').fill('correct-password');
    await Promise.all([
      page.waitForEvent('framenavigated', frame => frame === page.mainFrame()),
      page.getByRole('button', { name: 'Confirm, reset website', exact: true }).click(),
    ]);
    const successMessage = 'Website successfully restored to the main demo. The latest demo design and content have been applied.';
    await page.getByText(successMessage, { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('website-reset-success:42')), null);
    await page.reload();
    await page.getByRole('heading', { name: 'Restore main demo', exact: true }).waitFor();
    assert.equal(await page.getByText(successMessage, { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: reset only in General; password required; wrong password stays open; cancellation clears password; success toast survives reset reload and appears only once.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
