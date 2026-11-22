const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of process.env.STUDENT_QA_WIDTH ? [Number(process.env.STUDENT_QA_WIDTH)] : [390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(15000);
      const errors = [];
      let failNextSave = false;
      let savedPayload;
      page.on('pageerror', error => errors.push(error.message));
      const user = { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'admin' };
      const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
      await page.addInitScript(({ user, institution }) => {
        localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'profile-qa', user, permissions: ['students.view', 'students.update', 'students.transfer_session', 'students.expel', 'students.delete', 'reports.read'], modules: ['students', 'reports'] }, version: 0 }));
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('app-institution', JSON.stringify(institution));
      }, { user, institution });
      const student = { id: 1, registration_no: 1045, name_bn: 'Student Example', name_en: 'Student Example', father_name: 'Father Example', father_name_en: 'Abdullah Rahman', father_occupation: 'Teacher', mother_name: 'Mother Example', mother_name_en: 'Ayesha Rahman', mother_occupation: 'Homemaker', blood_group: 'B+', dob: '2012-03-15', residency_type: 1, division_id: 1, current_class: 'Class Seven', roll: 12, is_active: 1, gender: 1, division: 'Dhaka', district: 'Dhaka', thana: 'Savar', village: 'Campus Road', guardian_phone: '01700000000' };
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/^\/api/, '');
        if (path.endsWith('/website/resolve-admin-domain')) return route.fulfill({ json: { data: null } });
        if (path.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions: ['students.view', 'students.update', 'students.transfer_session', 'students.expel', 'students.delete', 'reports.read'], modules: ['students', 'reports'], institution } });
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
          if (route.request().method() === 'PUT') {
            if (failNextSave) {
              failNextSave = false;
              return route.fulfill({ status: 500, json: { message: 'Save failed' } });
            }
            savedPayload = route.request().postDataJSON();
            Object.assign(student, savedPayload);
          }
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
      await page.getByRole('button', { name: 'Print Admission Form', exact: true }).waitFor();
      const moreActions = page.locator('summary').filter({ hasText: 'More actions' });
      assert.equal(await moreActions.evaluate(el => Boolean(el.closest('header'))), true);
      assert.equal(await page.getByRole('button', { name: 'Print Admission Form', exact: true }).evaluate(el => Boolean(el.closest('header'))), true);
      assert.equal(await page.getByRole('button', { name: 'Session Transfer', exact: true }).isVisible(), false);
      assert.equal(await page.getByRole('button', { name: 'Print ID Card', exact: true }).isVisible(), false);
      assert.equal(await page.getByRole('button', { name: 'Download Marksheet', exact: true }).isVisible(), false);
      await moreActions.click();
      for (const action of ['Print ID Card', 'Download Marksheet', 'Session Transfer', 'Deactivate', 'Expel', 'Delete']) {
        await page.getByRole('button', { name: action, exact: true }).waitFor();
      }
      const dropdownBounds = await page.getByRole('button', { name: 'Session Transfer', exact: true }).boundingBox();
      assert.ok(dropdownBounds.x >= 0 && dropdownBounds.x + dropdownBounds.width <= width);
      assert.equal(await page.getByRole('button', { name: 'Session Transfer', exact: true }).evaluate(el => {
        const rect = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), true);
      await moreActions.press('Escape');
      assert.equal(await page.getByRole('button', { name: 'Session Transfer', exact: true }).isVisible(), false);
      const rowButtons = [page.getByRole('button', { name: 'Edit', exact: true }), page.getByRole('button', { name: 'Collect Fee', exact: true }), page.getByRole('button', { name: 'Print Admission Form', exact: true }), moreActions];
      const rowBounds = await Promise.all(rowButtons.map(button => button.boundingBox()));
      const headerBounds = await page.locator('header').filter({ has: moreActions }).boundingBox();
      assert.ok(rowBounds.every(bounds => bounds.x >= headerBounds.x && bounds.x + bounds.width <= headerBounds.x + headerBounds.width), `Profile actions must stay inside the header at ${width}px`);
      if (width < 1024) {
        assert.ok(Math.abs(rowBounds[0].y - rowBounds[1].y) <= 1 && Math.abs(rowBounds[2].y - rowBounds[3].y) <= 1 && rowBounds[2].y > rowBounds[0].y, 'Mobile actions should form two rows of two buttons');
        for (const button of rowButtons) {
          const label = await button.locator('span.min-w-0').boundingBox();
          assert.ok(label.width > 10 && label.height > 10, 'Mobile action labels must be visible');
        }
        assert.equal(await rowButtons[2].locator('span').evaluate(el => el.getBoundingClientRect().height <= Number.parseFloat(getComputedStyle(el).lineHeight) + 1), true, 'Admission form label must stay on one line');
        assert.equal(await moreActions.locator('span').evaluate(el => el.getBoundingClientRect().height <= Number.parseFloat(getComputedStyle(el).lineHeight) + 1), true, 'More actions label must stay on one line');
        for (const button of [rowButtons[2], moreActions]) assert.equal(await button.locator('span').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'Button labels must fit without overlapping');
        assert.ok(rowBounds.every(bounds => bounds.height <= 40), 'Mobile action buttons should remain slim');
        assert.equal(await moreActions.locator('svg').count(), 1, 'More actions should only show the dropdown chevron');
      } else {
        assert.ok(rowBounds.every(bounds => Math.abs(bounds.y - rowBounds[0].y) <= 1), `Desktop profile actions must share one row at ${width}px`);
        const infoBounds = await page.locator('header dl').boundingBox();
        assert.ok(rowBounds[0].x >= infoBounds.x && rowBounds[0].y >= infoBounds.y + infoBounds.height, 'Desktop actions belong below the identifiers on the right');
      }
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
      await page.getByRole('heading', { name: 'Student Information', exact: true }).waitFor();
      const editBounds = await page.locator('div.max-w-6xl').first().boundingBox();
      assert.equal(profileBounds.width, editBounds.width);
      assert.equal(profileBounds.x, editBounds.x);
      assert.deepEqual(profileSections, (await page.locator('h2').allTextContents()).slice(0, 4));
      assert.equal(profileGrid, await page.locator('h2').first().evaluate(el => getComputedStyle(el.nextElementSibling).gridTemplateColumns));
      const name = page.locator('#student-name_en');
      assert.equal(await page.locator('summary').filter({ hasText: 'More actions' }).count(), 0);
      for (const action of ['Print Admission Form', 'Session Transfer', 'Deactivate', 'Expel', 'Delete']) {
        assert.equal(await page.getByRole('button', { name: action, exact: true }).count(), 0);
      }
      await page.screenshot({ path: `artifacts/student-edit-overview-${width}.png`, fullPage: true });
      assert.equal(await name.getAttribute('readonly'), '');
      const editName = page.locator('button[aria-controls="student-name_en"]');
      const idleBackground = await name.evaluate(el => getComputedStyle(el).backgroundColor);
      await editName.click();
      assert.equal(await name.getAttribute('readonly'), null);
      assert.equal(await name.evaluate(el => document.activeElement === el), true);
      assert.equal(await editName.getAttribute('aria-pressed'), 'true');
      assert.match(await editName.getAttribute('aria-label'), /Finish editing/);
      await page.waitForFunction(({ idleBackground }) => getComputedStyle(document.querySelector('#student-name_en')).backgroundColor !== idleBackground, { idleBackground });
      await name.fill('Updated Student');
      assert.equal(await name.inputValue(), 'Updated Student');
      await editName.click();
      assert.equal(await name.getAttribute('readonly'), '');
      assert.equal(await name.inputValue(), 'Updated Student');
      assert.equal(await editName.getAttribute('aria-pressed'), 'false');
      await editName.click();
      await name.press('Enter');
      assert.equal(await name.getAttribute('readonly'), '');
      await editName.click();
      const fatherName = page.locator('#student-father_name_en');
      await page.locator('button[aria-controls="student-father_name_en"]').click();
      assert.equal(await name.getAttribute('readonly'), '');
      assert.equal(await fatherName.getAttribute('readonly'), null);
      assert.equal(await fatherName.evaluate(el => document.activeElement === el), true);
      await editName.click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/student-edit-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
      assert.equal(await name.inputValue(), 'Student Example');
      assert.equal(await name.getAttribute('readonly'), '');
      assert.equal(await page.getByRole('button', { name: 'Update', exact: true }).first().isDisabled(), true);
      // Cancel without edits leaves immediately and does not ask for confirmation.
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.waitForURL('**/students/1045');
      assert.equal(await page.getByRole('heading', { name: 'You have unsaved changes', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('#student-name_en').waitFor();
      await page.locator('button[aria-controls="student-name_en"]').click();
      await page.locator('#student-name_en').fill('Unsaved Student');
      const unsavedHeading = page.getByRole('heading', { name: 'You have unsaved changes', exact: true });
      const confirmation = page.locator('div.fixed').filter({ has: unsavedHeading }).last();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await unsavedHeading.waitFor();
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.match(page.url(), /\/students\/1045\/edit$/);
      assert.equal(await page.locator('#student-name_en').inputValue(), 'Unsaved Student');
      // Browser Back is protected by the same confirmation.
      await page.evaluate(() => history.back());
      await unsavedHeading.waitFor();
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.match(page.url(), /\/students\/1045\/edit$/);
      assert.equal(await page.locator('#student-name_en').inputValue(), 'Unsaved Student');
      // Refresh uses the native browser confirmation; cancelling keeps the draft.
      const unloadDialog = page.waitForEvent('dialog');
      const reloadAttempt = page.evaluate(() => { window.location.reload(); });
      const dialog = await unloadDialog;
      assert.equal(dialog.type(), 'beforeunload');
      await dialog.dismiss();
      await reloadAttempt;
      assert.equal(await page.locator('#student-name_en').inputValue(), 'Unsaved Student');
      // A failed save must keep the draft and the navigation guard.
      failNextSave = true;
      const failedSave = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith('/students/1'));
      await page.getByRole('button', { name: 'Update', exact: true }).first().click();
      assert.equal((await failedSave).status(), 500);
      await page.getByRole('button', { name: 'Update', exact: true }).first().waitFor();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await unsavedHeading.waitFor();
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Update', exact: true }).first().click();
      await page.locator('#student-name_en[readonly]').waitFor();
      assert.equal(savedPayload.name_en, 'Unsaved Student');
      assert.equal(savedPayload.registration_no, undefined);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.waitForURL('**/students/1045');
      // Explicitly confirming departure discards the next draft.
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('button[aria-controls="student-name_en"]').click();
      await page.locator('#student-name_en').fill('Discarded Student');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await unsavedHeading.waitFor();
      await confirmation.getByRole('button', { name: 'Leave / Refresh', exact: true }).click();
      await page.waitForURL('**/students/1045');
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('#student-name_en[readonly]').waitFor();
      assert.equal(await page.locator('#student-name_en').inputValue(), 'Unsaved Student');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.waitForURL('**/students/1045');
      await page.locator('summary').filter({ hasText: 'More actions' }).click();
      await page.getByRole('button', { name: 'Print ID Card', exact: true }).click();
      await page.waitForURL(url => url.pathname === '/reports/documents' && url.searchParams.get('key') === 'student-id-cards' && url.searchParams.get('student_id') === '1');
      await page.goBack();
      await page.waitForURL('**/students/1045');
      await page.locator('summary').filter({ hasText: 'More actions' }).click();
      await page.getByRole('button', { name: 'Download Marksheet', exact: true }).click();
      await page.waitForURL(url => url.pathname === '/reports/documents' && url.searchParams.get('key') === 'student-marksheets' && url.searchParams.get('student_id') === '1');
      await page.goto('http://127.0.0.1:5198/students/9999');
      await page.getByRole('status', { name: 'Loading student information', exact: true }).waitFor({ state: 'detached' });
      await page.getByText(/not found/i).first().waitFor();
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Student profile/edit checks passed at ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
