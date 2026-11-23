const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    await page.addInitScript(() => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'qa', user: { id: 1, madrasa_id: 1, role: 'MUHTAMIM' }, permissions: ['reports.read'], modules: ['reports'] }, version: 0 }));
      localStorage.setItem('app-language', 'bn');
      localStorage.setItem('app-institution', JSON.stringify({ type: 'MADRASA', default_language: 'bn', languages: ['bn', 'en'] }));
    });
    const rows = Array.from({ length: 60 }, (_, index) => ({ id: index + 1, student_id: index + 1, roll: index + 1, student_name: `শিক্ষার্থী আবদুল্লাহ ${index + 1}`, exam_name: 'বার্ষিক পরীক্ষা', exam_year: '2026', class_name: 'প্রথম শ্রেণি', division_name: 'কিতাব বিভাগ' }));
    let customSignature = null;
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path.endsWith('/website/resolve-admin-domain')) data = null;
      else if (path.endsWith('/settings/branding')) data = { report_brand_layout: { signature_text: customSignature } };
      else if (path.includes('exam-signature-sheet')) data = rows;
      else if (path.endsWith('/exams')) data = [{ id: 1, name: 'বার্ষিক পরীক্ষা' }];
      else if (path.endsWith('/madrasa-divisions')) data = [{ division_id: 1, division_name_bn: 'কিতাব বিভাগ' }];
      return route.fulfill({ json: { data } });
    });
    for (const paper of ['a4', 'a5']) {
      for (const columns of [1, 2]) {
        for (const hideSignature of [0, 1]) {
        customSignature = columns === 2 ? 'পরিচালকের স্বাক্ষর' : null;
        await page.goto(`http://localhost:5218/qa/print/reports/exam?key=exam-fee-collection-sheet&exam_id=1&division_id=all&class_id=all&paper_size=${paper}&page_columns=${columns}&hide_signature=${hideSignature}`, { waitUntil: 'domcontentloaded' });
        try {
          await page.locator('[data-report-ready="true"]').waitFor({ state: 'attached', timeout: 15000 });
        } catch (error) {
          console.log(await page.locator('body').innerText(), errors);
          throw error;
        }
        const layout = await page.evaluate(() => {
          const sheets = [...document.querySelectorAll('.print-area .report-print-page')];
          const tables = sheets.flatMap(sheet => [...sheet.querySelectorAll('table')]);
          return {
            sheets: sheets.length,
            rowCount: tables.reduce((count, table) => count + table.tBodies[0].rows.length, 0),
            tableWidth: tables[0].getBoundingClientRect().width,
            sheetWidth: sheets[0].getBoundingClientRect().width,
            fontSize: getComputedStyle(tables[0].querySelector('td')).fontSize,
            headers: [...tables[0].querySelectorAll('th')].map(th => th.textContent),
            overflow: tables.some(table => table.scrollWidth > table.clientWidth + 1),
            signatures: sheets.flatMap(sheet => [...sheet.querySelectorAll('.report-block-signature')]).filter(el => getComputedStyle(el).display !== 'none').length,
            signatureText: sheets.flatMap(sheet => [...sheet.querySelectorAll('.report-block-signature')]).filter(el => getComputedStyle(el).display !== 'none').map(el => el.textContent.trim()),
          };
        });
        assert.equal(layout.rowCount, rows.length);
        assert.equal(layout.headers.length, 4);
        assert.equal(layout.overflow, false);
        assert.equal(layout.signatures, hideSignature ? 0 : 1);
        assert.deepEqual(layout.signatureText, hideSignature ? [] : [customSignature || 'মুহতামিমের স্বাক্ষর']);
        if (columns === 2) assert.ok(layout.tableWidth < layout.sheetWidth / 2);
        else assert.ok(layout.tableWidth > layout.sheetWidth / 2);
        if (paper === 'a5') assert.equal(layout.fontSize, '16px');
        await page.screenshot({ path: `artifacts/exam-fee-${paper}-${columns}col.png`, fullPage: true });
        console.log(paper, columns, layout);
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
