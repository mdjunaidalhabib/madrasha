const { chromium } = require('../backend/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  let donation = {
    published: true, title: 'শিক্ষার আলো ছড়িয়ে দিতে পাশে থাকুন',
    description: 'আপনার অনুদান শিক্ষার্থীদের পড়াশোনা ও প্রতিষ্ঠানের উন্নয়নে সহায়তা করবে।',
    instructions: 'অনুদান পাঠিয়ে প্রাপ্তি নিশ্চিত করতে অফিসে যোগাযোগ করুন।',
    contactPhone: '01700000000', checkoutUrl: 'https://example.org/donate',
    methods: [
      { type: 'bkash', accountName: 'নমুনা প্রতিষ্ঠান', accountNumber: '01700000000', details: 'মার্চেন্ট অ্যাকাউন্ট' },
      { type: 'bank', accountName: 'নমুনা প্রতিষ্ঠান', accountNumber: '123456789012', details: 'নমুনা ব্যাংক, ঢাকা শাখা' },
    ],
  };
  await page.route('**/website/public/donation-qa', route => route.fulfill({ json: { data: {
    madrasa: { id: 1, name: 'নমুনা মাদ্রাসা', slug: 'donation-qa', website_status: 'active', phone: '01700000000' },
    settings: { theme_color: '#0f766e', theme_key: 'modern', hero_title: 'জ্ঞানের পথে একসঙ্গে',
      show_about: 0, show_gallery: 0, show_video_gallery: 0, show_teachers: 0,
      show_admission: 0, show_notices: 0, show_contact: 1, show_slider: 0, show_notice_bar: 0 },
    pages: [], teachers: [], gallery: [], slides: [], notices: [], committee: [], videos: [], donation,
  } } }));
  await page.goto('http://127.0.0.1:5188/m/donation-qa');
  await page.locator('#donation').waitFor();
  await page.locator('header nav a[href="#donation"]').click();
  await page.locator('#donation button').first().click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '01700000000');
  assert.equal(await page.locator('#donation a[target="_blank"]').getAttribute('rel'), 'noopener noreferrer');
  await page.locator('#donation').screenshot({ path: 'artifacts/donation-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#donation').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile horizontal overflow');
  await page.locator('#donation').screenshot({ path: 'artifacts/donation-mobile.png' });
  donation = null;
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/website/public/donation-qa')),
    page.reload(),
  ]);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#donation').count(), 0);
  assert.equal(await page.locator('a[href="#donation"]').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Desktop/mobile donation rendering, navigation, account copy, external link safety, and hidden-state checks passed.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
