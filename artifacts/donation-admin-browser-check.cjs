const { chromium } = require('../backend/node_modules/playwright');
const assert = require('node:assert/strict');
const { DEFAULT_WEBSITE_TEMPLATE } = require('../backend/dist/modules/public-website/website-template.schema');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  admin.on('pageerror', error => errors.push(error.message));
  await admin.addInitScript(() => localStorage.setItem('auth-storage', JSON.stringify({ state: {
    token: 'qa-mocked-token', madrasaSlug: 'donation-qa', user: { id: 42, name: 'QA', role: 'MUHTAMIM' },
    permissions: ['website.manage'], modules: ['website', 'settings'],
  }, version: 0 })));
  let allowed = true;
  let saved = null;
  let config = { published: true, title: 'Existing donation', description: '', instructions: '', contactPhone: '', checkoutUrl: '',
    methods: [{ type: 'bkash', accountName: 'QA institution', accountNumber: '01700000000', details: 'Merchant' }] };
  await admin.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = { data: {} };
    if (path.endsWith('/auth/me')) json = { id: 42, name: 'QA', role_key: 'MUHTAMIM', role_label: 'Head', permissions: ['website.manage'], modules: ['website', 'settings'] };
    else if (path.endsWith('/sidebar')) json = [{ key: 'settings', label: 'সেটিংস', group: 'core', disabled: false, children: [{ key: 'website', label: 'ওয়েবসাইট সেটিংস', disabled: false }] }];
    else if (path.endsWith('/website/admin/settings')) json = { data: { madrasa: { name: 'QA institution' }, settings: {}, pages: [], notices: [], gallery: [], slides: [], videos: [], committee: [] } };
    else if (path.endsWith('/settings/plan')) json = { data: { plan_status: 'active', has_active_subscription: true, plan_name: 'QA', days_remaining: 100, usage: { students: 1, users: 1 }, student_limit: 100, user_limit: 5 } };
    else if (path.endsWith('/settings/branding')) json = { data: { name: 'QA institution', branding_phones: [], branding_emails: [] } };
    else if (path.endsWith('/website/admin/donations/demo')) json = { data: { ...config, ...DEFAULT_WEBSITE_TEMPLATE.donation, title: 'Latest super admin demo', published: false, methods: [] } };
    else if (path.endsWith('/website/admin/donations')) {
      if (route.request().method() === 'PUT') { saved = route.request().postDataJSON(); config = saved; json = { data: saved }; }
      else json = { data: { allowed, config } };
    }
    await route.fulfill({ json });
  });
  await admin.goto('http://127.0.0.1:5187/donations');
  await admin.getByRole('button', { name: /ডেমোর লেখা বসান|Load demo text/ }).waitFor();
  assert.ok(admin.url().includes('/settings/website?tab=donations'), 'Legacy donation URL should redirect into website settings');
  assert.equal(await admin.locator('a[href="/donations"]').count(), 0, 'Standalone sidebar menu must be removed');
  assert.equal(await admin.locator('.settings-sidebar').getByRole('button', { name: /অনুদান|Donations/ }).count(), 1, 'Donation entry must appear inside website settings');
  await admin.getByRole('button', { name: /ডেমোর লেখা বসান|Load demo text/ }).click();
  await admin.getByRole('status').filter({ hasText: /সংরক্ষিত|saved/ }).waitFor();
  assert.equal(saved.published, false);
  await admin.getByText('Latest super admin demo', { exact: true }).waitFor();
  assert.equal(saved.methods[0].accountNumber, '01700000000', 'Demo must preserve payment accounts');
  const publication = admin.getByTitle(/পাবলিক ওয়েবসাইটে অনুদান প্রকাশ করুন|Publish donations on the public website/);
  assert.equal(await publication.getAttribute('aria-pressed'), 'false');
  const titleRow = admin.locator('.group').filter({ has: admin.getByText(/^(শিরোনাম|Title)$/) });
  await titleRow.getByRole('button').click();
  await admin.getByRole('textbox').fill('Edited donation title');
  await admin.getByRole('button', { name: /^(সংরক্ষণ করুন|Save)$/ }).click();
  await admin.getByText('Edited donation title', { exact: true }).waitFor();
  assert.equal(saved.title, 'Edited donation title');
  await admin.getByTitle(/মাধ্যম সম্পাদনা করুন|Edit method/).click();
  await admin.getByLabel(/অ্যাকাউন্টের ধরন|Account type/).selectOption('personal');
  await admin.getByLabel(/অ্যাকাউন্ট \/ মোবাইল নম্বর|Account \/ mobile number/).fill('01800000000');
  await admin.locator('form').getByRole('button', { name: /^(সংরক্ষণ করুন|Save)$/ }).click();
  await admin.getByText('01800000000', { exact: true }).waitFor();
  assert.equal(saved.methods[0].accountNumber, '01800000000');
  assert.equal(saved.methods[0].accountType, 'personal');
  await admin.getByRole('button', { name: /মাধ্যম যোগ করুন|Add method/ }).click();
  await admin.locator('form select').first().selectOption('bank');
  await admin.getByLabel(/অ্যাকাউন্টের ধরন|Account type/).selectOption('current');
  await admin.getByLabel(/অ্যাকাউন্টধারীর নাম|Account holder name/).fill('QA bank holder');
  await admin.getByLabel(/অ্যাকাউন্ট \/ মোবাইল নম্বর|Account \/ mobile number/).fill('123456789');
  await admin.getByLabel(/ব্যাংকের নাম|Bank name/).fill('Test Bank');
  await admin.getByLabel(/শাখার নাম|Branch name/).fill('Test Branch');
  await admin.getByLabel(/রাউটিং নম্বর|Routing number/).fill('012345678');
  await admin.locator('form').getByRole('button', { name: /^(সংরক্ষণ করুন|Save)$/ }).click();
  await admin.getByText('QA bank holder', { exact: true }).waitFor();
  assert.equal(saved.methods[1].accountType, 'current');
  assert.equal(saved.methods[1].bankName, 'Test Bank');
  assert.equal(saved.methods[1].branchName, 'Test Branch');
  assert.equal(saved.methods[1].routingNumber, '012345678');
  await publication.click();
  await admin.waitForFunction(() => document.querySelector('button[title="পাবলিক ওয়েবসাইটে অনুদান প্রকাশ করুন"], button[title="Publish donations on the public website"]')?.getAttribute('aria-pressed') === 'true');
  assert.equal(saved.published, true);
  await admin.screenshot({ path: 'artifacts/donation-admin-page.png' });
  await admin.setViewportSize({ width: 390, height: 844 });
  assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Admin mobile overflow');
  allowed = false;
  await admin.reload();
  await admin.getByRole('button', { name: /আবার যাচাই করুন|Check again/ }).waitFor();
  assert.equal(await admin.getByTitle(/পাবলিক ওয়েবসাইটে অনুদান প্রকাশ করুন|Publish donations on the public website/).count(), 0);
  assert.equal(await admin.locator('.settings-sidebar').getByRole('button', { name: /অনুদান|Donations/ }).count(), 0, 'Unapproved institutions must not see the donation tab');

  const superAdmin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  superAdmin.on('pageerror', error => errors.push(error.message));
  await superAdmin.addInitScript(() => localStorage.setItem('admin_token', 'qa-mocked-token'));
  let template = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
  let savedTemplate = null;
  await superAdmin.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json = { data: {} };
    if (path.endsWith('/website/super/default-template')) {
      if (route.request().method() === 'PUT') { savedTemplate = route.request().postDataJSON(); template = savedTemplate; }
      json = { data: { content: template, updatedAt: null } };
    } else if (path.endsWith('/super/madrasas')) json = { data: [] };
    await route.fulfill({ json });
  });
  await superAdmin.goto('http://127.0.0.1:5189/websites');
  await superAdmin.getByRole('button', { name: /অনুদান \(ডেমো\)|Donations \(demo\)/ }).click();
  await superAdmin.getByRole('button', { name: /অনুদানের শিরোনাম সম্পাদনা|Edit Donation title/ }).click();
  await superAdmin.getByLabel(/অনুদানের শিরোনাম|Donation title/).fill('Custom donation demo');
  await superAdmin.getByRole('button', { name: /^(প্রয়োগ করুন|Apply)$/ }).click();
  await superAdmin.getByRole('button', { name: /পরিবর্তন সংরক্ষণ|Save changes/ }).click();
  await superAdmin.getByRole('status').filter({ hasText: /সংরক্ষ|saved/ }).waitFor();
  assert.equal(savedTemplate.donation.title, 'Custom donation demo');
  await superAdmin.reload();
  await superAdmin.getByRole('button', { name: /অনুদান \(ডেমো\)|Donations \(demo\)/ }).click();
  await superAdmin.getByText('Custom donation demo', { exact: true }).first().waitFor();
  await superAdmin.screenshot({ path: 'artifacts/donation-super-demo.png' });
  await superAdmin.setViewportSize({ width: 390, height: 844 });
  assert.ok(await superAdmin.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Super admin mobile overflow');
  assert.deepEqual(errors, []);
  console.log('Website settings donation menu, legacy URL redirect, demo draft loading, account preservation, save, revoked access, super-admin demo save/reload and mobile layout checks passed.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
