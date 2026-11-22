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
      let count = 1;
      const user = { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'MUHTAMIM' };
      const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ user, institution }) => {
        localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'admission-qa', user, permissions: ['students.create', 'students.read'], modules: ['students', 'ihtemam'] }, version: 0 }));
        localStorage.setItem('app-language', 'en');
        const originalFetch = window.fetch.bind(window);
        window.__sidebarStreams = [];
        window.fetch = async (input, options) => {
          if (!String(input).endsWith('/sidebar/events')) return originalFetch(input, options);
          if (options.headers.Authorization !== 'Bearer qa-token' || options.headers['X-Madrasa-Slug'] !== 'admission-qa') throw new Error('Missing authenticated tenant headers');
          const stream = new ReadableStream({ start(controller) {
            window.__sidebarStreams.push(controller);
            controller.enqueue(new TextEncoder().encode('event: ready\ndata: {}\n\n'));
            options.signal.addEventListener('abort', () => {
              window.__sidebarStreams = window.__sidebarStreams.filter(item => item !== controller);
              controller.error(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          } });
          return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
        };
        localStorage.setItem('app-institution', JSON.stringify(institution));
      }, { user, institution });
      const students = ['WEBSITE', 'ADMIN', null].map((source, index) => ({ id: index + 1, name_bn: ['Online Applicant', 'Office Applicant', 'Legacy Applicant'][index], admission_source: source, current_class: 'Class One', admission_status: 'PENDING' }));
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        if (path.endsWith('/website/resolve-admin-domain')) return route.fulfill({ json: { data: null } });
        if (path.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions: ['students.create', 'students.read'], modules: ['students', 'ihtemam'], institution } });
        if (path.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: {} } } });
        if (path.endsWith('/sidebar')) return route.fulfill({ json: [{ key: 'ihtemam', label: 'Administration', group: 'Management', children: [{ key: 'pending', label: 'Pending Admissions', ...(count ? { count } : {}) }] }] });
        if (path.endsWith('/students/admission/pending')) return route.fulfill({ json: { data: students.slice(0, count) } });
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto(baseUrl + '/ihtemam/pending');
      const list = page.locator(width === 390 ? '[class~="sm:hidden"]' : 'table');
      await list.getByText('Online Applicant', { exact: true }).waitFor();
      await page.waitForFunction(() => window.__sidebarStreams.length === 1);
      const badge = page.locator('a[href="/ihtemam/pending"] [aria-live="polite"]').first();
      assert.equal(await badge.innerText(), '1');
      count = 3;
      await page.evaluate(() => window.__sidebarStreams.forEach(stream => stream.enqueue(new TextEncoder().encode('event: changed\ndata: {}\n\n'))));
      await page.waitForFunction(() => [...document.querySelectorAll('a[href="/ihtemam/pending"] [aria-live="polite"]')].every(badge => badge.textContent.trim() === '3'));
      await list.getByText('Legacy Applicant', { exact: true }).waitFor();
      if (width === 390) await page.getByRole('button', { name: /open menu/i }).click();
      await page.screenshot({ path: 'artifacts/sidebar-live-' + width + '.png', fullPage: true });
      count = 0;
      await page.evaluate(() => window.__sidebarStreams.forEach(stream => stream.enqueue(new TextEncoder().encode('event: changed\ndata: {}\n\n'))));
      await page.waitForFunction(() => document.querySelectorAll('a[href="/ihtemam/pending"] [aria-live="polite"]').length === 0);
      await page.getByText('No admissions awaiting approval', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Live sidebar counts passed at ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
