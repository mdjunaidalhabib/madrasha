const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');
const baseUrl = process.env.ADMIN_ADMISSION_QA_URL || 'http://127.0.0.1:5211';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      const user = { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'MUHTAMIM' };
      const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ user, institution }) => {
        localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'admission-qa', user, permissions: ['students.create', 'students.read'], modules: ['students'] }, version: 0 }));
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('app-institution', JSON.stringify(institution));
      }, { user, institution });
      const students = ['WEBSITE', 'ADMIN', null].map((source, index) => ({ id: index + 1, name_bn: ['Online Applicant', 'Office Applicant', 'Legacy Applicant'][index], admission_source: source, current_class: 'Class One', admission_status: 'PENDING' }));
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        if (path.endsWith('/website/resolve-admin-domain')) return route.fulfill({ json: { data: null } });
        if (path.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions: ['students.create', 'students.read'], modules: ['students'], institution } });
        if (path.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: {} } } });
        if (path.includes('/sidebar')) return route.fulfill({ json: [] });
        if (path.endsWith('/students/admission/pending')) return route.fulfill({ json: { data: students } });
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto(`${baseUrl}/students/admissions/pending`);
      const visibleList = page.locator(width === 390 ? '[class~="sm:hidden"]' : 'table');
      await visibleList.getByText('Website', { exact: true }).waitFor().catch(async error => { console.log(await page.locator('body').innerText()); console.log(errors); throw error; });
      await visibleList.getByText('Admin panel', { exact: true }).waitFor();
      await visibleList.getByText('Source unknown', { exact: true }).waitFor();
      const filters = page.getByRole('group', { name: 'Application source', exact: true });
      await visibleList.getByRole('checkbox').first().check();
      await filters.getByRole('button', { name: /^Website/ }).click();
      await page.getByText('Showing 1 of 3 applications', { exact: true }).waitFor();
      assert.equal(await visibleList.getByText('Online Applicant', { exact: true }).count(), 1);
      assert.equal(await visibleList.getByText('Office Applicant', { exact: true }).count(), 0);
      assert.equal(await visibleList.getByRole('checkbox').first().isChecked(), false);
      await filters.getByRole('button', { name: /^Admin panel/ }).click();
      assert.equal(await visibleList.getByText('Office Applicant', { exact: true }).count(), 1);
      assert.equal(await visibleList.getByText('Online Applicant', { exact: true }).count(), 0);
      await visibleList.getByRole('checkbox').first().check();
      await page.getByText('1 selected', { exact: true }).waitFor();
      await filters.getByRole('button', { name: /^All/ }).click();
      await page.getByText('Showing 3 of 3 applications', { exact: true }).waitFor();
      assert.equal(await page.getByText('1 selected', { exact: true }).count(), 0);
      assert.equal(await visibleList.getByText('Source unknown', { exact: true }).count(), 1);
      students.splice(1, 1);
      await page.evaluate(() => window.dispatchEvent(new Event('admissions:changed')));
      await page.getByText('Showing 2 of 2 applications', { exact: true }).waitFor();
      await filters.getByRole('button', { name: /^Admin panel/ }).click();
      await page.getByText('No pending applications from this source', { exact: true }).waitFor();
      students.push({ id: 4, name_bn: 'Live Office Applicant', admission_source: 'ADMIN', admission_status: 'PENDING' });
      await page.evaluate(() => window.dispatchEvent(new Event('admissions:changed')));
      await visibleList.getByText('Live Office Applicant', { exact: true }).waitFor();
      await filters.getByRole('button', { name: /^Website/ }).click();
      await visibleList.getByRole('button', { name: 'Details', exact: true }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByText('Application source', { exact: true }).waitFor();
      await dialog.getByText('Website', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `artifacts/admission-source-filter-${width}.png`, fullPage: true });
      await context.close();
      console.log(`Admission source filters passed at ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
