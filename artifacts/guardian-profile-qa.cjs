const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, lang] of [[390, 'bn'], [1440, 'en']]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [], requests = [];
      let libraryFails = true;
      const student = { id: 10, nameBn: 'আব্দুল্লাহ', nameEn: 'Abdullah', fatherName: 'আবদুর রহমান', motherName: 'আমিনা', guardianPhone: '01712345678', className: 'হিফজ বিভাগ', sessionName: '2026–27', roll: 12, registrationNo: 105, dob: '2015-01-01', gender: 1, residencyType: 1, isActive: 1, isOrphan: 0, admissionStatus: 'APPROVED', admissionType: 'NEW', village: 'ঢাকা', image: null };
      await page.addInitScript(({ lang }) => {
        localStorage.setItem('guardian-auth-storage', JSON.stringify({ state: { token: 'qa-token', guardian: { id: 7, name: 'Guardian', phone: '01712345678', mustChangePassword: false }, selectedStudentId: 10 }, version: 0 }));
        localStorage.setItem('app-language', lang);
        localStorage.setItem('theme', 'dark');
      }, { lang });
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        requests.push(path);
        const json = data => route.fulfill({ json: { success: true, data } });
        if (path.includes('/website/public/qa/brand')) return json({ slug: 'qa', name: 'পরীক্ষা মাদ্রাসা', address: 'ঢাকা', institution: { type: 'MADRASA', default_language: lang, languages: ['bn', 'en'] } });
        if (path === '/guardian/me/children') return json([student]);
        if (path.endsWith('/profile')) return json(student);
        if (path.endsWith('/results') || path.endsWith('/promotion')) return json([]);
        if (path.endsWith('/library')) {
          if (libraryFails) return route.fulfill({ status: 500, json: { message: 'Library unavailable' } });
          return json([]);
        }
        if (path.endsWith('/attendance')) return json({ summary: { percentage: 90 }, recent: [] });
        if (path.endsWith('/fees')) return json({ summary: { totalDue: 500 }, invoices: [] });
        return json([]);
      });
      await page.goto('http://127.0.0.1:5199/qa/guardian/profile');
      await page.getByText('আবদুর রহমান', { exact: true }).waitFor();
      assert.equal(requests.some(path => /profile-360|attendance|fees|library|results|promotion/.test(path)), false);
      assert.equal(await page.locator('html').evaluate(el => el.classList.contains('dark')), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/guardian-profile-${width}.png`, fullPage: true });
      // Translation wording may vary; select the second profile tab directly.
      const tabs = page.locator('.border-b.border-slate-200 > button');
      await tabs.nth(1).click();
      await page.getByText(lang === 'bn' ? 'পদোন্নতির ইতিহাস' : 'Promotion History', { exact: true }).waitFor();
      const resultsCount = requests.filter(path => path.endsWith('/results')).length;
      await tabs.nth(0).click();
      await page.getByText('আবদুর রহমান', { exact: true }).waitFor();
      await tabs.nth(1).click();
      assert.equal(requests.filter(path => path.endsWith('/results')).length, resultsCount);
      await tabs.nth(4).click();
      await page.locator('.guardian-error').waitFor();
      libraryFails = false;
      await page.locator('.guardian-error button').click();
      await page.locator('.guardian-error').waitFor({ state: 'hidden' });
      await page.locator('.guardian-loading').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.guardian-error').count(), 0);
      await page.goto('http://127.0.0.1:5199/qa/guardian/dashboard');
      await page.locator('.guardian-welcome h2').getByText('আব্দুল্লাহ').waitFor();
      const color = await page.locator('.guardian-welcome').evaluate(el => getComputedStyle(el).backgroundImage);
      assert.match(color, /gradient/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/guardian-summary-${width}.png` });
      assert.deepEqual(errors, []);
      console.log(`Passed ${width}px ${lang}: personal details, deferred tab requests, tab cache, failure/retry, light theme, responsive summary.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
