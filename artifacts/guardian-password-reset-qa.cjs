const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      let resets = 0, fail = false;
      const user = { id: 1, name: 'QA Admin', role: 'MUHTAMIM' };
      await page.addInitScript(({ user }) => {
        localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa', madrasaSlug: 'qa', user, permissions: ['students.update', 'students.read'], modules: ['students'] }, version: 0 }));
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('app-institution', JSON.stringify({ type: 'MADRASA', default_language: 'en', languages: ['en', 'bn'] }));
      }, { user });
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        if (path === '/students/10/guardian/reset-password') {
          assert.deepEqual(route.request().postDataJSON(), { card_verified: true, reset_confirmed: true });
          resets++;
          return route.fulfill({ status: fail ? 500 : 200, json: fail ? { message: 'Reset unavailable' } : { success: true, data: { phone: '01712345678', temporaryPassword: '5678' } } });
        }
        if (path === '/students/10/profile-360') return route.fulfill({ json: { data: { student: { id: 10, nameBn: 'QA Student', nameEn: 'QA Student', registrationNo: 10, isActive: 1 } } } });
        if (path === '/students/10') return route.fulfill({ json: { data: { id: 10, name_bn: 'QA Student', name_en: 'QA Student', registration_no: 10, guardian_phone: '01712345678', is_active: 1 } } });
        if (path.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions: ['students.read', 'students.update'], modules: ['students'], institution: { type: 'MADRASA', default_language: 'en', languages: ['en', 'bn'] } } });
        if (path.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: {} } } });
        if (path.includes('resolve-admin-domain')) return route.fulfill({ json: { data: null } });
        if (path.includes('/sidebar')) return route.fulfill({ json: [] });
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto('http://127.0.0.1:5198/students/a-10/edit');
      await page.getByText('QA Student', { exact: true }).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Reset guardian password', exact: true }).count(), 0);
      await page.goto('http://127.0.0.1:5198/students/a-10');
      const menu = page.getByText('More actions', { exact: true });
      await menu.click();
      const launch = page.getByRole('button', { name: 'Reset guardian password', exact: true });
      await launch.waitFor();
      await page.screenshot({ path: `artifacts/guardian-password-reset-menu-${width}.png` });
      await launch.click({ timeout: 15000 }).catch(async error => {
        console.log(page.url(), errors, (await page.locator('body').innerText()).slice(0, 2400));
        throw error;
      });
      const dialog = page.getByRole('dialog');
      const proceed = dialog.getByRole('button', { name: 'Verified, continue', exact: true });
      assert.equal(await proceed.isDisabled(), true);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(resets, 0);
      await menu.click();
      await launch.click();
      await dialog.getByRole('checkbox', { name: "I have checked the card and verified the guardian's identity." }).check();
      await proceed.click();
      assert.equal(resets, 0);
      assert.equal(await dialog.getByRole('button', { name: 'Reset password', exact: true }).isDisabled(), true);
      await dialog.getByRole('checkbox', { name: 'The card has been verified and I confirm this password reset.' }).check();
      fail = true;
      await dialog.getByRole('button', { name: 'Reset password', exact: true }).click();
      await dialog.getByRole('alert').filter({ hasText: 'Reset unavailable' }).waitFor();
      fail = false;
      await dialog.getByRole('button', { name: 'Reset password', exact: true }).click();
      await dialog.getByText('5678', { exact: true }).waitFor();
      assert.equal(resets, 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/guardian-password-reset-${width}.png`, fullPage: false });
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.screenshot({ path: `artifacts/guardian-password-reset-${width}-dark.png`, fullPage: false });
      await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
      await menu.click();
      await launch.click();
      assert.equal(await proceed.isDisabled(), true);
      assert.equal(await dialog.getByText('5678', { exact: true }).count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`Guardian reset UI passed: ${width}px, cancel, failure, retry, success, cleared credential`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
