# Frontend Architecture

The client side is an npm-workspaces setup with 3 independently-deployable
apps sharing one package, so each can run on its own subdomain/origin. The
workspace root is the repo root itself (see root `package.json`) — `backend/`
stays a separate npm project with its own lockfile and is not part of this
workspace.

```txt
packages/
  shared-ui/        @madrasha/shared-ui — design system (components/ui), the
                     DocumentDesigner canvas engine, toast/theme/confirm
                     stores, apiConfig, a couple of shared utils. No build
                     step: apps import its .ts/.tsx source directly via
                     `@madrasha/shared-ui/src/...`. Depended on by admin,
                     frontend and super-admin.
admin/                Tenant admin dashboard + staff-only print/report views.
                      Dev port 5181. Owns `/` (dashboard), `/login`, and the
                      legacy `/admin/login` `/admin/*` redirects, plus
                      `/:madrasaSlug/print/reports/*` (rendered by the
                      backend's headless-browser PDF export, not visited by
                      the public).
frontend/             The platform's marketing/landing page AND everything a
                      non-staff visitor of a madrasa hits: the public
                      website, admission form and guardian portal.
                      Dev port 5183. Root `/` is
                      hostname-aware (see `src/features/landing/RootRoute.tsx`):
                      on the platform's own domain (`VITE_PLATFORM_ROOT_HOST`)
                      it renders the landing page; on any other hostname
                      (a tenant's connected custom domain) it resolves and
                      renders that tenant's public website instead. Also owns
                      `/:madrasaSlug`, `/m/:madrasaSlug(/admission)`,
                      `/:madrasaSlug/admission`, `/:madrasaSlug/guardian/*`
                      — path-based access for madrasas
                      that haven't connected their own domain yet. Split out
                      of admin so each madrasa's public-facing pages can run
                      on their own custom domain without touching the admin
                      dashboard's deploy.
super-admin/          Platform-owner panel. Dev port 5182. Root-relative
                      (`/login`, `/dashboard`, `/madrasas`, ... — no
                      `/super-admin` prefix, since this app owns its own
                      origin now).
```

## Why separate apps instead of one

Originally a single SPA served every area from one origin via path prefixes
(`/`, `/super-admin/*`, `/:madrasaSlug/*`). It was split along its natural
seams — an audit found almost no cross-imports between areas beyond a small,
well-defined shared surface (see `packages/shared-ui`) — first into
landing/admin/super-admin, then admin's public-facing routes (public website,
guardian portal, admission form, kiosk) were split again into `frontend/`.
The standalone `landing/` app was later folded into `frontend/` (see
"Custom domains" below) once tenant custom-domain support required root `/`
to be hostname-aware rather than a fixed marketing page — keeping them
separate would have meant routing between two different containers for the
same domain depending on hostname, which `frontend/`'s own client-side router
does more simply.

Two admin-only files build links INTO `frontend/`'s pages (dashboard's "view
public website" card and the website builder's preview link) via `admin/src/utils/publicSiteUrl.ts`, which
reads `VITE_PUBLIC_SITE_URL` — this must be set to `frontend/`'s real origin
in every environment (see `admin/.env`). It's deliberately not named
`VITE_FRONTEND_*`: the backend's `ADMIN_BASE_URL` / `INTERNAL_ADMIN_URL` env vars point at the
`admin/` app (formerly named `FRONTEND_BASE_URL`, renamed to avoid confusion
with the `frontend/` app).

## Path-based tenant URLs

- Madrasa Admin (in `admin/`): fixed `/login` — which tenant you're managing
  comes from the madrasa code entered on the login form, not a URL segment.
- Guardian (in `frontend/`): `/:madrasaSlug/guardian/login`,
  `/:madrasaSlug/guardian/dashboard`
- Public Website (in `frontend/`): `/:madrasaSlug`

`frontend/` reads the first URL segment as the tenant slug and sends it to
the backend with the `X-Madrasa-Slug` header. `admin/`'s print routes read
the same slug from their own URL segment (`/:madrasaSlug/print/reports/*`).

## Custom domains

### Institution admin domains

`Madrasa.adminDomain` is an optional, unique hostname for the **admin** app,
separate from the public website's `customDomain`. Set or clear it in Super
Admin → Institutions → Edit → Custom admin panel domain. For example, route
`school.example.com` to `frontend` and `admin.school.example.com` to `admin`.
The shared admin URL continues to accept institution-code login even when a
custom admin domain is connected. Clearing the field removes that domain's
institution mapping; it does not remove the institution or its accounts.

Before rollout, run `npm exec prisma migrate deploy` and `npm exec prisma generate`
from `backend/`, then rebuild/deploy the backend, admin and super-admin apps.
The migration adds nullable `madrasas.admin_domain`, so existing institutions
continue using the shared login without configuration.

Point the custom hostname's DNS at the admin deployment, configure its reverse
proxy to preserve `Host`, and issue an HTTPS certificate for that hostname.
Serve the admin with its Docker image or `npm start --workspace=admin` after
building; the legacy static Nginx configuration omits domain-specific link
preview metadata. Build with an absolute public `VITE_API_URL` reachable from
every institution domain. The admin server uses the emitted API configuration;
set `INTERNAL_API_URL` to an internal absolute API base ending in `/api` when
needed. `PUBLIC_API_URL` can override the server's public icon URL base.
Allow the shared admin origin in the API's normal CORS settings; connected
institution origins are accepted automatically (CORS cache TTL: 60 seconds).
On connected admin domains, authenticated API calls use the admin server's
same-origin `/api` proxy. It streams requests and responses, preserves refresh
cookies, and derives the upstream origin from the incoming hostname. Keep
`/api/*` routed to this server, or configure an equivalent reverse proxy that
preserves the institution origin. This avoids relying on third-party cookies.

`GET /api/website/resolve-admin-domain` resolves the browser's `Origin`, falling
back to `Host` for non-browser requests, and exposes only name, slug and logo.
It does not depend on public website availability. The admin waits for this
lookup before displaying login or the dashboard, filters saved accounts to the
institution, and omits the institution-code field on connected domains.
Tenant middleware also binds requests to that domain before considering slug
headers; authenticated token ownership and subscription restrictions still
apply. Sessions saved for another institution are cleared before rendering.

Connected admin domains use Branding Settings' institution name/logo for login,
browser title, favicon, PWA name/icons and server-rendered link previews. No
platform logo is substituted if the institution has no logo. Platform promotion
cards and the vendor About entry are hidden there. Shared-domain branding and
login retain their existing behavior. Public website domains remain independent.

### Public website domains

A madrasa can optionally connect its own domain (`Madrasa.customDomain`,
set by the super admin via the madrasa edit form — see
`super-admin/src/features/super-admin/madrasa-management/SuperAdminMadrasasPage.tsx`).
Once set:

- Visiting that domain directly serves the madrasa's public website at root
  `/` — `frontend/`'s `RootRoute` component calls the backend's
  `GET /api/website/resolve-domain` (reads the `Host` header, looks up
  `Madrasa.customDomain`) to learn which tenant owns the domain, since
  there's no slug in the URL there.
- Visiting the same madrasa's old `/:madrasaSlug` URL on the platform's own
  domain auto-redirects to the custom domain instead (`useCustomDomainRedirect`
  in `frontend/src/utils/`), so the platform URL keeps working as a stable
  link while the custom domain becomes the real one people land on.
- The guardian portal also works on a connected custom domain, at the
  bare (no-slug) paths `/guardian/*` -
  `CustomDomainTenantGate` (a pathless layout route in
  `frontend/src/app/router.tsx`) resolves the tenant from the hostname
  before rendering any of them, the same way `RootRoute` does for `/`. Every
  page that needs the tenant slug reads it via `useTenantSlug()`
  (`frontend/src/utils/useTenantSlug.ts`) instead of `useParams()` directly,
  so it works under both the `/:madrasaSlug/...` and bare route trees
  without caring which one matched. A literal `admission`/`guardian`
  segment always wins over the dynamic `:madrasaSlug` pattern regardless of
  where each is declared - React Router ranks matches by specificity
  (static segment beats dynamic), not array order - so a madrasa can't
  accidentally make its own public page unreachable by taking one of those
  words as its slug.

Backend-side, this needs a request's origin/host matched against
`Madrasa.customDomain` in three places: `shared/middleware/tenant.middleware.ts`
(defense-in-depth slug resolution for any request that reaches an API route
without the usual `X-Madrasa-Slug` header), `core/app.ts`'s CORS `origin`
callback (a connected custom domain isn't in the static `CORS_ORIGINS`
whitelist, so it's allowed dynamically via a short-TTL cache — see
`shared/config/customDomainCache.ts`), and `modules/public-website/website.controller.ts`'s
`resolveDomain` handler.

**Operational note**: none of the above provisions DNS or TLS — an operator
still has to point each custom domain's DNS at wherever `frontend/`'s
container is hosted (its frontend server accepts any hostname) and
terminate TLS for it (a wildcard cert only covers the
platform's own domain, not tenant-owned domains — use a reverse proxy that
automates per-domain certs, e.g. Caddy or Traefik + Let's Encrypt, or issue
certs manually per connected domain).

## Running locally

```
npm run dev:admin        # :5181
npm run dev:super-admin  # :5182
npm run dev:frontend     # :5183
```
Or from the repo root, `npm run dev` starts the backend plus all three.

Backend `CORS_ORIGINS` must list every origin that will call it (see
`backend/.env.example`).

## Deploying

Each app has its own `Dockerfile`. Admin and super-admin use nginx;
frontend uses `frontend/server/index.mjs` to serve assets and insert each
institution's share metadata into HTML before sending it to browsers and
Facebook/WhatsApp crawlers. The build context for all
three must be the repo root (not the app subfolder), so the shared package
and root lockfile are visible:

```
docker build -f admin/Dockerfile -t madrasha-admin .
docker build -f frontend/Dockerfile -t madrasha-frontend .
docker build -f super-admin/Dockerfile -t madrasha-super-admin .
```

Point each container at its own subdomain and set the backend's
`CORS_ORIGINS` / `ADMIN_BASE_URL` (and `INTERNAL_ADMIN_URL` for PDF export) accordingly, and set `admin`'s
`VITE_PUBLIC_SITE_URL` build-time variable to `frontend/`'s public origin.
`frontend/` additionally needs `VITE_PLATFORM_ROOT_HOST` set to its own
public domain (e.g. `ems.hikmahit.com`) so it can tell the platform's own
domain apart from a tenant's connected custom domain — see "Custom domains"
above.

Institution link previews require **both backend and frontend to be rebuilt
and deployed**. Do not serve frontend `dist/` directly with static-only
hosting or the old nginx config: this bypasses per-request metadata. Outside
Docker, run `npm run build --workspace=frontend`, then
`npm run start --workspace=frontend` (port 5183; override with `PORT`).
The Docker image continues listening on port 80. `npm run dev:frontend` also
renders institution metadata during development. `vite preview` is for static
bundle inspection only.

The frontend build retains `VITE_API_URL` and `VITE_PLATFORM_ROOT_HOST` for
server metadata requests. Runtime `PUBLIC_API_URL` and `PLATFORM_ROOT_HOST`
can override those server values; client JavaScript still uses build-time
values. Optional `INTERNAL_API_URL` (including `/api`, e.g.
`http://backend:5000/api`) sends server metadata requests directly to the
backend while social image URLs continue using the public API address.
The API must be reachable by the frontend server and image URLs must be
publicly reachable. Logos come from each institution's Branding Settings;
institutions without a logo have no preview image. Metadata responses are
not cached by the frontend. Social networks may retain previews already
scraped before deployment and require their preview cache to be refreshed.

## Document designer

```txt
packages/shared-ui/src/components/DocumentDesigner/   Canvas-based layout editor
  (layers, elements, render engine) — used by both the admin app's template
  library (talimat/reports) and the super-admin app's system-template editor.
```

Reachable at Talimat -> Settings -> Documents (`talimat/settings/documents`,
editor at `talimat/settings/documents/:type/:id/edit`) in the admin app, and
at `/document-templates` in the super-admin app.

## Global Back & Refresh (`packages/shared-ui/src/navigation/`)

One implementation shared by admin, super-admin and the frontend's guardian
portal. Each shell layout renders `<PageNavBar>` (Back · breadcrumbs · Refresh)
instead of a bare `<Breadcrumbs>`, so desktop, mobile browser and installed PWA
get identical controls.

- **Back** (`GlobalBackButton`, `navHistory.ts`): `navigate(-1)` when React
  Router's history has an earlier entry of this app (`history.state.idx > 0`)
  whose path is not an auth page; otherwise `replace`s to the app's dashboard.
  Browser Back, Alt+Left and Android system Back pop the same stack, so they
  stay consistent. Nothing intercepts Alt+Left / Ctrl+R / F5.
- **Refresh** (`GlobalRefreshButton`, `refreshStore.ts`): click = soft refresh -
  app-level refreshers registered with `useRegisterRefresher` run (admin clears
  `cachedGet`'s cache and reloads sidebar/plan/profile/branding), then the
  route outlet remounts via `refreshKey` so every page refetches. A page that
  can refetch in place may call `usePageRefresh(fn)` to replace the remount.
  Shift+click / long-press = full `location.reload()`. One refresh runs at a
  time; the session token is never touched.
- **Unsaved changes** (`unsavedChanges.ts`, `NavigationController`): a form
  page calls `useUnsavedChangesGuard(isDirty)`. While dirty: `beforeunload`
  warning, `useBlocker` confirmation on in-app navigation / Back, and a
  confirmation before Refresh. Currently wired into AdmissionPage, TeacherPage
  and StaffPage - add the one-line hook to any other form.

## Favicon & PWA icons (per madrasa)

A madrasa's favicon, apple-touch-icon and PWA icons are its **Branding Settings
logo** (`madrasa.reportLogo`) - nothing else, and never a platform default.

- Backend: `GET /api/website/public/:slug/icon/:file` (public, see
  `backend/src/modules/public-website/brand-icon.service.ts`) renders PNGs from
  the logo: `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`,
  `icon-512.png`, `maskable-512.png`. No logo => 404 => the madrasa has no icon.
- `packages/shared-ui/src/pwa/brandIcons.ts` builds the icon URLs
  (`?v=<hash of the logo>` busts caches when the logo changes or is removed) and
  rewrites the `<link rel="icon">` tags; `setPwaManifest()` puts the same icons
  into the runtime manifest.
- `admin/`: `src/utils/brandIcons.ts` follows the logged-in madrasa's branding
  store, so saving/replacing/deleting the logo updates the icons immediately.
- `frontend/`: `src/utils/pwaManifest.ts` (`setTenantBrand`) does the same for a
  madrasa's public website / admission pages. Only the platform's own landing
  page keeps the static `/icons/*` files.

## Favicon & PWA icons (main admin panel = Super Admin logo)

The `admin/` app's favicon, apple-touch-icon and PWA icons are the **Admin Panel
Logo** the Super Admin sets in *Super Admin -> Settings*. It is platform-wide and
completely independent of any madrasa's Branding Settings logo (which is never
read or changed by it). No logo => no icon at all, never a default.

- Backend: table `platform_brand_settings` (singleton, `admin_logo` = normalised
  PNG data URI). Super Admin API: `GET/PUT/DELETE /api/super/platform-settings/logo`.
  Public: `GET /api/platform-brand` (`{ data: { version | null } }`) and
  `GET /api/platform-brand/icon/:file` (same PNG set as the per-madrasa icons,
  rendered by `renderBrandIcon`; 404 when no logo). Code:
  `backend/src/modules/super-admin/platform-brand.*`.
- `admin/src/utils/brandIcons.ts` reads `/platform-brand`, then rewrites the
  `<link rel="icon">` tags and the runtime manifest via `setPwaManifest()` with
  `?v=<version>` URLs. Changing/removing the logo changes the version, so the
  favicon and manifest icons update (it re-checks on focus, when the tab becomes
  visible, when back online, and every 5 minutes).
- `frontend/` (a madrasa's public website) is unchanged: it still uses that
  madrasa's own logo via `/website/public/:slug/icon/:file`.

## Runtime academic ownership and local numbers

Super Admin `Division`, `Class`, and `Book` rows (`ownerMadrasaId = null`)
are templates. New institutions snapshot selected templates into private
rows (`ownerMadrasaId = tenant.id`, `sourceTemplateId = original.id`).
Classes reference the private division, and books reference the private class.
Common modules, permissions, plans, and default templates remain platform data.

Operational APIs and foreign keys continue to use globally unique IDs.
`madrasa_divisions`, `madrasa_classes`, `madrasa_books`, and `exams` also have `local_no`,
starting at 1. Division and exam numbers are unique within the institution;
class numbers are unique within an institution and division, and subject numbers
within an institution and class. These are public numbers, separate from
`sort_order` and database IDs. PostgreSQL insert
triggers use `academic_sequences` to serialize allocation. After the
`20261121000000_reuse_deleted_academic_local_numbers` migration, each new record
gets the smallest available positive number. Hard deletion frees that local
number; inactive/trash rows reserve theirs until permanently removed. Surviving
records keep their numbers, and database IDs are never recycled. Settings screens
display `local_no`.

`20261121020000_parent_scoped_academic_numbers` renumbers existing class and subject
display numbers by parent, preserving primary IDs and every academic reference.
`local_scope_id` is maintained by database triggers from `Class.divisionId` or
`Book.classId`; applications do not supply it. Classes with no division use scope
0. Moving a class/subject to another parent allocates a free number there. The
composite unique indexes enforce the institution, parent, and number combination.

Existing installations must apply both November 20, 2026 migrations before
running the updated backend (`cd backend; npx.cmd prisma migrate deploy`, then
`npx.cmd prisma generate`). Stop the backend and take a database backup first.
The `20261120010000_private_integer_academic_snapshots` migration copies existing shared
academic records, remaps tenant foreign keys and historical scalar references,
and preserves names, marks, registration blocks, inactive/trash rows, and exams.

Academic Excel guides and editable reference cells use `local_no`. New workbooks
carry a hidden, versioned `__AcademicIds` sheet; `ExcelUpload` resolves those local
numbers to the original API IDs before preview and submission. Unmarked legacy
workbooks retain their original ID format. `/api/academic-references` supplies
tenant-scoped references, including inactive/trash entries, for bulk-update
exports so historical values can round-trip without changing their meaning.
Version 2 maps include parent scopes: a current class number is resolved with the
row's academic division, and subject numbers with the resolved class. Previous
class cells use the guide's `division/class` Excel code to distinguish identical
numbers in different divisions. Version 1 embedded maps remain supported, even
after display numbers change. Ambiguous values are rejected before submission.

Student, teacher and staff registration numbers also fill the smallest available
hole, counting trash rows as occupied. Student numbers stay within each class's
registration block; classes without a block allocate above all reserved blocks.
The historical `regNoLastIssued` does not prevent reuse of an available number.
Staff have the same restore/permanent-delete/retention workflow in Trash.

The `20261121010000_reusable_institution_numbers` migration adds `Madrasa.madrasaNo`.
Existing institutions keep their previous ID as their displayed number; new ones
take the smallest free platform-wide number. Hard deletion frees the displayed
number, while trash reserves it. API routes, authentication and foreign keys
continue to use the immutable tenant primary key, preventing old tenant sessions
from referring to a newly created institution with a recycled displayed number.
