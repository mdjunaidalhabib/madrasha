const { chromium } = require('../backend/node_modules/playwright');
const assert = require('node:assert/strict');
const { DEFAULT_WEBSITE_TEMPLATE } = require('../backend/dist/modules/public-website/website-template.schema');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('admin_token', 'qa-mocked-token'));
  let template = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
  template.donation.isPublished = 1;
  let saved = null;
  let releaseUpload;
  const uploadGate = new Promise(resolve => { releaseUpload = resolve; });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = { data: {} };
    if (path.endsWith('/website/super/default-template')) {
      if (route.request().method() === 'PUT') { saved = route.request().postDataJSON(); template = saved; }
      json = { data: { content: template, updatedAt: null } };
    } else if (path.endsWith('/website/super/default-template/image')) {
      await uploadGate;
      json = { data: { url: 'https://example.org/qa-upload.png' } };
    } else if (path.endsWith('/super/madrasas')) json = { data: [] };
    await route.fulfill({ json });
  });
  await page.goto('http://127.0.0.1:5189/websites');
  const save = page.getByRole('button', { name: /পরিবর্তন সংরক্ষণ|Save changes/ });
  const apply = page.getByRole('button', { name: /^(প্রয়োগ করুন|Apply)$/ });
  await page.getByRole('button', { name: /অনুদান \(ডেমো\)|Donations \(demo\)/ }).click();
  const editTitle = page.getByRole('button', { name: /অনুদানের শিরোনাম সম্পাদনা|Edit Donation title/ });
  await editTitle.click();
  await page.getByLabel(/অনুদানের শিরোনাম|Donation title/).fill('');
  await apply.click();
  await page.getByRole('alert').filter({ hasText: /আবশ্যক|required/ }).waitFor();
  assert.ok(await save.isDisabled(), 'Global save must wait for a field edit');
  await page.getByRole('button', { name: /^(বাতিল|Cancel)$/ }).click();
  assert.ok(await save.isDisabled(), 'Cancel must preserve the saved template');
  await editTitle.click();
  await page.getByLabel(/অনুদানের শিরোনাম|Donation title/).fill('Pencil edited donation demo');
  await apply.click();
  const donationPublish = page.getByRole('switch', { name: /ডেমো প্রিভিউতে অনুদান প্রকাশ|Publish donations in demo preview/ });
  await donationPublish.click();
  assert.equal(await page.locator('[data-donation-demo-preview]').count(), 0);
  await save.click();
  await page.getByRole('status').filter({ hasText: /সংরক্ষ|saved/ }).waitFor();
  assert.equal(saved.donation.title, 'Pencil edited donation demo');
  assert.equal(saved.donation.isPublished, 0);
  await page.reload();
  await page.getByRole('button', { name: /অনুদান \(ডেমো\)|Donations \(demo\)/ }).click();
  assert.equal(await donationPublish.getAttribute('aria-checked'), 'false');
  await page.getByText('Pencil edited donation demo', { exact: true }).waitFor();
  assert.equal(await page.getByRole('switch', { name: /^(ওয়েবসাইট প্রকাশ|Publish website)$/ }).count(), 0);
  await page.screenshot({ path: 'artifacts/super-donation-inline.png' });

  await page.getByRole('button').filter({ has: page.getByText(/^(নোটিশ|Notices)$/) }).click();
  const sectionPublish = page.getByRole('switch', { name: /নোটিশ প্রকাশ করুন|Notices publication/ });
  await sectionPublish.click();
  await page.getByRole('switch', { name: /^(প্রকাশ করুন|Publish item)$/ }).first().click();
  await save.click();
  await page.getByRole('status').filter({ hasText: /সংরক্ষ|saved/ }).waitFor();
  assert.equal(saved.settings.showNotices, 0);
  assert.equal(saved.notices[0].isPublished, 0);
  assert.equal(saved.settings.isPublished, DEFAULT_WEBSITE_TEMPLATE.settings.isPublished);

  await page.getByRole('button').filter({ has: page.getByText(/^(গ্যালারি|Gallery)$/) }).click();
  await page.getByRole('button', { name: /ছবি সম্পাদনা|Edit Image/ }).first().click();
  await page.locator('input[type=file]').setInputFiles({ name: 'qa.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => /^(প্রয়োগ করুন|Apply)$/.test(button.textContent.trim()) && button.disabled));
  releaseUpload();
  await page.getByLabel(/^(ছবি|Image)\s*\*?$/).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'https://example.org/qa-upload.png'));
  await apply.click();
  await save.click();
  await page.getByRole('status').filter({ hasText: /সংরক্ষ|saved/ }).waitFor();
  assert.equal(saved.gallery[0].imageUrl, 'https://example.org/qa-upload.png');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('Super admin pencil apply/cancel/validation, publication toggles, save/reload, upload guard and mobile checks passed.');
})().catch(error => { console.error(error); process.exit(1); });
