# Frontend Architecture

The client side is an npm-workspaces setup with 4 independently-deployable
apps sharing one package, so each can run on its own subdomain/origin. The
workspace root is the repo root itself (see root `package.json`) — `backend/`
stays a separate npm project with its own lockfile and is not part of this
workspace.

> Naming note: one of the four apps is literally named `frontend/`. That's
> a specific app (the public-facing one, described below), not a synonym
> for "the client side" in general — this doc uses "the client side" for
> the general sense and `` `frontend/` `` (with the path) for the specific app.

```txt
packages/
  shared-ui/        @madrasha/shared-ui — design system (components/ui), the
                     DocumentDesigner canvas engine, toast/theme/confirm
                     stores, apiConfig, a couple of shared utils. No build
                     step: apps import its .ts/.tsx source directly via
                     `@madrasha/shared-ui/src/...`. Depended on by admin,
                     frontend and super-admin — landing has zero shared-ui usage.
landing/             Marketing site (QmsLandingPage) — dev port 5180. Owns
                      only `/`. No API/store usage, fully standalone.
admin/                Tenant admin dashboard + staff-only print/report views.
                      Dev port 5181. Owns `/` (dashboard), `/login`, and the
                      legacy `/admin/login` `/admin/*` redirects, plus
                      `/:madrasaSlug/print/reports/*` (rendered by the
                      backend's headless-browser PDF export, not visited by
                      the public).
frontend/             Everything a non-staff visitor of a madrasa hits: the
                      public website, admission form, guardian portal, and
                      attendance kiosk. Dev port 5183. Owns `/:madrasaSlug`,
                      `/m/:madrasaSlug(/admission)`, `/:madrasaSlug/admission`,
                      `/:madrasaSlug/guardian/*`, `/:madrasaSlug/kiosk`. Split
                      out of admin so each madrasa's public-facing pages can
                      eventually move to their own custom domain without
                      touching the admin dashboard's deploy.
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
guardian portal, admission form, kiosk) were split again into `frontend/`, so
that piece can move to per-madrasa custom domains later without redeploying
the admin dashboard.

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

## Running locally

```
npm run dev:landing      # :5180
npm run dev:admin        # :5181
npm run dev:super-admin  # :5182
npm run dev:frontend     # :5183
```
Or from the repo root, `npm run dev` starts the backend plus all four.

Backend `CORS_ORIGINS` must list every origin that will call it (see
`backend/.env.example`).

## Deploying

Each app has its own `Dockerfile` + `nginx.conf`. The build context for all
four must be the repo root (not the app subfolder), so the shared package
and root lockfile are visible:

```
docker build -f landing/Dockerfile -t madrasha-landing .
docker build -f admin/Dockerfile -t madrasha-admin .
docker build -f frontend/Dockerfile -t madrasha-frontend .
docker build -f super-admin/Dockerfile -t madrasha-super-admin .
```

Point each container at its own subdomain and set the backend's
`CORS_ORIGINS` / `FRONTEND_BASE_URL` accordingly, and set `admin`'s
`VITE_PUBLIC_SITE_URL` build-time variable to `frontend/`'s public origin.

## Document designer

```txt
packages/shared-ui/src/components/DocumentDesigner/   Canvas-based layout editor
  (layers, elements, render engine) — used by both the admin app's template
  library (talimat/reports) and the super-admin app's system-template editor.
```

Reachable at Talimat -> Settings -> Documents (`talimat/settings/documents`,
editor at `talimat/settings/documents/:type/:id/edit`) in the admin app, and
at `/document-templates` in the super-admin app.
