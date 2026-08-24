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

## Document designer

```txt
src/components/DocumentDesigner/      Canvas-based layout editor (layers, elements, render engine)
src/features/talimat/
  TenantDocumentTemplateLibrary.tsx   List/clone/set-default/delete templates
  TenantDocumentDesignerPage.tsx      Edit one template's draft, publish, restore versions
```

Reachable at Talimat -> Settings -> Documents (`talimat/settings/documents`, editor at `talimat/settings/documents/:type/:id/edit`), gated by the `document_templates.read`/`document_templates.manage` permissions.

Replaces the old per-type `id_card` / `admit_card` / `certificate` / `testimonial` / `transfer_letter` settings pages; those routes now redirect here. Print output in `components/Report/documents/*` resolves the tenant's default template through the backend and renders it with the same `DocumentDesigner` engine used for the designer's live preview.
