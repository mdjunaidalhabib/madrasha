# Frontend Architecture

The frontend is an npm-workspaces monorepo with 3 independently-deployable apps sharing one package, so each can run on its own subdomain/origin.

```txt
frontend/
  packages/
    shared-ui/        @madrasha/shared-ui — design system (components/ui), the
                       DocumentDesigner canvas engine, toast/theme/confirm
                       stores, apiConfig, a couple of shared utils. No build
                       step: apps import its .ts/.tsx source directly via
                       `@madrasha/shared-ui/src/...`. Depended on by admin and
                       super-admin only — landing has zero shared-ui usage.
  apps/
    landing/           Marketing site (QmsLandingPage) — dev port 5180. Owns
                        only `/`. No API/store usage, fully standalone.
    admin/              Tenant admin dashboard + guardian portal + each
                        madrasa's public website + admission form + kiosk +
                        print-only report views. Dev port 5181. Owns
                        `/:madrasaSlug/*`, `/m/:madrasaSlug`, and the legacy
                        `/login` `/admin/login` `/admin/*` redirects. Root `/`
                        redirects to `/login`.
    super-admin/        Platform-owner panel. Dev port 5182. Root-relative
                        (`/login`, `/dashboard`, `/madrasas`, ... — no
                        `/super-admin` prefix, since this app owns its own
                        origin now).
```

## Why 3 apps instead of 1

Originally a single SPA served all three areas from one origin via path
prefixes (`/`, `/super-admin/*`, `/:madrasaSlug/*`). To deploy each on its own
subdomain with independent builds/releases, the app was split along its
natural seams — an audit found almost no cross-imports between the three
areas beyond a small, well-defined shared surface (see `packages/shared-ui`).

## Path-based tenant URLs (unchanged within the admin app)

- Madrasa Admin: `/:madrasaSlug/admin/login`, `/:madrasaSlug/admin/dashboard`
- Guardian: `/:madrasaSlug/guardian/login`, `/:madrasaSlug/guardian/dashboard`
- Public Website: `/:madrasaSlug`

The frontend reads the first URL segment as the tenant slug and sends it to
the backend with the `X-Madrasa-Slug` header.

## Running locally

```
npm run dev:landing --prefix frontend      # :5180
npm run dev:admin --prefix frontend        # :5181
npm run dev:super-admin --prefix frontend  # :5182
```
Or from the repo root, `npm run dev` starts the backend plus all three.

Backend `CORS_ORIGINS` must list every origin that will call it (see
`backend/.env.example`).

## Deploying

Each app has its own `Dockerfile` + `nginx.conf`. The build context for all
three must be `frontend/` (the workspace root), not the app subfolder, so the
shared package and root lockfile are visible:

```
docker build -f frontend/apps/landing/Dockerfile -t madrasha-landing frontend/
docker build -f frontend/apps/admin/Dockerfile -t madrasha-admin frontend/
docker build -f frontend/apps/super-admin/Dockerfile -t madrasha-super-admin frontend/
```

Point each container at its own subdomain and set the backend's
`CORS_ORIGINS` / `FRONTEND_BASE_URL` accordingly.

## Document designer

```txt
packages/shared-ui/src/components/DocumentDesigner/   Canvas-based layout editor
  (layers, elements, render engine) — used by both the admin app's template
  library (talimat/reports) and the super-admin app's system-template editor.
```

Reachable at Talimat -> Settings -> Documents (`talimat/settings/documents`,
editor at `talimat/settings/documents/:type/:id/edit`) in the admin app, and
at `/document-templates` in the super-admin app.
