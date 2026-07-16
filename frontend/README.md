# Madrasa Frontend

React + TypeScript + Vite frontend for a multi-tenant Madrasa SaaS platform.

## Main sections

- `/super-admin/*` — platform owner/developer control panel
- `/admin/*` — madrasa management/admin panel
- `/m/:slug` — public website for each madrasa
- `/dashboard` and existing module routes — student, teacher, talimat, reports, accounts

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_API_URL` to your backend API URL.

## Professional updates included

- API base URL uses `VITE_API_URL`
- Super Admin layout separated from Madrasa Admin layout
- Public madrasa website starter page
- Website settings page for madrasa admins
- 404 page and corrected `academic-report` route
- Stronger auth store typing
