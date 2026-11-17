const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/api/**', route => {
      const match = new URL(route.request().url()).pathname.match(/\/website\/public\/([^/]+)$/);
      if (!match) return route.fulfill({ json: { data: {} } });
      const slug = match[1];
      const name = slug === 'academy' ? 'আহমদিয়া একাডেমি' : 'North School';
      return route.fulfill({ json: { data: {
        madrasa: { id: 1, slug, name, logo_url: null, institution: { type: 'SCHOOL', default_language: 'en', languages: ['bn', 'en'] } },
        settings: { theme_key: 'modern' }, pages: [], notices: [], gallery: [], slides: [], committee: [], teachers: [], videos: [],
      } } });
    });
    for (const path of ['/m/academy', '/academy/contact', '/academy/admission']) {
      await page.goto('http://127.0.0.1:5193' + path);
      await page.waitForFunction(() => document.title === 'আহমদিয়া একাডেমি');
      assert.equal(await page.title(), 'আহমদিয়া একাডেমি');
    }
    await page.evaluate(async () => { const { router } = await import('/src/app/router.tsx'); await router.navigate('/school'); });
    await page.waitForFunction(() => document.title === 'North School');
    await page.evaluate(async () => { const { router } = await import('/src/app/router.tsx'); await router.navigate('/'); });
    await page.waitForFunction(() => document.title.startsWith('EMS'));
    console.log('Institution titles passed on home, contact and admission without a logo; tenant switching and platform title restoration passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
