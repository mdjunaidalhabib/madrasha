const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('../backend/node_modules/playwright');
require('../backend/node_modules/ts-node').register({ transpileOnly: true, project: path.resolve(__dirname, '../backend/tsconfig.json') });
const { DEFAULT_WEBSITE_TEMPLATE } = require('../backend/src/modules/public-website/website-template.schema.ts');
const { toWebsiteSettingsApiDto } = require('../backend/src/modules/public-website/website.mapper.ts');

const themes = ['modern', 'heritage', 'campus', 'editorial'];
const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
const settings = toWebsiteSettingsApiDto(DEFAULT_WEBSITE_TEMPLATE.settings);
const content = {
  madrasa: { id: 42, name: 'Al Noor Academy', slug: 'theme-qa', address: 'Dhaka, Bangladesh', phone: '01700000000', institution },
  settings,
  pages: DEFAULT_WEBSITE_TEMPLATE.pages.map(p => ({ ...p, page_key: p.pageKey })),
  slides: DEFAULT_WEBSITE_TEMPLATE.slides.map((s, id) => ({ id, image_url: s.imageUrl, button_link: '/admission' })),
  gallery: DEFAULT_WEBSITE_TEMPLATE.gallery.map((s, id) => ({ id, image_url: s.imageUrl, caption: s.caption })),
  notices: [{ id: 1, title: 'Admissions are open', content: 'Visit the office for admission information.', published_at: '2026-11-16' }],
  teachers: Array.from({ length: 9 }, (_, id) => ({ id, name: `Teacher ${id + 1}`, designation: 'Senior teacher' })),
  committee: [], videos: [],
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const errors = [];
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
    let currentTheme = 'modern';
    await page.route('**/api/**', route => route.fulfill({ json: { data: { ...content, settings: { ...settings, theme_key: currentTheme } } } }));
    const signatures = {};
    for (const theme of process.env.THEMES_SKIP_PUBLIC ? [] : themes) {
      currentTheme = theme;
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('http://127.0.0.1:5193/m/theme-qa');
        await page.locator(`[data-website-theme="${theme}"]`).waitFor().catch(async error => { console.error(await page.locator('body').innerText(), errors); throw error; });
        await page.locator('.public-website-main #about h2').waitFor();
        await page.waitForFunction(() => [...document.images].filter(img => img.getAttribute('loading') !== 'lazy').every(img => img.complete));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme} overflows at ${width}`);
        const hero = page.locator('.public-website-hero');
        const box = await hero.boundingBox();
        assert.ok(Math.abs(box.width / box.height - 21 / 9) < 0.15, `${theme} preserves uploaded slide proportions`);
        assert.equal(await page.locator('#teachers .public-website-card-row > div').count(), 9);
        if (['heritage', 'campus', 'editorial'].includes(theme)) await page.waitForTimeout(800);
        if (width === 1440 && ['heritage', 'campus', 'editorial'].includes(theme)) {
          signatures[theme] = await hero.evaluate(el => getComputedStyle(el).borderRadius);
          await page.screenshot({ path: path.resolve(__dirname, `website-theme-${theme}-desktop.png`) });
        }
        if (width === 390 && ['heritage', 'campus', 'editorial'].includes(theme)) {
          await page.screenshot({ path: path.resolve(__dirname, `website-theme-${theme}-mobile.png`) });
        }
        await page.goto('http://127.0.0.1:5193/m/theme-qa/contact');
        await page.locator(`[data-website-theme="${theme}"]`).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme} contact overflows at ${width}`);
      }
    }
    if (!process.env.THEMES_SKIP_PUBLIC) assert.equal(new Set(Object.values(signatures)).size, 3, 'New hero designs should differ');
    currentTheme = 'unknown';
    await page.goto('http://127.0.0.1:5193/m/theme-qa');
    await page.locator('[data-website-theme="modern"]').waitFor();

    const superPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    superPage.on('pageerror', e => errors.push(e.message));
    await superPage.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    await superPage.addInitScript(() => { localStorage.setItem('admin_token', 'qa-token'); localStorage.setItem('app-language', 'en'); });
    let savedTheme = 'modern';
    let template = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
    let failSave = false;
    let writes = 0;
    await superPage.route('**/api/**', async route => {
      const req = route.request();
      const url = req.url();
      if (url.includes('/super/madrasas/42/theme')) {
        if (req.method() === 'PATCH') {
          if (failSave) return route.fulfill({ status: 500, json: { message: 'QA save failed' } });
          savedTheme = req.postDataJSON().theme_key;
          writes++;
        }
        return route.fulfill({ json: { theme_key: savedTheme } });
      }
      if (url.includes('/website/super/default-template')) {
        if (req.method() === 'PUT') template = req.postDataJSON();
        return route.fulfill({ json: { data: { content: template, updatedAt: null } } });
      }
      if (/\/madrasas(?:\?|$)/.test(url)) return route.fulfill({ json: { data: [{ id: 42, name: 'Al Noor Academy', slug: 'theme-qa', website_status: 'active' }], total: 1 } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });
    await superPage.goto('http://127.0.0.1:5195/websites');
    await superPage.getByRole('navigation', { name: /টেমপ্লেট সেকশন|Template sections/ }).getByRole('button', { name: /থিম ও হিরো ব্যানার|Theme & hero banner/ }).click();
    await superPage.getByRole('button', { name: /^(ঐতিহ্য|Heritage)$/ }).click();
    await superPage.getByRole('button', { name: /পরিবর্তন সংরক্ষণ|Save changes/ }).click();
    await superPage.getByRole('status').filter({ hasText: /ডেমো সংরক্ষিত|Demo saved/ }).waitFor();
    assert.equal(template.settings.themeKey, 'heritage');
    await superPage.getByRole('button', { name: /প্রতিষ্ঠানের থিম ও স্ট্যাটাস|Institution theme & status/ }).click();
    const picker = superPage.getByRole('group', { name: /ওয়েবসাইট থিম|Website theme/, exact: true });
    await picker.getByRole('button', { name: /ক্যাম্পাস|Campus/ }).click();
    await superPage.getByText(/^(ওয়েবসাইট থিম পরিবর্তন হয়েছে।|Website theme updated\.)$/).waitFor();
    assert.equal(savedTheme, 'campus');
    await superPage.reload();
    await superPage.getByRole('button', { name: /প্রতিষ্ঠানের থিম ও স্ট্যাটাস|Institution theme & status/ }).click();
    await picker.getByRole('button', { name: /ক্যাম্পাস|Campus/ }).waitFor();
    await superPage.waitForFunction(() => document.querySelector('[role="group"] button[aria-pressed="true"]')?.textContent.match(/ক্যাম্পাস|Campus/));
    failSave = true;
    await picker.getByRole('button', { name: /সম্পাদকীয়|Editorial/ }).click();
    await superPage.getByRole('alert').filter({ hasText: 'QA save failed' }).waitFor();
    assert.equal(await picker.getByRole('button', { name: /ক্যাম্পাস|Campus/ }).getAttribute('aria-pressed'), 'true');
    failSave = false;
    await picker.getByRole('button', { name: /সম্পাদকীয়|Editorial/ }).click();
    await superPage.getByText(/^(ওয়েবসাইট থিম পরিবর্তন হয়েছে।|Website theme updated\.)$/).waitFor();
    assert.equal(savedTheme, 'editorial');
    for (const width of [390, 1440]) {
      await superPage.setViewportSize({ width, height: 1000 });
      assert.equal(await superPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Super admin overflows at ${width}`);
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ publicThemes: themes.length, viewports: [390, 1440], contact: 'passed', unknownThemeFallback: 'passed', templateSave: 'passed', superAdminSaveReloadAndFailureRecovery: 'passed', writes, pageErrors: errors }));
  } finally { await browser.close(); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
