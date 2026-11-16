const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('../backend/node_modules/playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const user = { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'admin' };
    const permissions = ['website.manage', 'settings.view'];
    const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
    await page.addInitScript(({ user, permissions, institution }) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'theme-qa', user, permissions, modules: ['website'] }, version: 0 }));
      localStorage.setItem('app-language', 'en');
      localStorage.setItem('app-institution', JSON.stringify(institution));
    }, { user, permissions, institution });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    let settings = { theme_key: 'modern', theme_color: '#0f766e', hero_title: 'Keep this title', muhtamim_message: 'Keep this message', show_gallery: 1 };
    let failSave = false;
    const writes = [];
    await page.route('**/api/**', route => {
      const req = route.request();
      const url = req.url();
      if (url.includes('/sidebar')) return route.fulfill({ json: [] });
      if (url.includes('/website/admin/settings')) {
        if (req.method() === 'PUT') {
          if (failSave) return route.fulfill({ status: 500, json: { message: 'QA failure' } });
          settings = req.postDataJSON(); writes.push(settings.theme_key);
          return route.fulfill({ json: { data: settings } });
        }
        return route.fulfill({ json: { data: { madrasa: { id: 42, name: 'Al Noor Academy', slug: 'theme-qa' }, settings, pages: [], notices: [], gallery: [], slides: [], committee: [], videos: [] } } });
      }
      if (url.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions, modules: ['website'], institution } });
      if (url.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_name: 'QA', plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: { students: 0, users: 1 } } } });
      if (url.includes('/settings/section-toggles')) return route.fulfill({ json: { data: {} } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });
    const open = async () => {
      await page.goto('http://127.0.0.1:5194/settings/website');
      await page.getByRole('button', { name: /Theme & hero banner/ }).click().catch(async error => { console.error(await page.locator('body').innerText(), errors); throw error; });
      await page.getByRole('radiogroup', { name: 'Website theme' }).waitFor();
    };
    await open();
    for (const theme of ['heritage', 'campus', 'editorial']) {
      await page.locator(`input[name="website_theme_key"][value="${theme}"]`).check({ force: true });
      await page.waitForFunction(theme => document.querySelector(`input[value="${theme}"]`)?.checked && !document.querySelector(`input[value="${theme}"]`)?.disabled, theme);
      assert.equal(settings.theme_key, theme);
      assert.equal(settings.hero_title, 'Keep this title');
      assert.equal(settings.muhtamim_message, 'Keep this message');
    }
    await open();
    assert.equal(await page.locator('input[value="editorial"]').isChecked(), true);
    failSave = true;
    await page.locator('input[value="heritage"]').check({ force: true });
    await page.waitForFunction(() => document.querySelector('input[value="editorial"]')?.checked && !document.querySelector('input[value="editorial"]')?.disabled);
    assert.equal(settings.theme_key, 'editorial');
    failSave = false;
    await page.locator('input[value="heritage"]').check({ force: true });
    await page.waitForFunction(() => document.querySelector('input[value="heritage"]')?.checked && !document.querySelector('input[value="heritage"]')?.disabled);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Admin overflows at ${width}`);
      await page.screenshot({ path: path.resolve(__dirname, `website-theme-admin-${width}.png`) });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ adminSave: writes, reload: 'passed', failureRecovery: 'passed', contentPreserved: 'passed', viewports: [390, 1440], pageErrors: errors }));
  } finally { await browser.close(); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
