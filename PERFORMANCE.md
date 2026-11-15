# Panel performance and PWA

The admin and super-admin builds split routes, charts and spreadsheet tools.
Opening login does not download Excel or chart code. Menu hover/focus can load
the selected route in advance, except on offline, data-saver or 2G connections.
During the initial subscription check, admin downloads the selected route's
code without mounting it or starting its API effects.

Dashboard cards render independently of charts. Charts and document-template
previews mount as they approach the viewport. The dashboard overdue-fee query
aggregates all qualifying invoices in PostgreSQL and returns a bounded list of
student balances; the list limit never limits totals. Rejected admissions are
excluded, while pending admissions and waived amounts keep their existing rules.

## PWA and deployment

Both panel builds generate a versioned service worker. Installation caches
only the entry shell and UI font. Other build assets are cached when requested,
with a maximum of 100 runtime files. APIs, uploads and print routes are excluded.
Offline launches restore the shell and show a connection notice. Viewing fresh
records and saving changes still require a connection; this is not offline data
editing or synchronization.

New workers wait for tabs using the previous release to close. Activation clears
only caches owned by the same panel. Content-hashed assets and the versioned font
are immutable; HTML, the worker and manifests revalidate. Stable public font URLs
cache for one day. Deploy the included Nginx configurations with the built files.

Panel install icons use the platform logo configured by the super admin. The
existing policy of no fallback logo is preserved. Production installation needs
HTTPS (localhost is allowed for development) and a configured platform logo.
The public frontend keeps its existing tenant-branded PWA behavior.

## Verification

Run from the repository root after installing root and backend dependencies:

```sh
npm run check:performance
npm run build --prefix backend
npm test --prefix backend
```

The performance command builds both panels and uses Chromium with local fixture
APIs. It verifies the dependency graph, initial byte budgets, subscription gate,
parallel route download, deferred charts/previews, offline launch and exclusion
of private API responses from Cache Storage. It makes no changes to real accounts
or databases. Initial JS/CSS budgets are 200 KB gzip for admin and 160 KB for super
admin; fonts, HTML, images and API responses are separate.

Local builds and fixture checks do not measure live-server response times or
database query latency. Validate production headers and mobile network timings
after deployment. No database migration is required by these changes.
