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
