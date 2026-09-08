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
                      website, admission form, guardian portal, and
                      attendance kiosk. Dev port 5183. Root `/` is
                      hostname-aware (see `src/features/landing/RootRoute.tsx`):
                      on the platform's own domain (`VITE_PLATFORM_ROOT_HOST`)
                      it renders the landing page; on any other hostname
                      (a tenant's connected custom domain) it resolves and
                      renders that tenant's public website instead. Also owns
                      `/:madrasaSlug`, `/m/:madrasaSlug(/admission)`,
                      `/:madrasaSlug/admission`, `/:madrasaSlug/guardian/*`,
                      `/:madrasaSlug/kiosk` — path-based access for madrasas
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
public website" card, the website builder's preview link, and the kiosk
device setup page's kiosk URL) via `admin/src/utils/publicSiteUrl.ts`, which
reads `VITE_PUBLIC_SITE_URL` — this must be set to `frontend/`'s real origin
in every environment (see `admin/.env`). It's deliberately not named
`VITE_FRONTEND_*`: the backend already has an unrelated `FRONTEND_BASE_URL`
env var that points at the `admin/` app (a historical name that predates the
`frontend/` app existing) — reusing "frontend" in the admin-side var name
would read as the same thing and isn't.

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
- The guardian portal and attendance kiosk also work on a connected custom
  domain, at the bare (no-slug) paths `/guardian/*` and `/kiosk` -
  `CustomDomainTenantGate` (a pathless layout route in
  `frontend/src/app/router.tsx`) resolves the tenant from the hostname
  before rendering any of them, the same way `RootRoute` does for `/`. Every
  page that needs the tenant slug reads it via `useTenantSlug()`
  (`frontend/src/utils/useTenantSlug.ts`) instead of `useParams()` directly,
  so it works under both the `/:madrasaSlug/...` and bare route trees
  without caring which one matched. A literal `admission`/`guardian`/`kiosk`
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
container is hosted (its nginx `server_name _;` already accepts any
hostname) and terminate TLS for it (a wildcard cert only covers the
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

Each app has its own `Dockerfile` + `nginx.conf`. The build context for all
three must be the repo root (not the app subfolder), so the shared package
and root lockfile are visible:

```
docker build -f admin/Dockerfile -t madrasha-admin .
docker build -f frontend/Dockerfile -t madrasha-frontend .
docker build -f super-admin/Dockerfile -t madrasha-super-admin .
```

Point each container at its own subdomain and set the backend's
`CORS_ORIGINS` / `FRONTEND_BASE_URL` accordingly, and set `admin`'s
`VITE_PUBLIC_SITE_URL` build-time variable to `frontend/`'s public origin.
`frontend/` additionally needs `VITE_PLATFORM_ROOT_HOST` set to its own
public domain (e.g. `qms.hikmahit.com`) so it can tell the platform's own
domain apart from a tenant's connected custom domain — see "Custom domains"
above.

## Document designer

```txt
packages/shared-ui/src/components/DocumentDesigner/   Canvas-based layout editor
  (layers, elements, render engine) — used by both the admin app's template
  library (talimat/reports) and the super-admin app's system-template editor.
```

Reachable at Talimat -> Settings -> Documents (`talimat/settings/documents`,
editor at `talimat/settings/documents/:type/:id/edit`) in the admin app, and
at `/document-templates` in the super-admin app.
