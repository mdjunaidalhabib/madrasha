# Madrasa Backend

Production-ready Express + TypeScript + MySQL backend for the multi-tenant Madrasa SaaS platform.

## Main features

- Super Admin panel for platform owner/developer
- Madrasa Admin panel for each madrasa management team
- JWT authentication and role/module-based access
- Student, teacher, accounts, reports and talimat modules
- Public website API for each madrasa using its slug
- Website enable/limited/disabled control by Super Admin
- Secure CORS, Helmet, rate limiting, 404 and global error handler

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Import `schema.sql` into MySQL before running the app. For an existing database, run `migrations/001_website_updates.sql` once before using website features.

## Important environment values

- `JWT_SECRET`: long random secret
- `CORS_ORIGIN`: frontend URL, for example `http://localhost:5173`
- `ROOT_DOMAIN`: base domain for tenant subdomains in production

## API groups

- `/api/super-admin/*` Super Admin auth
- `/api/super/*` Super Admin management
- `/api/auth/*` Madrasa Admin/user auth
- `/api/website/public/:slug` Public madrasa website data
- `/api/website/admin/settings` Madrasa website settings
