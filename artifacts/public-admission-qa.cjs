const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');
const baseUrl = process.env.PUBLIC_ADMISSION_QA_URL || 'http://127.0.0.1:5199';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, colorScheme: "dark" });
      const page = await context.newPage();
      const errors = [];
      const submissions = [];
      const privateRequests = [];
      const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(institution => {
        const addDark = () => document.documentElement.classList.add('dark');
        if (document.documentElement) addDark();
        else {
          const observer = new MutationObserver(() => { if (document.documentElement) { addDark(); observer.disconnect(); } });
          observer.observe(document, { childList: true, subtree: true });
        }
        localStorage.setItem('theme', 'dark');
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('app-institution', JSON.stringify(institution));
      }, institution);
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        if (path === '/website/public/admission-qa/admission-full') {
          assert.equal(route.request().headers().authorization, undefined);
          submissions.push(route.request().postDataJSON());
          if (submissions.length === 1) return route.fulfill({ status: 500, json: { message: 'Please try submitting again' } });
          return route.fulfill({ json: { data: { admissionStatus: 'PENDING' } } });
        }
        if (path === '/website/public/admission-qa') return route.fulfill({ json: { data: {
          madrasa: { name: 'Admission QA', institution },
          settings: { theme_color: '#2563eb', notice_bar_text: 'Admissions are open', theme_key: width === 390 ? 'heritage' : 'modern' },
          divisions: [{ division_id: 1, division_name_bn: 'General' }, { division_id: 2, division_name_bn: 'Hifz' }],
          classes: [{ class_id: 3, class_name_bn: 'Class Three', division_id: 1 }, { class_id: 4, class_name_bn: 'Hifz One', division_id: 2 }],
          sessions: [{ id: 1, name: '2026 General', divisionId: null, isActive: true }, { id: 2, name: '1448 Hifz', divisionId: 2, isActive: true }],
        } } });
        if (/madrasa-divisions|madrasa-classes|sessions|upload/.test(path)) privateRequests.push(path);
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto(`${baseUrl}/admission-qa/admission`);
      await page.locator('input[name="name"]').waitFor();
      assert.equal(await page.locator('header').count(), 1);
      assert.equal(await page.locator('footer').count(), 1);
      assert.equal(await page.locator('header a').first().getAttribute('href'), '/admission-qa');
      assert.equal(await page.locator('header').evaluate(el => getComputedStyle(el).backgroundColor), width === 390 ? 'rgb(255, 252, 245)' : 'rgb(255, 255, 255)');
      assert.equal(await page.locator('form fieldset > div').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
      assert.equal(await page.locator('input[name="name"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
      const headerLinks = await page.locator('header a').evaluateAll(links => links.map(link => ({ text: link.textContent.trim(), href: link.href })));
      const footerContent = await page.locator('footer').innerText();
      await page.locator('button[type="submit"]').click();
      await page.getByRole('alert').waitFor();
      await page.getByRole('status').filter({ hasText: 'Please fill in the required' }).waitFor();
      assert.equal(submissions.length, 0);
      assert.equal(await page.locator('label[for="parentPhone"]').innerText().then(text => text.includes('*')), false);
      assert.equal(await page.locator('input[name="parentPhone"]').getAttribute('required'), null);
      await page.locator('input[name="name"]').fill('\u0986\u09ac\u09a6\u09c1\u09b2\u09cd\u09b2\u09be\u09b9');
      await page.locator('select[name="academicDivision"]').selectOption('1');
      await page.locator('select[name="currentClass"]').selectOption('3');
      await page.waitForFunction(() => [...document.querySelectorAll('input[readonly]')].some(input => input.value === '2026 General'));
      await page.locator('select[name="academicDivision"]').selectOption('2');
      assert.equal(await page.locator('select[name="currentClass"]').inputValue(), '');
      await page.locator('select[name="currentClass"]').selectOption('4');
      await page.waitForFunction(() => [...document.querySelectorAll('input[readonly]')].some(input => input.value === '1448 Hifz'));
      await page.locator('input[name="parentPhone"]').fill('');
      await page.locator('input[type="file"]').setInputFiles({
        name: 'photo.png', mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64'),
      });
      await page.locator('form img').waitFor();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: `artifacts/public-admission-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width === 390) {
        await page.locator('form input[type="checkbox"]').check();
        assert.equal(await page.locator('input[name="altGuardianPhone"]').getAttribute('required'), null);
        assert.equal(await page.locator('label[for="altGuardianPhone"]').innerText().then(text => text.includes('*')), false);
      }
      await page.locator('button[type="submit"]').click();
      await page.getByRole('status').filter({ hasText: 'Please try submitting again' }).waitFor();
      await page.locator('button[type="submit"]').click();
      await page.getByRole('status').filter({ hasText: 'Application submitted successfully' }).waitFor();
      await page.waitForFunction(() => !document.querySelector('form'));
      assert.equal(submissions.length, 2);
      assert.deepEqual(submissions[1], submissions[0]);
      assert.equal(submissions[0].academic_year, '1448 Hifz');
      assert.equal(submissions[0].division_id, 2);
      assert.equal(submissions[0].class_id, 4);
      assert.match(submissions[0].image, /^data:image\/jpeg;base64,/);
      assert.equal(submissions[0].guardian_phone, '');
      assert.deepEqual(privateRequests, []);
      assert.deepEqual(errors, []);
      assert.equal(await page.locator('header').count(), 1);
      assert.equal(await page.locator('footer').count(), 1);
      await page.locator('header a').first().click();
      await page.waitForURL('**/admission-qa');
      assert.deepEqual(await page.locator('header a').evaluateAll(links => links.map(link => ({ text: link.textContent.trim(), href: link.href }))), headerLinks);
      assert.equal(await page.locator('footer').innerText(), footerContent);
      await page.goto(`${baseUrl}/m/admission-qa/admission`);
      await page.locator('input[name="name"]').waitFor();
      assert.equal(await page.locator('header a').first().getAttribute('href'), '/m/admission-qa');
      if (width === 390) {
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await page.getByRole('dialog').waitFor();
        assert.equal(await page.getByRole('dialog').getByRole('link', { name: 'Contact', exact: true }).getAttribute('href'), '/m/admission-qa/contact');
        await page.getByRole('button', { name: 'Close menu', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
      }
      await page.locator('footer a[href$="/guardian/login"]').click();
      await page.waitForURL('**/guardian/login');
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Public admission passed at ${width}px`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
