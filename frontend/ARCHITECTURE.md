# Frontend Architecture

## Route groups

```txt
/super-admin/*  Platform owner panel
/admin/*        Madrasa management/admin panel
/m/:slug        Public madrasa website
```

## Folder structure

```txt
src/features/super-admin/
  auth/                 Super Admin login
  dashboard/            Platform overview
  madrasa-management/   Create/manage/suspend/trash madrasas
  subscriptions/        Plans and limits
  website-control/      Global website active/limited/disabled control

src/features/admin/
  website-builder/      Madrasa admin website settings and content controls

src/features/public/
  website/              Public website rendered from database settings

src/layouts/
  SuperAdminLayout.tsx  Platform owner layout
  AdminLayout.tsx       Madrasa admin layout
  DashboardLayout.tsx   Legacy tenant/admin dashboard wrapper
```

## Login paths

```txt
/super-admin/login  Super Admin login
/admin/login        Madrasa Admin login
```

## Path-based tenant URLs

This version uses path-based tenancy for development and simple hosting:

- Super Admin: `/super-admin/login`
- Madrasa Admin: `/:madrasaSlug/admin/login`
- Madrasa Admin Dashboard: `/:madrasaSlug/admin/dashboard`
- Public Website: `/:madrasaSlug`

Examples:

- `/jamia/admin/login`
- `/jamia/admin/dashboard`
- `/jamia`

The frontend reads the first URL segment as the tenant slug and sends it to the backend with the `X-Madrasa-Slug` header.
