const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

const sessions = [
  { id: 11, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', isActive: true, divisionId: null },
  { id: 12, name: '1448', startDate: '2026-04-01', endDate: '2027-03-31', isActive: true, divisionId: 2, division: { name: 'Kitab' } },
  { id: 9, name: '2025', startDate: '2025-01-01', endDate: '2025-12-31', isActive: false, divisionId: null },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, lang] of [[390, 'en'], [390, 'bn'], [1440, 'en']]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors = [], requests = [];
      let fail = false, empty = false;
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ lang }) => {
        localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'qa', user: { id: 1, name: 'QA Admin', role: 'admin' }, permissions: [], modules: ['dashboard'] }, version: 0 }));
        localStorage.setItem('app-language', lang);
        localStorage.setItem('app-institution', JSON.stringify({ type: 'MADRASA', default_language: lang, languages: ['bn', 'en'] }));
      }, { lang });
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/^\/api/, '');
        if (path.includes('/website/resolve-admin-domain')) return route.fulfill({ json: { data: null } });
        if (path === '/dashboard' || path === '/dashboard/trends') {
          const selection = url.searchParams.get('session');
          requests.push({ path, selection });
          if (fail) return route.fulfill({ status: 500, json: { message: 'QA failure' } });
          if (selection === '9') await new Promise(resolve => setTimeout(resolve, 300));
          if (path.endsWith('/trends')) return route.fulfill({ json: { incomeExpense: [], attendance: [] } });
          const students = empty && selection === 'active' ? 0 : selection === 'all' ? 2200 : selection === '9' ? 950 : 1250;
          return route.fulfill({ json: {
            sessionContext: { mode: selection === '9' ? 'session' : selection, sessions: empty ? [] : sessions, selectedSessionIds: selection === 'all' ? [11, 12, 9] : selection === '9' ? [9] : [11, 12] },
            students, studentsByGender: { male: 750, female: 500 }, teachers: 48, income: 1500000, expense: 950000, balance: 550000, currentBalance: 990000,
            todayIncome: 25000, todayExpense: 8000, attendanceToday: { percentage: 94, total: 1175 }, pendingAdmissionsCount: 12,
            overdueFees: { totalDue: 45000, studentCount: 30, list: [] }, upcomingExams: [], paymentMethodTotals: [{ payment_method: 'online', income: 1000000 }, { payment_method: 'offline', income: 500000 }], fundBalances: [], importantLinks: [], recentTransactions: [],
          } });
        }
        if (path.includes('/auth/me')) return route.fulfill({ json: { id: 1, name: 'QA Admin', role: 'admin', permissions: [], modules: ['dashboard'], institution: { type: 'MADRASA', default_language: lang, languages: ['bn', 'en'] } } });
        if (path.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: {} } } });
        if (path.includes('/sidebar')) return route.fulfill({ json: [] });
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto('http://127.0.0.1:5196/dashboard');
      const select = page.locator('#dashboard-session');
      await select.waitFor().catch(async error => {
        console.log('Page:', page.url(), 'Errors:', errors, (await page.locator('body').innerText()).slice(0, 1400));
        throw error;
      });
      await page.locator('[aria-busy="false"]').waitFor();
      assert.equal(await select.inputValue(), 'active');
      assert.equal(await page.locator('#dashboard-overview-title').count(), 0);
      assert.ok((await select.boundingBox()).height <= 32);
      assert.equal(requests.filter(r => r.selection === 'active').length >= 2, true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}/${lang}`);
      await page.screenshot({ path: `artifacts/dashboard-session-${lang}-${width}.png`, fullPage: true });
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.screenshot({ path: `artifacts/dashboard-session-${lang}-${width}-dark.png`, fullPage: true });
      if (lang === 'en') {
        const academic = page.getByRole('region', { name: 'Students & Teachers', exact: true });
        await select.selectOption('9');
        await page.locator('[aria-busy="false"]').waitFor();
        assert.match(await academic.innerText(), /950/);
        assert.equal(requests.some(r => r.path.endsWith('/trends') && r.selection === '9'), true);
        await select.selectOption('all');
        await page.locator('[aria-busy="false"]').waitFor();
        assert.match(await academic.innerText(), /2,200/);
        // A slow archive response must not overwrite a newer all-session view.
        await select.selectOption('9');
        await select.selectOption('all');
        await page.locator('[aria-busy="false"]').waitFor();
        await page.waitForTimeout(450);
        assert.match(await academic.innerText(), /2,200/);
        fail = true;
        await select.selectOption('9');
        await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
        fail = false;
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
        await page.locator('[aria-busy="false"]').waitFor();
        empty = true;
        await select.selectOption('active');
        await page.getByText('No active session.', { exact: false }).waitFor();
        assert.match(await academic.innerText(), /0/);
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Session dashboard passed: ${width}px / ${lang}, light + dark`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
