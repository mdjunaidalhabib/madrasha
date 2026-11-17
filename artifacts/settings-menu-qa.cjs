const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
 const page = await browser.newPage(); const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
     const user = { id: 7, madrasa_id: 42, name: 'QA Admin', role: 'admin' };
    const permissions = ['website.manage', 'settings.view'];
    const institution = { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] };
    await page.addInitScript(({ user, permissions, institution }) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'gallery-qa', user, permissions, modules: ['website'] }, version: 0 }));
      localStorage.setItem('app-language', 'en');
      localStorage.setItem('app-institution', JSON.stringify(institution));
    }, { user, permissions, institution });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    let gallery = [{ id: 3, title: 'Campus', image_url: '/images/website-demo-campus.svg', sort_order: 1, is_published: 1 }];
    await page.route('**/api/**', route => {
      const url = route.request().url();
      if (url.includes('/website/admin/gallery') && route.request().method() === 'POST') {
        const saved = route.request().postDataJSON();
        gallery = [saved];
        return route.fulfill({ json: { data: saved } });
      }
      if (url.includes('/sidebar')) return route.fulfill({ json: [] });
      if (url.includes('/website/admin/settings')) return route.fulfill({ json: { data: {
        madrasa: { id: 42, name: 'Al Noor Academy', slug: 'gallery-qa' },
        settings: { theme_key: 'modern', show_gallery: 1 },
        pages: [], notices: [], gallery, slides: [], committee: [], videos: [],
      } } });
      if (url.includes('/auth/me')) return route.fulfill({ json: { ...user, permissions, modules: ['website'], institution } });
      if (url.includes('/settings/plan')) return route.fulfill({ json: { data: { plan_name: 'QA', plan_status: 'active', has_active_subscription: true, days_remaining: 365, usage: { students: 0, users: 1 } } } });
      return route.fulfill({ json: { data: [], total: 0 } });
    });

 for(const width of [360,390,768,1440]) {
 await page.setViewportSize({width,height:900});
 await page.goto('http://127.0.0.1:5195/settings/website');
 const sidebar=page.locator('aside.settings-sidebar');
 await sidebar.waitFor();
 const trigger=sidebar.locator('button[aria-controls]');
 const gallery=sidebar.getByRole('button',{name:/^Gallery/});
 if(width<1024){
 assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 assert.equal(await gallery.isVisible(),false);
 assert.ok((await sidebar.boundingBox()).height<100);
 await trigger.click(); assert.equal(await gallery.isVisible(),true);
 await page.keyboard.press('Escape'); assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 await trigger.click(); await gallery.click();
 assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 assert.match(await trigger.innerText(),/Gallery/);
 } else { assert.equal(await trigger.isVisible(),false); await gallery.click(); }
 await page.getByRole('button',{name:/Add new image/}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'artifacts/settings-menu-'+width+'.png',animations:'disabled'});
 }
 await page.setViewportSize({width:390,height:900});
 await page.goto('http://127.0.0.1:5195/settings/profile');
 const trigger=page.locator('aside.settings-sidebar button[aria-controls]');
 await trigger.waitFor(); await trigger.click();
 const about=page.locator('aside.settings-sidebar a[href="/settings/about"]');
 await about.click();
 assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 assert.match(await trigger.innerText(),/About/);
 assert.deepEqual(errors,[]);
 console.log('Settings menus passed at 360, 390, 768 and 1440px; selection, Escape, routes and overflow verified.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});