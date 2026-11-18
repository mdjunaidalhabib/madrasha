const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'qa', user: { id: 1, name: 'QA Admin', role: 'admin' }, permissions: [], modules: ['dashboard'] }, version: 0 }));
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('app-institution', JSON.stringify({ type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] }));
      });
      const data = { students: 1250, studentsByGender: { male: 750, female: 500 }, teachers: 48, income: 1500000, expense: 950000, balance: 550000, todayIncome: 25000, todayExpense: 8000, attendanceToday: { percentage: 94, total: 1175 }, pendingAdmissionsCount: 12, overdueFees: { totalDue: 45000, studentCount: 30, list: [] }, upcomingExams: [], paymentMethodTotals: [{ payment_method: 'online', income: 1000000 }, { payment_method: 'offline', income: 500000 }], fundBalances: [], importantLinks: [], recentTransactions: [] };
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        if (path.endsWith('/dashboard')) {
          await new Promise(resolve => setTimeout(resolve, 700));
          return route.fulfill({ json: data });
        }
        if (path.includes('/dashboard/trends')) return route.fulfill({ json: { incomeExpense: [], attendance: [] } });
        if (path.includes('/auth/me')) return route.fulfill({ json: { id: 1, name: 'QA Admin', role: 'admin', permissions: [], modules: ['dashboard'], institution: { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] } } });
        if (path.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: {} } } });
        if (path.includes('/sidebar')) return route.fulfill({ json: [] });
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto('http://127.0.0.1:5196/dashboard');
      for (const [name, count] of [['Students & Teachers', 4], ['Financial Overview', 4], ['Income Channels', 2], ['Daily Activity & Follow-up', 4]]) {
        const section = page.getByRole('region', { name, exact: true });
        await section.waitFor();
        await section.locator('.animate-pulse').first().waitFor({ state: 'detached' });
        assert.equal(await section.locator('p.text-xl').count(), count);
      }
      assert.equal(await page.getByRole('region', { name: 'Reports & Analytics', exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/dashboard-categories-${width}.png`, fullPage: true });
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.screenshot({ path: `artifacts/dashboard-categories-dark-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Dashboard category checks passed at ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
