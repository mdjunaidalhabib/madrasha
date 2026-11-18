const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
    const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
    let settings = {
      theme_key: 'modern', map_url: 'https://maps.app.goo.gl/saved-campus',
      facebook_url: 'https://facebook.com/legacy',
      social_links: [
        { platform: 'telegram', label: 'Campus updates', url: 'https://t.me/campus-news' },
        { platform: 'facebook', label: 'Official page', url: 'https://facebook.com/new-campus' },
        { platform: 'other', label: 'Community', url: 'https://community.example.com' },
        { platform: 'whatsapp', label: 'Office WhatsApp', url: 'https://wa.me/8801800000000' },
      ],
    };
    await page.route('**/api/**', route => route.fulfill({ json: { data: {
      madrasa: {
        name: 'QA School', slug: 'contacts-qa', address: 'Dhaka, Bangladesh', institution,
        phones: ['01700000000'], emails: ['office@example.com'],
        social_links: [{ platform: 'youtube', label: 'Old branding', url: 'https://youtube.com/@old' }],
      },
      settings, pages: [], notices: [], gallery: [], teachers: [], slides: [], committee: [], videos: [],
    } } }));
    for (const theme of ['modern', 'heritage', 'campus', 'editorial']) {
      settings.theme_key = theme;
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('http://127.0.0.1:5197/m/contacts-qa/contact');
        const footer = page.locator('footer');
        await footer.getByRole('link', { name: 'Campus updates', exact: true }).waitFor();
        const expected = ['https://t.me/campus-news', 'https://facebook.com/new-campus', 'https://community.example.com/', 'https://wa.me/8801800000000'];
        for (const region of [page.locator('main'), footer]) {
          assert.deepEqual(await region.locator('a[aria-label]').evaluateAll(links => links.filter(link => ['Campus updates', 'Official page', 'Community', 'Office WhatsApp'].includes(link.getAttribute('aria-label'))).map(link => link.getAttribute('href'))), expected);
          assert.ok(await region.locator('a[href="https://maps.app.goo.gl/saved-campus"]').count() > 0);
          assert.ok(await region.locator('a[href="https://wa.me/8801800000000"]').count() > 0);
        }
        assert.equal(await page.locator('a[href="https://youtube.com/@old"]').count(), 0);
        assert.equal(await page.locator('a[href="https://facebook.com/legacy"]').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
    }
    settings.social_links = [];
    settings.map_url = '';
    await page.reload();
    await page.locator('footer').waitFor();
    for (const region of [page.locator('main'), page.locator('footer')]) {
      assert.equal(await region.getByRole('link', { name: 'Campus updates', exact: true }).count(), 0);
      assert.equal(await region.getByRole('link', { name: 'Old branding', exact: true }).count(), 0);
      assert.equal(await region.getByRole('link', { name: 'Facebook', exact: true }).count(), 0);
      assert.ok(await region.locator('a[href*="google.com/maps/search"]').count() > 0);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: saved socials, order, custom labels, WhatsApp and map used in contact/footer across 4 themes and mobile/desktop; old socials excluded; clearing links and address map fallback verified.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
