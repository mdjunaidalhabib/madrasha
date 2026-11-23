const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/branding-qa', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body></body></html>' }));
    await page.route('**/api/platform-brand', route => route.fulfill({ json: { data: { version: 'platform-v1' } } }));
    await page.goto('http://127.0.0.1:5198/branding-qa');
    await page.evaluate(async () => {
      const { default: RefreshRuntime } = await import('/@react-refresh');
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { setupBrandIcons } = await import('/src/utils/brandIcons.ts');
      const { useAuthStore } = await import('/src/store/authStore.ts');
      const { useBrandingStore } = await import('/src/store/brandingStore.ts');
      window.qa = { setupBrandIcons, auth: useAuthStore, branding: useBrandingStore };
      setupBrandIcons(null);
    });
    const manifest = () => page.evaluate(() => JSON.parse(decodeURIComponent(document.querySelector('link[rel="manifest"]').href.split(',')[1])));
    await page.waitForFunction(() => document.querySelector('link[rel="icon"]').href.includes('platform-v1'));
    assert.equal((await manifest()).name, 'EMS Admin');
    await page.evaluate(() => {
      qa.auth.setState({ token: 'qa-token', madrasaSlug: 'qa-school' });
      qa.branding.getState().setBranding({ name: 'QA School', report_logo: 'logo-one' });
    });
    assert.equal((await manifest()).name, 'QA School');
    assert.ok((await manifest()).icons.every(icon => icon.src.includes('/website/public/qa-school/icon/')));
    const firstIcon = (await manifest()).icons[0].src;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(150);
    assert.equal((await manifest()).icons[0].src, firstIcon, 'Platform refresh must not overwrite tenant icons');
    await page.evaluate(() => qa.branding.getState().setBranding({ name: 'Updated School', report_logo: 'logo-two' }));
    assert.equal((await manifest()).name, 'Updated School');
    assert.notEqual((await manifest()).icons[0].src, firstIcon);
    await page.evaluate(() => qa.branding.getState().setBranding({ name: 'Updated School', report_logo: null }));
    assert.deepEqual((await manifest()).icons, []);
    await page.evaluate(() => qa.auth.getState().logout());
    assert.equal((await manifest()).name, 'EMS Admin');
    assert.ok((await manifest()).icons[0].src.includes('/platform-brand/icon/'));
    await page.evaluate(() => {
      qa.auth.setState({ token: 'other-token', madrasaSlug: 'other-school' });
      qa.branding.getState().setBranding({ name: 'Other School', report_logo: 'other-logo' });
    });
    assert.ok((await manifest()).icons[0].src.includes('/website/public/other-school/icon/'));
    await page.reload();
    await page.evaluate(async () => {
      const { default: RefreshRuntime } = await import('/@react-refresh');
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { setupBrandIcons } = await import('/src/utils/brandIcons.ts');
      setupBrandIcons({ slug: 'custom-school', name: 'Custom Domain School', logo: 'custom-logo' });
    });
    assert.equal((await manifest()).name, 'Custom Domain School');
    assert.ok((await manifest()).icons[0].src.includes('/website/public/custom-school/icon/'));
    console.log('PASS: shared-host login, tenant logo, platform refresh isolation, branding edits/removal, logout, tenant switch, and custom-domain branding.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
