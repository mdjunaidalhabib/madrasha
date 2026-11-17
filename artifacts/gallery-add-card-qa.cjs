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
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'gallery-qa', user, permissions, modules: ['website'] }, version: 0 }));
      localStorage.setItem('app-language', 'en');
      localStorage.setItem('app-institution', JSON.stringify(institution));
    }, { user, permissions, institution });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    let gallery = [{ id: 3, title: 'Campus', image_url: '/images/website-demo-campus.svg', sort_order: 1, is_published: 1 }];
    let uploadStarted;
    let finishUpload;
    let uploadGate;
    await page.route('**/api/**', route => {
      const url = route.request().url();
      if (url.includes('/uploads/image')) {
        return new Promise(resolve => {
          finishUpload = async (uploaded) => {
            await route.fulfill({ json: { data: { uploaded, url: uploaded ? '/images/website-demo-campus.svg' : null } } });
            resolve();
          };
          uploadStarted();
        });
      }
      if (url.includes('/website/admin/gallery') && route.request().method() === 'POST') {
        const saved = route.request().postDataJSON();
        gallery = [saved];
        return route.fulfill({ json: { data: saved } });
      }
      if (url.includes('/sidebar')) return route.fulfill({ json: [] });
      if (url.includes('/website/admin/settings')) return route.fulfill({ json: { data: {
        madrasa: { id: 42, name: 'Al Noor Academy', slug: 'gallery-qa' },
        settings: { theme_key: 'modern', show_gallery: 1 },
        pages: [], notices: [], gallery, slides: [], committee: [], videos: [],
      } } });
      if (url.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions, modules: ['website'], institution } });
      if (url.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_name: 'QA', plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: { students: 0, users: 1 } } } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:5194/settings/website');
      if (width < 1024) await page.locator('.settings-sidebar button[aria-expanded]').click();
      await page.getByRole('navigation', { name: 'Settings menu', exact: true }).getByRole('button', { name: /^Gallery/ }).click();
      const addCard = page.getByRole('button', { name: /Add new image/ });
      await addCard.waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
      await addCard.click();
      const dialog = page.getByRole('dialog', { name: 'Add new image' });
      await dialog.waitFor();
      assert.equal(await dialog.getByRole('button', { name: 'Add', exact: true }).isDisabled(), true);
      await page.waitForTimeout(400);
      assert.match(await dialog.innerText(), /1200 × 1200 px/);
      assert.match(await dialog.innerText(), /2 MB/);
      assert.equal(await dialog.locator('input[type=file]').getAttribute('accept'), 'image/png,image/jpeg');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/gallery-add-dialog-${width}.png`, animations: 'disabled' });
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await addCard.click();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.screenshot({ path: `artifacts/gallery-add-card-${width}.png`, animations: 'disabled' });
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Edit image' });
      await editor.waitFor();
      await page.waitForTimeout(400);
      assert.equal(await editor.locator('input[type=file]').count(), 1);
      assert.equal(await page.locator('input[type=file]').count(), 1);
      const save = editor.getByRole('button', { name: 'Save', exact: true });
      assert.equal(await save.isDisabled(), true);
      const previousTitle = await editor.getByLabel('Image title', { exact: true }).inputValue();
      await editor.getByLabel('Image title', { exact: true }).fill(`Updated ${width}`);
      assert.equal(await save.isEnabled(), true);
      await editor.getByLabel('Image title', { exact: true }).fill(previousTitle);
      assert.equal(await save.isDisabled(), true);
      await editor.getByLabel('Image title', { exact: true }).fill(`Updated ${width}`);
      await page.screenshot({ path: `artifacts/gallery-edit-dialog-${width}.png`, animations: 'disabled' });
      await editor.getByRole('button', { name: 'Save', exact: true }).click();
      await editor.waitFor({ state: 'hidden' });
      await page.getByText(`Updated ${width}`, { exact: true }).waitFor();
      assert.equal(gallery[0].title, `Updated ${width}`);
    }
    await page.getByRole('button', { name: /Add new image/ }).click();
    const uploadDialog = page.getByRole('dialog', { name: 'Add new image' });
    const add = uploadDialog.getByRole('button', { name: 'Add', exact: true });
    const imageFile = { name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') };
    for (const success of [true, false]) {
      uploadGate = new Promise(resolve => { uploadStarted = resolve; });
      await uploadDialog.locator('input[type=file]').setInputFiles(imageFile);
      await uploadGate;
      assert.equal(await add.isDisabled(), true);
      await finishUpload(success);
      await uploadDialog.locator('[role=button][aria-disabled=true]').waitFor({ state: 'hidden' });
      if (success) {
        await page.waitForFunction(() => !document.querySelector('[role=dialog] button[type=submit]').disabled);
        assert.equal(await add.isEnabled(), true);
        await uploadDialog.getByRole('button', { name: 'Delete', exact: true }).click();
        assert.equal(await add.isDisabled(), true);
      } else {
        assert.equal(await add.isDisabled(), true);
      }
    }
    assert.deepEqual(errors, []);
    console.log('Gallery add/edit, unchanged/reverted edits and pending/successful/failed uploads passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
