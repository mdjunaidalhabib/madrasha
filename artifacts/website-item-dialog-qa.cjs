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
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'item-qa', user, permissions, modules: ['website'] }, version: 0 }));
      localStorage.setItem('app-language', 'en');
      localStorage.setItem('app-institution', JSON.stringify(institution));
    }, { user, permissions, institution });
    let data = {
      madrasa: { id: 42, name: 'Academy', slug: 'item-qa' }, settings: { theme_key: 'modern', show_gallery: 1 }, gallery: [],
      notices: [{ id: 1, title: 'Old notice', content: 'Details', is_published: 1 }],
      videos: [{ id: 2, title: 'Old video', video_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', sort_order: 1, is_published: 1 }],
      slides: [{ id: 3, image_url: '/images/website-demo-campus.svg', button_link: '/about', sort_order: 1, is_published: 1 }],
      committee: [{ id: 4, name: 'Old member', designation: 'Member', photo_url: '', phone: '', is_published: 1 }],
      pages: [{ page_key: 'about', title: 'About', content: 'Old content', is_published: 1 }],
    };
    let donation = { allowed: true, published: false, title: 'Donate', description: '', instructions: '', contactPhone: '', checkoutUrl: '', methods: [{ type: 'bkash', accountType: 'personal', accountName: 'Admin', accountNumber: '01700000000', details: '', bankName: '', branchName: '', routingNumber: '' }] };
    let pendingUpload;
    let signalUpload;
    const writes = [];
    await page.route('**/api/**', route => {
      const request = route.request();
      const url = request.url();
      if (url.includes('/uploads/image')) return new Promise(resolve => {
        pendingUpload = async () => { await route.fulfill({ json: { data: { uploaded: true, url: '/images/website-demo-campus.svg' } } }); resolve(); };
        signalUpload();
      });
      if (url.includes('/sidebar')) return route.fulfill({ json: [] });
      if (url.includes('/website/admin/settings')) return route.fulfill({ json: { data } });
      if (url.includes('/website/admin/donations')) {
        if (request.method() === 'PUT') { donation = { ...donation, ...request.postDataJSON() }; writes.push('donations'); }
        return route.fulfill({ json: { data: request.method() === 'PUT' ? donation : { allowed: true, config: donation } } });
      }
      for (const key of ['notices', 'videos', 'slides', 'committee', 'pages']) {
        if (url.endsWith(`/website/admin/${key}`)) {
          const payload = request.postDataJSON();
          const row = { ...payload, ...(key === 'pages' ? {} : { id: payload.id ?? 100 + writes.length }) };
          const match = item => key === 'pages' ? item.page_key === row.page_key : item.id === row.id;
          data[key] = data[key].some(match) ? data[key].map(item => match(item) ? row : item) : [...data[key], row];
          writes.push(key);
          return route.fulfill({ json: { data: row } });
        }
      }
      if (url.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions, modules: ['website'], institution } });
      if (url.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_name: 'QA', plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: { students: 0, users: 1 } } } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    const navigate = async name => {
      const toggle = page.locator('.settings-sidebar button[aria-expanded]');
      if (page.viewportSize().width < 1024) {
        await toggle.waitFor();
        if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      }
      await page.getByRole('navigation', { name: 'Settings menu', exact: true }).getByRole('button', { name }).click();
    };
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:5194/settings/website');
      for (const config of [
        { menu: /^Notices/, key: 'notices', add: /Add new notice/, label: 'Notice title', value: 'Notice' },
        { menu: /^Video gallery/, key: 'videos', add: /Add new video/, label: 'Video title', value: 'Video' },
        { menu: /^Hero slider/, key: 'slides', add: /Add new slide/, label: /Link \(optional\)/, value: '/admission' },
        { menu: /committee/i, key: 'committee', add: /Add new member/, label: 'Name', value: 'Member' },
      ]) {
        await navigate(config.menu);
        await page.getByRole('button', { name: config.add }).click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).count(), 0);
        assert.equal(await dialog.getByRole('button', { name: 'Add', exact: true }).isDisabled(), true);
        await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
        await dialog.waitFor();
        const save = dialog.getByRole('button', { name: 'Save', exact: true });
        assert.equal(await save.isDisabled(), true);
        const input = dialog.getByLabel(config.label, { exact: typeof config.label === 'string' });
        const previous = await input.inputValue();
        await input.fill(config.value + width);
        assert.equal(await save.isEnabled(), true);
        await input.fill(previous);
        assert.equal(await save.isDisabled(), true);
        await input.fill(config.value + width);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.waitForTimeout(350);
        await page.screenshot({ path: `artifacts/website-${config.key}-dialog-${width}.png` });
        await save.click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(data[config.key][0][config.key === 'committee' ? 'name' : config.key === 'slides' ? 'button_link' : 'title'], config.value + width);
      }
      await navigate(/^Page content/);
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      const pageDialog = page.getByRole('dialog');
      await pageDialog.waitFor();
      assert.equal(await pageDialog.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
      await pageDialog.getByLabel('Title', { exact: true }).fill('About ' + width);
      await pageDialog.getByRole('button', { name: 'Save', exact: true }).click();
      await pageDialog.waitFor({ state: 'hidden' });
      await navigate(/Donation/);
      await page.getByRole('button', { name: 'Edit method', exact: true }).click();
      const methodDialog = page.getByRole('dialog');
      await methodDialog.waitFor();
      assert.equal(await methodDialog.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
      await methodDialog.getByLabel('Account holder name', { exact: true }).fill('Account ' + width);
      await methodDialog.getByRole('button', { name: 'Save', exact: true }).click();
      await methodDialog.waitFor({ state: 'hidden' });
      assert.equal(donation.methods[0].accountName, 'Account ' + width);
    }
    await navigate(/^Hero slider/);
    await page.getByRole('button', { name: /Add new slide/ }).click();
    const slideDialog = page.getByRole('dialog');
    const started = new Promise(resolve => { signalUpload = resolve; });
    await slideDialog.locator('input[type=file]').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') });
    await started;
    assert.equal(await slideDialog.getByRole('button', { name: 'Add', exact: true }).isDisabled(), true);
    await pendingUpload();
    await page.waitForFunction(() => !document.querySelector('[role=dialog] button[type=submit]').disabled);
    await slideDialog.locator('select').selectOption('1');
    await slideDialog.getByRole('button', { name: 'Add', exact: true }).click();
    await slideDialog.waitFor({ state: 'hidden' });
    assert.equal(data.slides.length, 2);
    assert.equal(data.slides.find(item => item.id === 3).sort_order, 2);
    assert.equal(data.slides.find(item => item.id !== 3).sort_order, 1);
    assert.deepEqual(errors, []);
    console.log('All content dialogs and donation methods passed on desktop/mobile; upload gating and slide creation passed.', writes);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
