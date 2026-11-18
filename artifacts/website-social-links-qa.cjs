const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const user = { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'admin' };
    const permissions = ['website.manage', 'settings.view'];
    const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
    await page.addInitScript(({ user, permissions, institution }) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'social-qa', user, permissions, modules: ['website'] }, version: 0 }));
      localStorage.setItem('app-language', 'en');
      localStorage.setItem('app-institution', JSON.stringify(institution));
    }, { user, permissions, institution });
    let settings = { theme_key: 'modern', facebook_url: 'https://facebook.com/school', youtube_url: 'https://youtube.com/@school' };
    let failSave = false;
    let saves = 0;
    await page.route('**/api/**', route => {
      const url = route.request().url();
      if (url.includes('/website/admin/settings')) {
        if (route.request().method() === 'PUT') {
          saves++;
          if (failSave) return route.fulfill({ status: 500, json: { message: 'Test save failure' } });
          settings = route.request().postDataJSON();
          return route.fulfill({ json: { data: settings } });
        }
        return route.fulfill({ json: { data: { madrasa: { id: 42, name: 'Al Noor Academy', slug: 'social-qa' }, settings, pages: [], notices: [], gallery: [], slides: [], committee: [], videos: [] } } });
      }
      if (url.includes('/sidebar')) return route.fulfill({ json: [] });
      if (url.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions, modules: ['website'], institution } });
      if (url.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_name: 'QA', plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: { students: 0, users: 1 } } } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });
    const open = async width => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:5195/settings/website');
      const sidebar = page.locator('aside.settings-sidebar');
      await sidebar.waitFor();
      if (width < 1024) await sidebar.locator('button[aria-controls]').click();
      await sidebar.getByRole('button', { name: /Social/ }).click();
      await page.getByRole('button', { name: 'Add platform', exact: true }).waitFor();
    };
    await open(1440);
    assert.equal(await page.getByRole('combobox', { name: 'Platform', exact: true }).count(), 2);
    await page.getByRole('button', { name: 'Delete Facebook', exact: true }).click();
    await page.getByRole('button', { name: 'Add platform', exact: true }).click();
    const selects = page.getByRole('combobox', { name: 'Platform', exact: true });
    await selects.last().selectOption('telegram');
    await page.getByRole('textbox', { name: 'Telegram link', exact: true }).fill('t.me/school');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[aria-label="Telegram link"]')?.value === 'https://t.me/school');
    assert.equal(settings.facebook_url, '');
    assert.equal(settings.social_links[1].platform, 'telegram');
    await open(390);
    assert.equal(await selects.count(), 2);
    await selects.last().selectOption('other');
    await page.getByRole('textbox', { name: 'Other link', exact: true }).fill('javascript:alert(1)');
    const before = saves;
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(saves, before);
    await page.getByRole('textbox', { name: 'Other link', exact: true }).fill('https://example.com/community');
    failSave = true;
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Could not save. Please try again.' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Other link', exact: true }).inputValue(), 'https://example.com/community');
    failSave = false;
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Save' && button.disabled));
    for (const width of [360, 390, 768, 1440]) {
      await open(width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await selects.count(), 2);
      await page.screenshot({ path: `artifacts/website-social-links-${width}.png`, animations: 'disabled' });
    }
    await page.getByRole('button', { name: 'Delete YouTube', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Other', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await selects.count(), 2);
    await page.getByRole('button', { name: 'Delete YouTube', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Other', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('button') && [...document.querySelectorAll('button')].some(button => button.textContent === 'Save' && button.disabled));
    assert.deepEqual(settings.social_links, []);
    await open(390);
    assert.equal(await selects.count(), 0);
    assert.deepEqual(errors, []);
    const publicPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
    publicPage.on('pageerror', error => errors.push(error.message));
    let publicSettings = {
      theme_key: 'modern', facebook_url: 'https://facebook.com/legacy',
      social_links: [
        { platform: 'telegram', url: 'https://t.me/school' },
        { platform: 'tiktok', url: 'https://tiktok.com/@school' },
        { platform: 'x', url: 'https://x.com/school' },
        { platform: 'linkedin', url: 'https://linkedin.com/company/school' },
        { platform: 'discord', url: 'https://discord.gg/school' },
        { platform: 'other', label: 'Community', url: 'https://example.com/community' },
        { platform: 'other', label: 'Unsafe', url: 'javascript:alert(1)' },
      ],
    };
    await publicPage.route('**/api/**', route => route.fulfill({ json: { data: {
      madrasa: { name: 'Al Noor Academy', slug: 'social-qa', institution },
      settings: publicSettings, pages: [], notices: [], gallery: [], teachers: [], slides: [], committee: [], videos: [],
    } } }));
    await publicPage.goto('http://127.0.0.1:5197/m/social-qa/contact');
    const publicFooter = publicPage.locator('footer');
    await publicFooter.getByRole('link', { name: 'Telegram', exact: true }).waitFor();
    for (const name of ['Telegram', 'TikTok', 'X', 'LinkedIn', 'Discord', 'Community']) {
      const link = publicFooter.getByRole('link', { name, exact: true });
      assert.equal(await link.count(), 1);
      assert.equal(await link.locator('svg').count(), 1);
    }
    assert.equal(await publicFooter.getByRole('link', { name: 'Facebook', exact: true }).count(), 0);
    assert.equal(await publicPage.getByRole('link', { name: 'Unsafe', exact: true }).count(), 0);
    assert.equal(await publicPage.getByRole('link', { name: 'Community', exact: true }).count(), 2);
    publicSettings.social_links = [];
    await publicPage.reload();
    await publicFooter.waitFor();
    assert.equal(await publicFooter.getByRole('link', { name: 'Telegram', exact: true }).count(), 0);
    assert.equal(await publicFooter.getByRole('link', { name: 'Facebook', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: legacy migration, platform selection, add/delete/save/reload, invalid URLs, failed save retry, cancel, delete final link, and responsive layouts at 360/390/768/1440px.');
    console.log('PASS: public contact/footer brand icons, custom platform label, unsafe link filtering, and no legacy fallback for an empty list.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
