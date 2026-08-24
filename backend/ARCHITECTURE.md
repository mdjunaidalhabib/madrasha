# Madrasa SaaS Architecture

## Role separation

- **Super Admin** controls the platform: madrasa creation, plans, activation/suspension, trash/restore, and website status.
- **Madrasa Admin** controls one madrasa: students, teachers, accounts, reports, talimat, and website content/settings.
- **Public Website** shows published madrasa data by slug, for example `/m/demo-madrasa`.

## Backend module structure

```txt
src/modules/
  super-admin/       Platform owner APIs and auth
  public-website/    Public website + madrasa website settings APIs
  auth/              Madrasa admin/staff login
  dashboard/         Madrasa admin dashboard
  students/          Student records
  teacher/           Teacher records
  accounts/          Income/expense/reporting
  talimat/           Academic/talimat features
  reports/           Academic/student/teacher reports
```

## Route groups

```txt
POST /api/super-admin/login
/api/super/*
/api/website/public/:slug
/api/website/admin/settings
/api/website/super/madrasas/:id/status
/api/auth/login
/api/dashboard
```

## Path-based tenant resolution

Tenant resolution now supports path-based frontend URLs such as:

- `/jamia/admin/login`
- `/jamia/admin/dashboard`
- `/jamia`

The frontend sends `X-Madrasa-Slug: jamia` to the API. `tenantMiddleware` resolves that slug from the `madrasas` table and attaches `req.tenant`.

Subdomain tenancy can still be added later because the database isolation remains based on `madrasa_id`.

## DocumentTemplate system

Printable document layouts (ID cards, admit cards, certificates, etc.) are managed by a background-overlay designer rather than hardcoded print templates.

```txt
src/modules/document-templates/   Template CRUD, versioning, defaults, generate()
prisma/models/document-templates.prisma
```

- Scope: `SYSTEM` (`tenantId` null, Super Admin authored) vs `TENANT` (madrasa-owned). A tenant can view/clone any published SYSTEM template but never edit one.
- Versioning: draft -> publish. Publishing freezes a `PUBLISHED` version and opens a new `DRAFT`. History via `GET /document-templates/:id/versions`; restore into the current draft via `POST /document-templates/:id/versions/:versionId/restore`.
- Default resolution (`DocumentTemplateService.getEffectiveDefault()`): tenant's own `TenantDocumentDefault` for that type -> one-time lazy migration from the legacy preset design (`ID_CARD`/`ADMIT_CARD` only) -> 404.
- Wired end-to-end (management UI + `POST /document-templates/generate` + print output): `ID_CARD`, `ADMIT_CARD`, `CERTIFICATE`, `CLEARANCE_CERTIFICATE`, `TESTIMONIAL`, `MARKSHEET`. `FEE_RECEIPT`/`SALARY_SLIP` exist in the `DocumentType` enum but have no report data source yet.
- Legacy compatibility: a tenant's old `id_card_design`/`admit_card_design` preset on `Madrasa` auto-migrates into a real `DocumentTemplate` the first time it's needed (`legacy-template-migration.service.ts`). `letter_design`/`book_label_design` and the free-text `sanadTemplate`/`testimonialTemplate`/`transferLetterTemplate`/`admitCardRules` columns have no such migration and remain a separate, still-live legacy system; certificate/testimonial/transfer-letter output tries the new engine's tenant default first and falls back to the legacy free-text system when nothing has been set up yet.
- Report data queries live in `reports/reports.repository.ts` and are reused (not duplicated) by `document-templates.service.ts`'s `generate()`/`getPreviewRow()`.
- Permissions: `document_templates.read`, `document_templates.manage` (manage required for create/edit/publish/delete/clone/set-default/version-restore).

## Report permission granularity

`reports.read` remains a superset granting access to every report. Five narrower keys now scope a role to one category instead of all-or-nothing: `reports.academic`, `reports.exam`, `reports.student`, `reports.teacher`, `reports.attendance`. Existing `reports.read` holders are unaffected.
