const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      const page = await context.newPage();
      const errors = [];
      const submissions = [];
      const privateRequests = [];
      const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(institution => {
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('app-institution', JSON.stringify(institution));
      }, institution);
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        if (path === '/website/public/admission-qa/admission-full') {
          assert.equal(route.request().headers().authorization, undefined);
          submissions.push(route.request().postDataJSON());
          return route.fulfill({ json: { data: { admissionStatus: 'PENDING' } } });
        }
        if (path === '/website/public/admission-qa') return route.fulfill({ json: { data: {
          madrasa: { name: 'Admission QA', institution },
          settings: { theme_color: '#2563eb' },
          divisions: [{ division_id: 1, division_name_bn: 'General' }, { division_id: 2, division_name_bn: 'Hifz' }],
          classes: [{ class_id: 3, class_name_bn: 'Class Three', division_id: 1 }, { class_id: 4, class_name_bn: 'Hifz One', division_id: 2 }],
          sessions: [{ id: 1, name: '2026 General', divisionId: null, isActive: true }, { id: 2, name: '1448 Hifz', divisionId: 2, isActive: true }],
        } } });
        if (/madrasa-divisions|madrasa-classes|sessions|upload/.test(path)) privateRequests.push(path);
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto('http://127.0.0.1:5199/admission-qa/admission');
      await page.locator('input[name="name"]').waitFor();
      await page.locator('button[type="submit"]').click();
      await page.getByRole('alert').waitFor();
      assert.equal(submissions.length, 0);
      await page.locator('input[name="name"]').fill('\u0986\u09ac\u09a6\u09c1\u09b2\u09cd\u09b2\u09be\u09b9');
      await page.locator('select[name="academicDivision"]').selectOption('1');
      await page.locator('select[name="currentClass"]').selectOption('3');
      await page.waitForFunction(() => [...document.querySelectorAll('input[readonly]')].some(input => input.value === '2026 General'));
      await page.locator('select[name="academicDivision"]').selectOption('2');
      assert.equal(await page.locator('select[name="currentClass"]').inputValue(), '');
      await page.locator('select[name="currentClass"]').selectOption('4');
      await page.waitForFunction(() => [...document.querySelectorAll('input[readonly]')].some(input => input.value === '1448 Hifz'));
      await page.locator('input[name="parentPhone"]').fill('01700000000');
      await page.locator('input[type="file"]').setInputFiles({
        name: 'photo.png', mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64'),
      });
      await page.locator('form img').waitFor();
      await page.screenshot({ path: `artifacts/public-admission-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width === 390) {
        await page.locator('form input[type="checkbox"]').check();
        await page.locator('input[name="altGuardianPhone"]').fill('01800000000');
      }
      await page.locator('button[type="submit"]').click();
      await page.waitForFunction(() => !document.querySelector('form'));
      assert.equal(submissions.length, 1);
      assert.equal(submissions[0].academic_year, '1448 Hifz');
      assert.equal(submissions[0].division_id, 2);
      assert.equal(submissions[0].class_id, 4);
      assert.match(submissions[0].image, /^data:image\/jpeg;base64,/);
      assert.equal(submissions[0].guardian_phone, width === 390 ? '01800000000' : '01700000000');
      assert.deepEqual(privateRequests, []);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Public admission passed at ${width}px`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
