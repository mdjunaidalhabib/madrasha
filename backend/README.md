# Madrasa Backend

Production-ready Express + TypeScript + PostgreSQL backend for the multi-tenant Madrasa SaaS platform.

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

Set `DATABASE_URL` in `.env` to a PostgreSQL connection string, e.g.
`postgresql://postgres:password@localhost:5432/madrasha`, then run
`npx prisma migrate dev` to create the schema (Prisma is the single
source of truth now — there's no `schema.sql` to import manually).

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
