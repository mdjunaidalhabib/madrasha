const assert = require('node:assert/strict');
const { chromium } = require('../backend/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 for(const width of [320,390,768,1024,1440]) {
 const context=await browser.newContext({viewport:{width,height:1000}});
 const page=await context.newPage();
 const errors=[]; const posts=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
 localStorage.setItem('auth-storage',JSON.stringify({state:{token:'qa-token',madrasaSlug:'qa',user:{id:1,name:'QA Admin',role:'admin'},permissions:[],modules:['accounts']},version:0}));
 localStorage.setItem('app-language','en');
 localStorage.setItem('app-institution',JSON.stringify({type:'MADRASA',default_language:'en',languages:['bn','en']}));
 });
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));
 await page.route('**/api/**',r=>{
 const path=new URL(r.request().url()).pathname.replace(/^\/api/,'');
 if(r.request().method()==='POST' && /\/accounts\/(income|expense)$/.test(path)){posts.push({path,data:r.request().postDataJSON()});return r.fulfill({json:{}});}
 if(path==='/accounts/options')return r.fulfill({json:{incomeFunds:[{name:'General',categories:['Donation','Fees']},{name:'Special',categories:['Grant','General education and student welfare fund']}],expenseGroups:[{name:'Operations',categories:['Supplies','Repairs']},{name:'Utilities',categories:['Electricity','General education and student welfare fund']}],paymentMethods:['Cash','Bank']}});
 if(path.includes('resolve-admin-domain'))return r.fulfill({json:{data:null}});
 if(path.includes('/auth/me'))return r.fulfill({json:{id:1,name:'QA Admin',role:'admin',permissions:[],modules:['accounts'],institution:{type:'MADRASA',default_language:'en',languages:['bn','en']}}});
 if(path.includes('/settings/plan'))return r.fulfill({json:{data:{plan_status:'active',has_active_subscription:true,days_remaining:365,usage:{}}}});
 return r.fulfill({json:[]});
 });
 const sizes=[];
 for(const kind of ['income','expense']) {
 await page.goto('http://127.0.0.1:5196/accounts/'+kind);
 const card=page.locator('.account-entry-card');await card.waitFor();
 await page.locator('select').first().selectOption(kind==='income'?'Special':'Utilities');
 assert.equal(await card.locator('select').nth(1).inputValue(),kind==='income'?'Grant':'Electricity');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 sizes.push((await card.boundingBox()).width);
 for(const heading of await card.locator('.account-entry-section-heading').all()) {
   const text=await heading.locator('h2').boundingBox();
   const line=await heading.locator('span').boundingBox();
   assert.ok(line.width>20, 'Divider should remain visible');
   assert.ok(Math.abs(text.y+text.height/2-line.y-line.height/2)<2, 'Heading and divider should align');
 }

 const columns=await card.locator('.account-entry-fields').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
 assert.equal(columns,width<1024?2:4);
 const party=card.locator('.account-entry-fields').nth(1);
 const partyLabels=await party.locator('label').all();
 if(width>=1024){
   const boxes=await Promise.all(partyLabels.map(label=>label.boundingBox()));
   assert.ok(boxes.every(box=>Math.abs(box.y-boxes[0].y)<2),'Name, phone and address should share a row');
 }
 await card.locator('select').nth(1).selectOption('General education and student welfare fund');
 const displayed=card.locator('.account-entry-select-value').nth(1);
 assert.equal((await displayed.locator('span').innerText()),'General education and student welfare fund');
 assert.equal(await displayed.locator('span').evaluate(el=>el.scrollWidth>el.clientWidth),false,'Selected text should wrap fully');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

 await page.screenshot({path:'artifacts/account-entry-'+kind+'-'+width+'.png',fullPage:true});
 await page.evaluate(()=>document.documentElement.classList.add('dark'));
 await page.waitForTimeout(200);
 assert.equal(await card.locator('input').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(30, 41, 59)');
 await page.screenshot({path:'artifacts/account-entry-'+kind+'-'+width+'-dark.png',fullPage:true});
 await card.locator('input[required]').first().fill('QA Person');
 await card.getByLabel('Amount',{exact:false}).fill('1234');
 await card.getByRole('button',{name:kind==='income'?'Add income entry':'Add expense entry',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.account-entry-card input[inputmode="decimal"]').value==='');
 assert.equal(posts.at(-1).data.amount,'1234');
 assert.equal(posts.at(-1).data.fund,kind==='income'?'Special':'Utilities');
 }
 assert.equal(sizes[0],sizes[1]);assert.deepEqual(errors,[]);
 console.log('Income + expense: '+width+'px, responsive layout, light/dark, categories and mocked save passed');
 await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
