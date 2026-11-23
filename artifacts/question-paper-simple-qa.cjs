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
    try { await page.locator('.qp-workspace').waitFor(); }
    catch (error) { console.log(page.url(), await page.locator('body').innerText(), errors); throw error; }
    const selects = page.locator('.qp-editor select');
    await selects.nth(0).waitFor();
    assert.equal(await page.getByLabel('Exam duration', { exact: true }).inputValue(), '3 hours');
    assert.equal(await page.getByRole('checkbox', { name: 'Answer all questions.', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('group', { name: 'Instruction templates', exact: true }).locator('textarea').count(), 0);
    let instructionBounds = await page.getByRole('group', { name: 'Instruction templates', exact: true }).boundingBox();
    let closingBounds = await page.getByRole('group', { name: 'Closing templates', exact: true }).boundingBox();
    assert.equal(instructionBounds.y, closingBounds.y);
    assert.ok(instructionBounds.x < closingBounds.x);
    assert.equal(await page.getByLabel('Total marks', { exact: true }).inputValue(), '100');
    // No global exam: the title starts as an input until a division is picked.
    await page.getByLabel('Division', { exact: true }).selectOption('11');
    assert.equal(await page.locator('.qp-editor select').first().inputValue(), 'Exam 1 2026');
    await page.getByLabel('Division', { exact: true }).selectOption('12');
    assert.equal(await page.locator('.qp-editor select').first().inputValue(), 'Exam 2 2026');
    await page.getByLabel('Division', { exact: true }).selectOption('13');
    assert.equal(await page.locator('.qp-editor input').first().inputValue(), '');
    await page.getByLabel('Division', { exact: true }).selectOption('11');
    await page.getByLabel('Class', { exact: true }).selectOption('21');
    await page.getByLabel('Subject / book', { exact: true }).selectOption('31');
    let classPosition = await page.locator('.qp-class-field select').boundingBox();
    let subjectPosition = await page.locator('.qp-subject-field select').boundingBox();
    assert.equal(classPosition.y, subjectPosition.y);
    assert.ok(classPosition.x < subjectPosition.x);
    assert.deepEqual(await page.locator('.qp-paper-class-subject > span').allTextContents().then(values => values.map(text => text.trim())), ['Class: Class 1', 'Subject: Science']);
    assert.equal(await page.locator('textarea.qp-closing-text').count(), 0);
    assert.equal(await page.getByRole('checkbox', { name: 'End of question paper', exact: true }).isChecked(), true);
    const notes = ['5 marks for neat handwriting.', '1 mark will be deducted for every 2 spelling mistakes.', 'Remaining questions are on the next page.'];
    const templateRow = page.locator('.qp-template-row').filter({ hasText: notes[0] });
    await page.mouse.move(0, 0);
    assert.equal(await templateRow.locator('.qp-template-actions').evaluate(el => getComputedStyle(el).opacity), '0');
    await templateRow.hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.qp-template-row:hover .qp-template-actions')).opacity === '1');
    await templateRow.getByRole('button', { name: `Edit template: ${notes[0]}`, exact: true }).focus();
    await page.mouse.move(0, 0);
    assert.equal(await templateRow.locator('.qp-template-actions').evaluate(el => getComputedStyle(el).opacity), '1');
    for (const note of notes) await page.getByRole('checkbox', { name: note, exact: true }).check();
    await page.getByRole('checkbox', { name: notes[0], exact: true }).uncheck();
    assert.ok(!(await page.locator('.qp-paper footer').innerText()).includes(notes[0]));
    await page.getByRole('checkbox', { name: notes[0], exact: true }).check();
    const customNote = page.getByLabel('New template text', { exact: true });
    const addNote = page.getByRole('button', { name: 'Create template', exact: true });
    assert.equal(await addNote.isDisabled(), true);
    failNextTemplate = true;
    await customNote.fill('Check your answers before submitting.');
    await addNote.click();
    await page.getByRole('alert').getByText('Template save failed. Retry.', { exact: true }).waitFor();
    assert.equal(await customNote.inputValue(), 'Check your answers before submitting.');
    await addNote.click();
    await page.getByRole('checkbox', { name: 'Check your answers before submitting.', exact: true }).waitFor();
    assert.equal(await customNote.inputValue(), '');
    await customNote.fill('Write clearly <students>.');
    await customNote.press('Enter');
    await page.getByRole('checkbox', { name: 'Write clearly <students>.', exact: true }).waitFor();
    const closingText = ['End of question paper', notes[1], notes[2], notes[0], 'Check your answers before submitting.', 'Write clearly <students>.'].join('\n');
    assert.equal(await page.locator('.qp-paper footer').innerText(), closingText);
    const decreaseSpacing = page.getByRole('button', { name: 'Decrease spacing', exact: true });
    const increaseSpacing = page.getByRole('button', { name: 'Increase spacing', exact: true });
    assert.equal(await increaseSpacing.isVisible(), true);
    assert.equal(await page.getByRole('slider', { name: 'Question spacing', exact: true }).count(), 0);
    await decreaseSpacing.click();
    assert.equal(await page.locator('.qp-spacing-stepper output').innerText(), '9');
    for (let i = 0; i < 19; i++) await increaseSpacing.click();
    assert.equal(await page.locator('.qp-spacing-stepper output').innerText(), '28');
    await page.getByRole('button', { name: 'Bold instructions', exact: true }).click();
    await page.getByRole('button', { name: 'Bold closing text', exact: true }).click();
    await page.getByRole('button', { name: 'Bold question', exact: true }).click();
    await page.getByLabel('Question', { exact: true }).fill('Explain the water cycle.');
    const questionInput = page.getByLabel('Question', { exact: true });
    const subquestionButton = page.getByRole('button', { name: 'Add subquestion (ক, খ)', exact: true });
    await subquestionButton.click();
    assert.equal(await questionInput.inputValue(), 'Explain the water cycle.\nক) ');
    await questionInput.pressSequentially('First part');
    await questionInput.press('Enter');
    assert.match(await questionInput.inputValue(), /ক\) First part\nখ\) $/);
    await questionInput.pressSequentially('Second part');
    await subquestionButton.click();
    assert.match(await questionInput.inputValue(), /খ\) Second part\nগ\) $/);
    await questionInput.pressSequentially('Third part');
    await page.getByRole('button', { name: 'Add question', exact: true }).click();
    assert.equal(await page.locator('.qp-question-item').count(), 1);
    assert.match(await page.locator('.qp-paper').innerText(), /ক\) First part\nখ\) Second part\nগ\) Third part/);
    assert.equal(await page.locator('.qp-paper-questions').evaluate(el => getComputedStyle(el).gap), '28px');
    assert.equal(await page.locator('.qp-paper footer').innerText(), closingText);
    assert.equal(await page.locator('.qp-paper footer').evaluate(el => getComputedStyle(el).fontWeight), '700');
    assert.equal(await page.locator('.qp-question-bold .qp-paper-question > p').evaluate(el => getComputedStyle(el).fontWeight), '700');
    const instructionStyle = await page.locator('.qp-paper-instructions').evaluate(el => {
      const css = getComputedStyle(el);
      return { align: css.textAlign, border: css.borderBottomWidth, padding: css.paddingTop, weight: css.fontWeight };
    });
    assert.deepEqual(instructionStyle, { align: 'center', border: '0px', padding: '0px', weight: '700' });
    await subquestionButton.click();
    assert.equal(await questionInput.inputValue(), 'ক) ');
    await questionInput.fill('');
    await questionInput.fill('Second main question');
    await page.getByRole('button', { name: 'Add question', exact: true }).click();
    const questionBounds = await page.locator('.qp-paper-questions > section').evaluateAll(elements => elements.map(el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom })));
    assert.equal(questionBounds[1].top - questionBounds[0].bottom, 28);
    assert.equal(await page.getByLabel('Total marks', { exact: true }).inputValue(), '100');
    assert.equal(await page.locator('.qp-paper').isVisible(), true);
    const editorBounds = await page.locator('.qp-editor').boundingBox();
    const previewBounds = await page.locator('.qp-preview-column').boundingBox();
    assert.ok(previewBounds.x >= editorBounds.x + editorBounds.width, 'Desktop preview sits beside the editor');
    assert.match(await page.locator('.qp-paper').innerText(), /Explain the water cycle/);
    await page.screenshot({ path: 'artifacts/question-paper-simple-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    instructionBounds = await page.getByRole('group', { name: 'Instruction templates', exact: true }).boundingBox();
    closingBounds = await page.getByRole('group', { name: 'Closing templates', exact: true }).boundingBox();
    assert.equal(instructionBounds.y, closingBounds.y);
    assert.ok(instructionBounds.x < closingBounds.x);
    classPosition = await page.locator('.qp-class-field select').boundingBox();
    subjectPosition = await page.locator('.qp-subject-field select').boundingBox();
    assert.equal(classPosition.y, subjectPosition.y);
    assert.ok(classPosition.x < subjectPosition.x);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.qp-template-actions')).opacity === '1');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    assert.equal(await page.locator('.qp-paper').isVisible(), true);
    assert.match(await page.locator('.qp-paper').innerText(), /Explain the water cycle/);
    const mobileEditorBounds = await page.locator('.qp-editor').boundingBox();
    const mobilePreviewBounds = await page.locator('.qp-preview-column').boundingBox();
    assert.ok(mobilePreviewBounds.y >= mobileEditorBounds.y + mobileEditorBounds.height, 'Mobile preview sits below the editor');
    await page.screenshot({ path: 'artifacts/question-paper-simple-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Save paper', exact: true }).click();
    await page.getByText('Question paper saved.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('question-paper-draft:')).length), 0);
    assert.deepEqual({ footerText: createdPaper.layout.footerText, questionSpacing: createdPaper.layout.questionSpacing, instructionsBold: createdPaper.layout.instructionsBold, footerBold: createdPaper.layout.footerBold }, { footerText: closingText, questionSpacing: 28, instructionsBold: true, footerBold: true });
    assert.equal(createdPaper.questions[0].bold, true);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: /My papers/ }).click();
    await page.locator('.qp-saved-paper').filter({ hasText: 'Exam 1 2026' }).getByRole('button').first().click();
    assert.equal(await page.locator('.qp-paper footer').innerText(), closingText);
    assert.equal(await page.locator('.qp-paper-questions').evaluate(el => getComputedStyle(el).gap), '28px');
    await page.getByRole('tab', { name: /My papers/ }).click();
    await page.locator('.qp-saved-paper').filter({ hasText: 'Historical title' }).getByRole('button').first().click();
    assert.equal(await page.locator('.qp-editor select').first().inputValue(), 'Historical title');
    await page.getByRole('button', { name: 'New paper', exact: true }).click();
    const reusableTemplate = page.getByRole('checkbox', { name: 'Write clearly <students>.', exact: true });
    assert.equal(await reusableTemplate.isChecked(), false);
    await reusableTemplate.check();
    assert.match(await page.locator('.qp-paper footer').innerText(), /Write clearly <students>\./);
    assert.equal(storedTemplates.length, 6);
    // Recover a question that has not been added yet, including MCQ options and settings.
    await page.getByLabel('Division', { exact: true }).selectOption('11');
    await page.getByLabel('Class', { exact: true }).selectOption('21');
    await page.getByLabel('Subject / book', { exact: true }).selectOption('31');
    await page.getByLabel('Exam duration', { exact: true }).fill('90 minutes');
    await page.getByRole('checkbox', { name: 'Answer all questions.', exact: true }).uncheck();
    const customInstruction = page.getByLabel('New instruction template text', { exact: true });
    await customInstruction.fill('Read each question carefully.');
    await page.getByRole('button', { name: 'Create instruction template', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Read each question carefully.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'MCQ', exact: true }).click();
    await questionInput.fill('Which option is correct?');
    const options = page.locator('.qp-option-input input:not([type="radio"])');
    for (let i = 0; i < 4; i++) await options.nth(i).fill(`Choice ${i + 1}`);
    await page.getByRole('radio', { name: 'Correct answer 2', exact: true }).check();
    await page.getByLabel('Marks', { exact: true }).fill('7.5');
    await page.getByRole('button', { name: 'Bold question', exact: true }).click();
    await customNote.fill('Unfinished template text');
    await customInstruction.fill('Unfinished instruction template');
    await page.locator('.qp-autosave-status').filter({ hasText: /^Saved$/ }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.qp-autosave-status').filter({ hasText: /^Saved$/ }).waitFor();
    assert.equal(await questionInput.inputValue(), 'Which option is correct?');
    assert.equal(await page.getByLabel('Exam duration', { exact: true }).inputValue(), '90 minutes');
    assert.equal(await page.locator('.qp-paper-instructions').innerText(), 'Read each question carefully.');
    assert.equal(await customInstruction.inputValue(), 'Unfinished instruction template');
    assert.equal(await page.getByLabel('Marks', { exact: true }).inputValue(), '7.5');
    assert.equal(await page.getByRole('radio', { name: 'Correct answer 2', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('button', { name: 'Bold question', exact: true }).getAttribute('aria-pressed'), 'true');
    for (let i = 0; i < 4; i++) assert.equal(await options.nth(i).inputValue(), `Choice ${i + 1}`);
    assert.equal(await customNote.inputValue(), 'Unfinished template text');
    assert.equal(await reusableTemplate.isChecked(), true);
    assert.equal(await page.locator('.qp-question-item').count(), 0);
    await customNote.fill('');
    await customInstruction.fill('');
    await page.getByRole('button', { name: 'Add question', exact: true }).click();
    await page.getByRole('button', { name: 'Edit question', exact: true }).click();
    await questionInput.fill('Edited question, not updated yet.');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await questionInput.inputValue(), 'Edited question, not updated yet.');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    assert.equal(await page.locator('.qp-question-item').count(), 1);
    assert.match(await page.locator('.qp-paper').innerText(), /Edited question, not updated yet\./);
    await page.getByRole('button', { name: 'Save paper', exact: true }).click();
    await page.getByText('Question paper saved.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('question-paper-draft:')).length), 0);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await questionInput.inputValue(), '');
    assert.equal(await page.locator('.qp-question-item').count(), 0);
    // Storage failure must remain visible and keep the current writing intact.
    await page.evaluate(() => {
      window.originalDraftSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith('question-paper-draft:')) throw new DOMException('Full', 'QuotaExceededError');
        return window.originalDraftSetItem.call(this, key, value);
      };
    });
    await questionInput.fill('Keep this text if storage is full.');
    await page.locator('.qp-autosave-status').filter({ hasText: /^Could not save$/ }).waitFor();
    assert.equal(await questionInput.inputValue(), 'Keep this text if storage is full.');
    await page.evaluate(() => { Storage.prototype.setItem = window.originalDraftSetItem; });
    await questionInput.fill('Storage is working again.');
    await page.locator('.qp-autosave-status').filter({ hasText: /^Saved$/ }).waitFor();
    const originalSavedFooter = createdPaper.layout.footerText;
    await page.getByRole('checkbox', { name: 'Write clearly <students>.', exact: true }).check();
    await page.getByRole('button', { name: 'Edit template: Write clearly <students>.', exact: true }).click();
    await page.getByLabel('Edit template text', { exact: true }).fill('Write neatly <students>.');
    await page.getByRole('button', { name: 'Save template', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Write neatly <students>.', exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'Write neatly <students>.', exact: true }).isChecked(), true);
    assert.match(await page.locator('.qp-paper footer').innerText(), /Write neatly <students>\./);
    assert.equal(createdPaper.layout.footerText, originalSavedFooter);
    await page.getByRole('button', { name: 'Edit template: Write neatly <students>.', exact: true }).click();
    await page.getByLabel('Edit template text', { exact: true }).fill('5 marks for neat handwriting.');
    await page.getByRole('button', { name: 'Save template', exact: true }).click();
    await page.getByRole('alert').getByText('A template with this text already exists.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Edit template text', { exact: true }).inputValue(), '5 marks for neat handwriting.');
    await page.getByRole('button', { name: 'Cancel template edit', exact: true }).click();
    await page.getByRole('button', { name: 'Delete template: Write neatly <students>.', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: 'Write neatly <students>.', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Delete template: Write neatly <students>.', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByText('Template deleted.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'Write neatly <students>.', exact: true }).count(), 0);
    const instructionGroup = page.getByRole('group', { name: 'Instruction templates', exact: true });
    await instructionGroup.getByRole('checkbox', { name: 'Marks are shown beside each question.', exact: true }).check();
    assert.match(await page.locator('.qp-paper-instructions').innerText(), /Answer all questions\.\nMarks are shown beside each question\./);
    await page.getByRole('button', { name: 'Edit instruction template: Marks are shown beside each question.', exact: true }).click();
    await page.getByLabel('Edit instruction template text', { exact: true }).fill('Check the marks beside each question.');
    await page.getByRole('button', { name: 'Save instruction template', exact: true }).click();
    await instructionGroup.getByRole('checkbox', { name: 'Check the marks beside each question.', exact: true }).waitFor();
    assert.match(await page.locator('.qp-paper-instructions').innerText(), /Check the marks beside each question\./);
    // Identical wording is allowed in separate instruction and closing libraries.
    await customInstruction.fill('Check your answers before submitting.');
    await page.getByRole('button', { name: 'Create instruction template', exact: true }).click();
    await instructionGroup.getByRole('checkbox', { name: 'Check your answers before submitting.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Delete instruction template: Check the marks beside each question.', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByText('Template deleted.', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await instructionGroup.getByRole('checkbox', { name: 'Check the marks beside each question.', exact: true }).count(), 0);
    assert.equal(await instructionGroup.getByRole('checkbox', { name: 'Check your answers before submitting.', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('group', { name: 'Closing templates', exact: true }).getByRole('checkbox', { name: 'Check your answers before submitting.', exact: true }).count(), 1);
    assert.equal(createdPaper.layout.footerText, originalSavedFooter);
    // Built-in templates have the same edit/delete controls and stay removed after reload.
    await page.getByRole('button', { name: 'Edit template: 5 marks for neat handwriting.', exact: true }).click();
    await page.getByLabel('Edit template text', { exact: true }).fill('4 marks for neat handwriting.');
    await page.getByRole('button', { name: 'Save template', exact: true }).click();
    await page.getByRole('checkbox', { name: '4 marks for neat handwriting.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Delete template: 4 marks for neat handwriting.', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByText('Template deleted.', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('checkbox', { name: '4 marks for neat handwriting.', exact: true }).count(), 0);
    assert.equal(await page.getByRole('checkbox', { name: '5 marks for neat handwriting.', exact: true }).count(), 0);
    assert.equal(await page.getByRole('checkbox', { name: 'Write neatly <students>.', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: question builder, templates, responsive preview, autosave/recovery of pending questions and edits, saved-draft cleanup and storage failure handling');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
