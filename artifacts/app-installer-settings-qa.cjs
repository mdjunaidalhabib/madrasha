const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/installer-qa', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto('http://127.0.0.1:5198/installer-qa');
    await page.evaluate(async () => {
      localStorage.setItem('ems-admin:pwa-dismissed-at', String(Date.now()));
      const { default: RefreshRuntime } = await import('/@react-refresh');
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { default: AppInstallPage } = await import('/src/features/admin/settings/AppInstallPage.tsx');
      const { setupPwa } = await import('/@fs/C:/website/madrasha/packages/shared-ui/src/pwa/pwa.ts');
      setupPwa();
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AppInstallPage));
      window.offerInstall = outcome => {
        const event = new Event('beforeinstallprompt', { cancelable: true });
        event.prompt = async () => { window.promptCalls = (window.promptCalls || 0) + 1; };
        event.userChoice = Promise.resolve({ outcome });
        window.dispatchEvent(event);
      };
    });
    await page.getByRole('heading', { name: 'অ্যাপ ইনস্টলার' }).waitFor();
    await page.getByText('ইনস্টল করার পদ্ধতি', { exact: true }).waitFor();
    await page.evaluate(() => offerInstall('dismissed'));
    await page.getByRole('button', { name: 'অ্যাপ ইনস্টল করুন' }).click();
    await page.getByRole('status').filter({ hasText: 'ইনস্টল সম্পন্ন হয়নি' }).waitFor();
    assert.equal(await page.evaluate(() => window.promptCalls), 1);
    await page.evaluate(() => offerInstall('accepted'));
    await page.getByRole('button', { name: 'অ্যাপ ইনস্টল করুন' }).click();
    await page.getByRole('status').filter({ hasText: 'অ্যাপ ইনস্টল করা আছে' }).waitFor();
    assert.equal(await page.evaluate(() => window.promptCalls), 2);
    assert.equal(await page.getByRole('button', { name: 'অ্যাপ ইনস্টল করুন' }).count(), 0);
    console.log('PASS: installer remains available after banner dismissal; browser guidance, native prompt, dismissed retry, and installed status.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
