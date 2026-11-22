const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');
const baseUrl = process.env.ADMIN_ADMISSION_QA_URL || 'http://127.0.0.1:5198';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      const admissions = [];
      page.on('pageerror', error => errors.push(error.message));
      const user = { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'MUHTAMIM' };
      const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
      await page.addInitScript(({ user, institution }) => {
        localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'admission-qa', user, permissions: ['students.create', 'students.read'], modules: ['students'] }, version: 0 }));
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('app-institution', JSON.stringify(institution));
      }, { user, institution });
      const student = { id: 11, registration_no: 5, name_bn: 'Returning Student', name_en: 'Returning Student', nid: null, father_name: 'Father Example', mother_name: 'Mother Example', division_id: 1, class_id: 2, current_class: 'Class Two', academic_year: '2025', guardian_phone: '01700000000', gender: 1 };
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        if (path.endsWith('/website/resolve-admin-domain')) return route.fulfill({ json: { data: null } });
        if (path.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions: ['students.create', 'students.read'], modules: ['students'], institution } });
        if (path.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: {} } } });
        if (path.includes('/sidebar')) return route.fulfill({ json: [] });
        if (path.endsWith('/students/admission/search')) return route.fulfill({ json: { data: [student] } });
        if (path.endsWith('/students/admission') && route.request().method() === 'POST') {
          admissions.push(route.request().postDataJSON());
          return route.fulfill({ json: { action: 're_admitted', studentId: 11, previousAcademicYear: '2025', admissionStatus: 'PENDING' } });
        }
        if (path.includes('/madrasa-divisions')) return route.fulfill({ json: { data: [{ division_id: 1, division_name_bn: 'General' }] } });
        if (path.includes('/madrasa-classes')) return route.fulfill({ json: { data: [{ class_id: 2, class_name_bn: 'Class Two' }, { class_id: 4, class_name_bn: 'Class Four' }] } });
        if (path.endsWith('/sessions')) return route.fulfill({ json: { data: [{ id: 3, name: '2026', divisionId: 1, isActive: true }] } });
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto(`${baseUrl}/students/new`);
      await page.getByRole('radio', { name: 'Existing student', exact: true }).check();
      assert.equal(await page.locator('input[name="name"]').isDisabled(), true);
      await page.getByRole('searchbox').fill('5');
      await page.getByRole('button').filter({ hasText: 'Returning Student' }).click();
      assert.equal(await page.locator('input[name="name"]').inputValue(), 'Returning Student');
      assert.equal(await page.locator('input[name="nid"]').inputValue(), '');
      assert.equal(await page.locator('label[for="parentPhone"]').innerText().then(text => text.includes('*')), false);
      assert.equal(await page.locator('input[name="parentPhone"]').getAttribute('required'), null);
      await page.locator('select[name="currentClass"]').selectOption('4');
      await page.waitForFunction(() => [...document.querySelectorAll('input[readonly]')].some(input => input.value === '2026'));
      await page.screenshot({ path: `artifacts/admission-shared-admin-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('input[name="parentPhone"]').fill('');
      await page.getByRole('button', { name: 'Update Session (Re-admission)', exact: true }).click();
      await page.getByRole('button', { name: 'New Admission Form', exact: true }).waitFor();
      assert.equal(admissions.length, 1);
      assert.equal(admissions[0].guardian_phone, '');
      assert.equal(admissions[0].existing_student_id, 11);
      assert.equal(admissions[0].admission_mode, 'existing');
      assert.equal(admissions[0].class_id, 4);
      assert.equal(admissions[0].nid, null);
      await page.getByRole('button', { name: 'New Admission Form', exact: true }).click();
      await page.getByRole('radio', { name: 'New student', exact: true }).waitFor();
      assert.equal(await page.getByRole('radio', { name: 'New student', exact: true }).isChecked(), true);
      assert.equal(await page.locator('input[name="name"]').inputValue(), '');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Admission selection passed at ${width}px`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
