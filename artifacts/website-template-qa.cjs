const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('../backend/node_modules/playwright');
require('../backend/node_modules/ts-node').register({ transpileOnly: true, project: path.resolve(__dirname, '../backend/tsconfig.json') });
const { DEFAULT_WEBSITE_TEMPLATE } = require('../backend/src/modules/public-website/website-template.schema.ts');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1550, height: 1050 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('admin_token', 'website-template-ui-test'));
  let template = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
  let saves = 0;
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/website/super/default-template/image')) {
      assert.match(route.request().postDataJSON().image, /^data:image\/png;base64,/);
      return route.fulfill({ json: { data: { url: '/images/website-demo-books.svg' } } });
    }
    if (url.includes('/website/super/default-template')) {
      if (route.request().method() === 'PUT') { template = route.request().postDataJSON(); saves++; }
      return route.fulfill({ json: { data: { content: template, updatedAt: saves ? new Date().toISOString() : null } } });
    }
    return route.fulfill({ json: { data: [], total: 0 } });
  });
  await page.goto('http://127.0.0.1:5195/websites');
  await page.getByRole('heading', { name: /প্রতিটি নতুন শুরু|A beautiful start/ }).waitFor();
  assert.equal(await page.locator('img').evaluateAll((imgs) => imgs.filter((img) => !img.complete || img.naturalWidth === 0).length), 0, 'Demo images should load');
  await page.screenshot({ path: path.resolve(__dirname, 'website-template-desktop.png'), fullPage: true });
  const title = page.getByRole('textbox', { name: /মূল শিরোনাম|Hero headline/ });
  await title.fill('Professional demo headline');
  await page.getByRole('button', { name: /পরিবর্তন সংরক্ষণ|Save changes/ }).click();
  await page.getByRole('status').filter({ hasText: /ডেমো সংরক্ষিত|Demo saved/ }).waitFor();
  assert.equal(saves, 1);
  assert.equal(template.settings.heroTitle, 'Professional demo headline');
  for (const label of [/ওয়েবসাইটের পেজ|Website pages/, /হোম স্লাইডার|Home slider/, /নোটিশ বোর্ড|Notice board/, /ফটো গ্যালারি|Photo gallery/, /প্রধান ও সভাপতির বাণী|Leadership messages/, /পরিচালনা পরিষদ|Committee/, /ভিডিও গ্যালারি|Video gallery/, /সেকশন ও প্রকাশনা|Sections & publishing/]) {
    await page.getByRole('navigation', { name: /টেমপ্লেট সেকশন|Template sections/ }).getByRole('button', { name: label }).click();
    assert.equal(await page.locator('fieldset').isVisible(), true);
  }
  await page.getByRole('navigation', { name: /টেমপ্লেট সেকশন|Template sections/ }).getByRole('button', { name: /হোম স্লাইডার|Home slider/ }).click();
  const png = await require('../backend/node_modules/sharp')({ create: { width: 4, height: 4, channels: 3, background: '#0f766e' } }).png().toBuffer();
  await page.locator('input[type=file]').setInputFiles({ name: 'demo.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('textbox', { name: /স্লাইডের ছবি|Slide image/ }).filter({ visible: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === '/images/website-demo-books.svg'));
  await page.getByRole('navigation', { name: /টেমপ্লেট সেকশন|Template sections/ }).getByRole('button', { name: /সেকশন ও প্রকাশনা|Sections & publishing/ }).click();
  await page.getByRole('switch', { name: /অটো সেটআপ|Automatic setup/, exact: true }).click();
  await page.getByRole('button', { name: /পরিবর্তন সংরক্ষণ|Save changes/ }).click();
  await page.getByRole('status').filter({ hasText: /ডেমো সংরক্ষিত|Demo saved/ }).waitFor();
  assert.equal(template.enabled, false);
  await page.getByRole('navigation', { name: /টেমপ্লেট সেকশন|Template sections/ }).getByRole('button', { name: /ভিডিও গ্যালারি|Video gallery/ }).click();
  await page.getByRole('button', { name: /নতুন যোগ করুন|Add item/ }).click();
  await page.getByRole('textbox', { name: /ভিডিওর শিরোনাম|Video title/ }).fill('Demo film');
  await page.getByRole('textbox', { name: /ভিডিও লিংক|Video URL/ }).fill('https://example.com/demo.mp4');
  await page.getByRole('button', { name: /পরিবর্তন সংরক্ষণ|Save changes/ }).click();
  await page.getByRole('status').filter({ hasText: /ডেমো সংরক্ষিত|Demo saved/ }).waitFor();
  assert.equal(template.videos.length, 1);
  await page.getByRole('button', { name: /মুছে ফেলুন|Remove item/ }).click();
  await page.getByRole('button', { name: /পরিবর্তন সংরক্ষণ|Save changes/ }).click();
  await page.getByRole('status').filter({ hasText: /ডেমো সংরক্ষিত|Demo saved/ }).waitFor();
  assert.equal(template.videos.length, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('navigation', { name: /টেমপ্লেট সেকশন|Template sections/ }).getByRole('button', { name: /ডিজাইন ও পরিচিতি|Design & identity/ }).click();
  await page.screenshot({ path: path.resolve(__dirname, 'website-template-mobile.png'), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, 'Mobile viewport should not overflow horizontally');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ desktop: 'passed', mobile: 'passed', tabs: 9, saves, addRemove: 'passed', imageUpload: 'passed with mocked storage', pageErrors: errors }));
  await browser.close();
}
run().catch((error) => { console.error(error); process.exit(1); });
