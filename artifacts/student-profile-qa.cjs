const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const user = { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'admin' };
      const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
      await page.addInitScript(({ user, institution }) => {
        localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'profile-qa', user, permissions: ['students.view', 'students.edit'], modules: ['students'] }, version: 0 }));
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('app-institution', JSON.stringify(institution));
      }, { user, institution });
      const student = { id: 1, registration_no: 1045, name_bn: 'Student Example', name_en: 'Student Example', father_name: 'Father Example', father_name_en: 'Abdullah Rahman', father_occupation: 'Teacher', mother_name: 'Mother Example', mother_name_en: 'Ayesha Rahman', mother_occupation: 'Homemaker', blood_group: 'B+', dob: '2012-03-15', residency_type: 1, division_id: 1, current_class: 'Class Seven', roll: 12, is_active: 1, gender: 1, division: 'Dhaka', district: 'Dhaka', thana: 'Savar', village: 'Campus Road', guardian_phone: '01700000000' };
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/^\/api/, '');
        if (path.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions: ['students.view', 'students.edit'], modules: ['students'], institution } });
        if (path.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: {} } } });
        if (path.includes('/sidebar')) return route.fulfill({ json: [] });
        if (path.includes('/students/by-registration/')) {
          await new Promise(resolve => setTimeout(resolve, 650));
          return route.fulfill({ json: { data: path.endsWith('/9999') ? null : { id: 1 } } });
        }
        if (path.endsWith('/students/1/profile-360')) {
          await new Promise(resolve => setTimeout(resolve, 650));
          return route.fulfill({ json: { data: { student: { id: 1, nameBn: 'Student Example', fatherName: 'Father Example', roll: 12, registrationNo: 1045, isActive: 1, academicYear: '2026', admissionDate: '2026-01-12', classRef: { nameBn: 'Class Seven' } }, results: [], attendanceSummary: { percentage: 94 }, feeSummary: { totalDue: 2500 }, libraryRecords: [] } } });
        }
        if (path.endsWith('/students/1')) {
          await new Promise(resolve => setTimeout(resolve, 1400));
          return route.fulfill({ json: { data: student } });
        }
        if (path.includes('/madrasa-divisions')) return route.fulfill({ json: { data: [{ division_id: 1, division_name_bn: 'General' }] } });
        return route.fulfill({ json: { data: [], total: 0 } });
      });
      await page.goto('http://127.0.0.1:5198/students/1045');
      await page.getByRole('status', { name: 'Loading student information', exact: true }).waitFor();
      assert.equal(await page.getByText('Student not found', { exact: true }).count(), 0);
      await page.screenshot({ path: `artifacts/student-profile-loading-${width}.png` });
      await page.getByRole('status', { name: 'Loading student information', exact: true }).waitFor({ state: 'detached' });
      await page.getByRole('status', { name: 'Loading student details', exact: true }).waitFor();
      await page.getByRole('status', { name: 'Loading student details', exact: true }).waitFor({ state: 'detached' });
      const field = page.locator('p').filter({ hasText: /^Student Example$/ }).first();
      await field.waitFor();
      assert.equal(await field.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('input[disabled]').count(), 0);
      const avatar = await page.locator('[data-student-avatar]').boundingBox();
      assert.equal(avatar.width, 80);
      assert.equal(avatar.height, 96);
      assert.equal(await page.getByRole('heading', { name: 'Photo', exact: true }).count(), 0);
      const profileBounds = await page.locator('div.max-w-6xl').first().boundingBox();
      const profileSections = (await page.locator('h2').allTextContents()).slice(0, 4);
      const profileGrid = await page.locator('h2').first().evaluate(el => getComputedStyle(el.nextElementSibling).gridTemplateColumns);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/student-profile-${width}.png`, fullPage: true });
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      assert.equal(await field.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
      await page.screenshot({ path: `artifacts/student-profile-dark-${width}.png`, fullPage: true });
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      await page.getByRole('button', { name: 'Academic', exact: true }).click();
      await page.getByRole('heading', { name: 'Exam Results', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Financial', exact: true }).click();
      await page.getByRole('heading', { name: 'Recent Invoices', exact: true }).waitFor();
      await page.goto('http://127.0.0.1:5198/students/1045/edit');
      await page.getByRole('status', { name: 'Loading student information', exact: true }).waitFor();
      await page.screenshot({ path: `artifacts/student-edit-loading-${width}.png` });
      await page.locator('#student-name_en').waitFor();
      const editBounds = await page.locator('div.max-w-6xl').first().boundingBox();
      assert.equal(profileBounds.width, editBounds.width);
      assert.equal(profileBounds.x, editBounds.x);
      assert.deepEqual(profileSections, (await page.locator('h2').allTextContents()).slice(0, 4));
      assert.equal(profileGrid, await page.locator('h2').first().evaluate(el => getComputedStyle(el.nextElementSibling).gridTemplateColumns));
      const name = page.locator('#student-name_en');
      assert.equal(await name.getAttribute('readonly'), '');
      await page.locator('button[aria-controls="student-name_en"]').click();
      await name.fill('Updated Student');
      assert.equal(await name.inputValue(), 'Updated Student');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/student-edit-${width}.png`, fullPage: true });
      await page.goto('http://127.0.0.1:5198/students/9999');
      await page.getByRole('status', { name: 'Loading student information', exact: true }).waitFor({ state: 'detached' });
      await page.getByText(/not found/i).first().waitFor();
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Student profile/edit checks passed at ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
