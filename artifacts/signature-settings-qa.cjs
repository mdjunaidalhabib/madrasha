const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const user = { id: 1, madrasa_id: 7, role: 'MUHTAMIM', name: 'QA Admin' };
    const institution = { type: 'MADRASA', default_language: 'bn', languages: ['bn', 'en'] };
    let branding = { name: 'QA Madrasa', report_brand_layout: {} };
    const saved = [];
    await page.addInitScript(({user, institution}) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'qa', user, permissions: ['settings.manage', 'reports.read'], modules: ['settings', 'reports'] }, version: 0 }));
      localStorage.setItem('app-language', 'bn');
      localStorage.setItem('app-institution', JSON.stringify(institution));
    }, {user, institution});
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({body:''}));
    await page.route('**/api/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if(pathname.endsWith('/website/resolve-admin-domain')) return route.fulfill({json:{data:null}});
      if(pathname.endsWith('/sidebar')) return route.fulfill({json:[]});
      if(pathname.includes('/auth/me')) return route.fulfill({json:{...user, permissions:['settings.manage','reports.read'], modules:['settings','reports'], institution}});
      if(pathname.endsWith('/settings/plan')) return route.fulfill({json:{data:{plan_status:'active',has_active_subscription:true,days_remaining:365,usage:{}}}});
      if(pathname.endsWith('/settings/branding')) {
        if(route.request().method()==='PUT') {
          const body=route.request().postDataJSON();
          saved.push(body);
          branding={...branding,...body,report_brand_layout:{...branding.report_brand_layout,...body.report_brand_layout}};
        }
        return route.fulfill({json:{data:branding}});
      }
      return route.fulfill({json:{data:[]}});
    });
    await page.goto('http://localhost:5218/settings/report-design', {waitUntil:'domcontentloaded'});
    const edit = page.getByText('রিপোর্টের স্বাক্ষরের লেখা',{exact:true}).filter({hasNot:page.locator('h2')}).last().locator('xpath=../..').getByRole('button');
    await page.getByRole('heading',{name:'রিপোর্টের স্বাক্ষরের লেখা',exact:true}).waitFor({timeout:10000}).catch(async error => {console.log(await page.locator('body').innerText()); throw error;});
    await edit.click();
    await page.getByPlaceholder('যেমন: মুহতামিমের স্বাক্ষর').fill('পরিচালকের স্বাক্ষর');
    await page.getByRole('button',{name:'সংরক্ষণ করুন',exact:true}).click();
    await page.getByText('পরিচালকের স্বাক্ষর',{exact:true}).waitFor();
    assert.equal(saved.at(-1).report_brand_layout.signature_text,'পরিচালকের স্বাক্ষর');
    await page.reload();
    await page.getByText('পরিচালকের স্বাক্ষর',{exact:true}).waitFor();
    await page.screenshot({path:'artifacts/signature-settings.png',fullPage:true});
    console.log('PASS: edit, save, and reload the signature caption in Report Design settings');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
