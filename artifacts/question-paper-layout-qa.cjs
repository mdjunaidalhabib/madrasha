const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../node_modules/typescript');
const { chromium } = require('../backend/node_modules/playwright');

const compiled = ts.transpileModule(fs.readFileSync('admin/src/features/question-paper/questionPaper.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const helpers = { exports: {} };
new Function('exports', compiled)(helpers.exports);
const { defaultPaperExam } = helpers.exports;
const { appendSubquestion } = helpers.exports;
assert.equal(appendSubquestion(''), 'ক) ');
assert.equal(appendSubquestion('Heading\nক. First'), 'Heading\nক. First\nখ) ');
assert.equal(appendSubquestion('ক) First\nখ) Second\n'), 'ক) First\nখ) Second\nগ) ');
assert.equal(appendSubquestion('x'.repeat(10000)), 'x'.repeat(10000));
const exam = (id, startDate, endDate, divisionIds = []) => ({ id, name: `Exam ${id}`, year: '2026', startDate, endDate, divisionIds });
const exams = [exam(1, '2026-10-01', '2026-10-10'), exam(2, '2026-12-01', '2026-12-10'), exam(3, '2026-11-20', '2026-11-25', [11]), exam(4, null, null, [12])];
assert.equal(defaultPaperExam(exams, 11, '2026-11-23').id, 3);
assert.equal(defaultPaperExam(exams, 12, '2026-11-23').id, 2);
assert.equal(defaultPaperExam([exams[0], exams[3]], 12, '2026-11-23').id, 4);
assert.equal(defaultPaperExam([exams[0]], 11, '2026-11-23').id, 1);
assert.equal(defaultPaperExam([exams[2]], 12, '2026-11-23'), undefined);
assert.equal(defaultPaperExam([], 11, '2026-11-23'), undefined);

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    page.on('dialog', dialog => dialog.accept());
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-token', madrasaSlug: 'qa', user: { id: 1, madrasa_id: 1, role: 'MUHTAMIM' }, permissions: ['talimat.manage'], modules: ['talimat'] }, version: 0 }));
      localStorage.setItem('app-language', 'en');
      localStorage.setItem('app-institution', JSON.stringify({ type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] }));
    });
    const refs = {
      branding: { name: 'Academy', address: 'Dhaka' },
      divisions: [{ id: 11, name: 'Division A' }, { id: 12, name: 'Division B' }, { id: 13, name: 'No exams' }],
      classes: [{ id: 21, divisionId: 11, name: 'Class 1' }],
      subjects: [{ id: 31, classId: 21, name: 'Science' }],
      exams: [exam(1, null, null, [11]), exam(2, null, null, [12])],
    };
    const saved = { id: 'saved', institution: 'Academy', address: 'Dhaka', title: 'Historical title', divisionId: 11, divisionName: 'Division A', classId: 21, className: 'Class 1', subjectId: 31, subject: 'Science', duration: '2 hours', instructions: '', questions: [], updatedAt: '2026-01-01T00:00:00Z' };
    let createdPaper;
    const storedTemplates = [
      { id: 'builtin-0', text: '5 marks for neat handwriting.' },
      { id: 'builtin-1', text: '1 mark will be deducted for every 2 spelling mistakes.' },
      { id: 'builtin-2', text: 'Remaining questions are on the next page.' },
      { id: 'builtin-3', text: 'End of question paper' },
    ];
    const instructionTemplates = [
      { id: 'instruction-0', text: 'Answer all questions.' },
      { id: 'instruction-1', text: 'Marks are shown beside each question.' },
      { id: 'instruction-2', text: 'Write your answers clearly and neatly.' },
    ];
    let failNextTemplate = false;
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/sidebar')) return route.fulfill({ json: [] });
      if (path.endsWith('/auth/me')) return route.fulfill({ json: { id: 1, name: 'QA', permissions: ['talimat.manage'], modules: ['talimat'], institution: { type: 'MADRASA', default_language: 'en', languages: ['bn', 'en'] } } });
      let data = [];
      if (path.endsWith('/settings/plan')) data = { plan_name: 'QA', has_active_subscription: true, plan_status: 'active', days_remaining: 100, usage: { students: 0, users: 1 }, student_limit: 100, user_limit: 10 };
      if (path.endsWith('/website/resolve-admin-domain')) data = null;
      if (path.endsWith('/question-papers/references')) data = refs;
      else if (path.includes('/question-papers/instruction-templates')) {
        const id = path.endsWith('/instruction-templates') ? null : path.split('/').pop();
        if (id) {
          const index = instructionTemplates.findIndex(item => item.id === id);
          if (index < 0) return route.fulfill({ status: 404, json: { message: 'Not found' } });
          if (route.request().method() === 'DELETE') {
            instructionTemplates.splice(index, 1);
            data = { success: true };
          } else {
            const { text } = route.request().postDataJSON();
            if (instructionTemplates.some(item => item.id !== id && item.text === text)) return route.fulfill({ status: 409, json: { message: 'A template with this text already exists.' } });
            data = instructionTemplates[index] = { id, text };
          }
        } else if (route.request().method() === 'POST') {
          const { text } = route.request().postDataJSON();
          data = instructionTemplates.find(item => item.text === text);
          if (!data) {
            data = { id: `instruction-${instructionTemplates.length}`, text };
            instructionTemplates.push(data);
          }
        } else data = instructionTemplates;
      }
      else if (path.includes('/question-papers/closing-templates/')) {
        const id = path.split('/').pop();
        const index = storedTemplates.findIndex(item => item.id === id);
        if (index < 0) return route.fulfill({ status: 404, json: { message: 'Not found' } });
        if (route.request().method() === 'DELETE') {
          storedTemplates.splice(index, 1);
          data = { success: true };
        } else {
          const { text } = route.request().postDataJSON();
          if (storedTemplates.some(item => item.id !== id && item.text === text)) return route.fulfill({ status: 409, json: { message: 'A template with this text already exists.' } });
          storedTemplates[index] = { id, text };
          data = storedTemplates[index];
        }
      }
      else if (path.endsWith('/question-papers/closing-templates')) {
        if (route.request().method() === 'POST') {
          if (failNextTemplate) {
            failNextTemplate = false;
            return route.fulfill({ status: 500, json: { message: 'Template save failed. Retry.' } });
          }
          const { text } = route.request().postDataJSON();
          let template = storedTemplates.find(item => item.text === text);
          if (!template) {
            template = { id: `template-${storedTemplates.length}`, text };
            storedTemplates.push(template);
          }
          data = template;
        } else data = storedTemplates;
      }
      else if (path.endsWith('/question-papers')) {
        if (route.request().method() === 'POST') {
          createdPaper = { ...route.request().postDataJSON(), id: 'created', institution: 'Academy', address: 'Dhaka', divisionName: 'Division A', className: 'Class 1', subject: 'Science', updatedAt: new Date().toISOString() };
          data = createdPaper;
        } else data = createdPaper ? [createdPaper, saved] : [saved];
      }
      return route.fulfill({ json: { data } });
    });

    await page.goto('http://127.0.0.1:5229/talimat/question-papers', { waitUntil: 'networkidle' });
    await page.locator('.qp-field-bold').first().waitFor();
    assert.equal(await page.locator('.qp-field-bold').count(), 8);
    for (const button of await page.locator('.qp-field-bold').all()) {
      const box=await button.boundingBox();
      assert.equal(box.width,20); assert.equal(box.height,20);
    }
    await page.getByLabel('Division', { exact: true }).selectOption('11');
    await page.getByLabel('Class', { exact: true }).selectOption('21');
    await page.getByLabel('Subject / book', { exact: true }).selectOption('31');
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      const boxes=await page.locator('.qp-paper-details .qp-fields > label').evaluateAll(labels=>labels.slice(0,6).map(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y})));
      assert.equal(boxes[0].y,boxes[1].y); assert.equal(boxes[1].y,boxes[2].y);
      assert.equal(boxes[3].y,boxes[4].y); assert.equal(boxes[4].y,boxes[5].y);
      assert.ok(boxes[3].y>boxes[0].y);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }
    for (const name of ['Exam','Division','Class','Subject / book','Exam duration','Total marks']) {
      const button=page.getByRole('button',{name:name+' bold',exact:true});
      const before=await button.getAttribute('aria-pressed');
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'),before==='true'?'false':'true');
      const targets = {'Exam':'.qp-paper header h3','Division':'.qp-paper-class-subject span:nth-child(1)','Class':'.qp-paper-class-subject span:nth-child(2)','Subject / book':'.qp-paper-class-subject span:nth-child(3)','Exam duration':'.qp-paper-meta span:nth-child(1)','Total marks':'.qp-paper-meta span:nth-child(2)'};
      const target=page.locator(targets[name]);
      assert.equal(await target.evaluate(el=>el.classList.contains('qp-text-bold')),before!=='true');
      if(before!=='true') assert.ok(parseFloat(await target.evaluate(el=>getComputedStyle(el).webkitTextStrokeWidth))>0);
      await button.click();
      assert.equal(await target.evaluate(el=>el.classList.contains('qp-text-bold')),before==='true');
      await button.click();
    }
    assert.equal(await page.locator('.qp-paper-class-subject span').first().evaluate(el=>getComputedStyle(el).fontWeight),'700');
    assert.equal(await page.locator('.qp-paper-meta span').first().evaluate(el=>getComputedStyle(el).fontWeight),'700');
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.getByRole('button',{name:'Division bold',exact:true}).getAttribute('aria-pressed'),'true');


    for (const [groupName,buttonName,target] of [['Instruction templates','Bold instructions','.qp-paper-instructions'],['Closing templates','Bold closing text','.qp-paper footer']]) {
      const group=page.getByRole('group',{name:groupName,exact:true});
      const button=group.locator('legend').getByRole('button',{name:buttonName,exact:true});
      assert.equal(await button.getAttribute('aria-pressed'),'false');
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator(target).evaluate(el=>el.classList.contains('qp-text-bold')),true);
      assert.equal(await page.locator(target).evaluate(el=>getComputedStyle(el).color),'rgb(17, 17, 17)');
      assert.ok(parseFloat(await page.locator(target).evaluate(el=>getComputedStyle(el).webkitTextStrokeWidth))>0);
      assert.ok(await group.locator('.qp-template-text-bold').count()>0);
      if(buttonName==='Bold instructions') {
        assert.equal(await page.locator(target).evaluate(el=>getComputedStyle(el).fontWeight),'700');
        const boldImage=await page.locator(target).screenshot();
        await button.click();
        const normalImage=await page.locator(target).screenshot();
        assert.equal(boldImage.equals(normalImage),false);
        await button.click();
      }
      await button.click();
      assert.equal(await page.locator(target).evaluate(el=>el.classList.contains('qp-text-bold')),false);
    }
    assert.equal(await page.locator('.qp-layout-controls .qp-format-button').count(),0);
    for (const [groupName,note] of [['Instruction templates','Write your answers clearly and neatly.'],['Closing templates','Remaining questions are on the next page.']]) {
      const group=page.getByRole('group',{name:groupName,exact:true});
      const row=group.locator('.qp-template-row').filter({hasText:note});
      await row.hover();
      await row.getByRole('button',{name: /Delete/}).click();
      const dialog=page.locator('div.fixed.inset-0').filter({has:page.getByRole('heading',{name:'Delete this template?',exact:true})});
      await dialog.waitFor();
      const bounds=await dialog.locator(':scope > div').boundingBox();
      const viewport=page.viewportSize();
      assert.ok(Math.abs(bounds.x+bounds.width/2-viewport.width/2)<2);
      assert.ok(Math.abs(bounds.y+bounds.height/2-viewport.height/2)<2);
      assert.equal(await row.locator('.qp-template-confirm').count(),0);
      assert.equal(await page.locator('.qp-confirm').count(),0);
      await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
      assert.equal(await dialog.count(),0);
      await row.hover();
      await row.getByRole('button',{name: /Delete/}).click();
      await dialog.getByRole('button',{name:'Confirm',exact:true}).click();
      await row.waitFor({state:'detached'});
      assert.equal(await group.locator('.qp-template-confirm').count(),0);
    }
    console.log('PASS: desktop/mobile rows, six toggles, preview and restored draft');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
