const assert = require('node:assert/strict');
const path = require('node:path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
require('../backend/node_modules/ts-node').register({ transpileOnly: true, project: path.resolve(__dirname, '../backend/tsconfig.json') });
const { prisma } = require('../backend/src/shared/database/prisma.ts');
const { provisionWebsiteOnTx, getWebsiteTemplate } = require('../backend/src/modules/public-website/website-template.service.ts');
const { DEFAULT_WEBSITE_TEMPLATE } = require('../backend/src/modules/public-website/website-template.schema.ts');

async function run() {
  const rollback = new Error('ROLLBACK_WEBSITE_TEMPLATE_QA');
  await prisma.$transaction(async (tx) => {
    const template = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
    template.settings.heroTitle = '{{institution_name}} — custom starter';
    await tx.platformWebsiteTemplate.upsert({ where: { id: 1 }, create: { id: 1, content: template }, update: { content: template } });
    assert.equal((await getWebsiteTemplate(tx)).content.settings.heroTitle, template.settings.heroTitle);
    const tenant = await tx.madrasa.create({ data: { name: 'Website QA', slug: `website-qa-${Date.now()}` } });
    await provisionWebsiteOnTx(tx, tenant.id);
    assert.equal((await tx.websiteSettings.findUnique({ where: { madrasaId: tenant.id } })).heroTitle, 'Website QA — custom starter');
    assert.equal(await tx.websitePage.count({ where: { madrasaId: tenant.id } }), 3);
    assert.equal(await tx.websiteSlide.count({ where: { madrasaId: tenant.id } }), 1);
    assert.equal(await tx.websiteGallery.count({ where: { madrasaId: tenant.id } }), 2);
    assert.equal(await tx.websiteCommitteeMember.count({ where: { madrasaId: tenant.id } }), 1);
    await tx.websiteSettings.update({ where: { madrasaId: tenant.id }, data: { heroTitle: 'Institution edit' } });
    await tx.websiteNotice.deleteMany({ where: { madrasaId: tenant.id } });
    await provisionWebsiteOnTx(tx, tenant.id);
    assert.equal((await tx.websiteSettings.findUnique({ where: { madrasaId: tenant.id } })).heroTitle, 'Institution edit');
    assert.equal(await tx.websiteNotice.count({ where: { madrasaId: tenant.id } }), 0);
    template.enabled = false;
    await tx.platformWebsiteTemplate.update({ where: { id: 1 }, data: { content: template } });
    const disabledTenant = await tx.madrasa.create({ data: { name: 'Disabled QA', slug: `website-qa-disabled-${Date.now()}` } });
    await provisionWebsiteOnTx(tx, disabledTenant.id);
    assert.equal(await tx.websiteSettings.count({ where: { madrasaId: disabledTenant.id } }), 0);
    throw rollback;
  }, { timeout: 30000 }).catch((error) => { if (error !== rollback) throw error; });
  console.log(JSON.stringify({ database: 'passed', templateRead: 'passed', provision: 'passed', preserveEdits: 'passed', disabled: 'passed', transaction: 'rolled back; no tenant or template changes retained' }));
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
