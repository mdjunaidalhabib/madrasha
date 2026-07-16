# Update Notes

## Fixed / Added

- Admin website builder backend endpoints added.
- Madrasa Admin can save website settings, pages, notices, and gallery items.
- Public website API now returns settings, pages, notices, optional teachers, and gallery data.
- Super Admin website status control remains supported.

## Existing database migration

Run `migrations/002_admin_website_builder.sql` if your database is old and missing `website_settings.show_about`, `website_settings.show_contact`, or `website_gallery`.

## 2026-05-10 admin menu/report/public website fixes

- Ordered sidebar modules so website settings can be rendered at the bottom in Madrasa Admin UI.
- Swapped report route middleware order to resolve tenant first, then auth, matching tenant-scoped admin requests.
- Removed sensitive login debug logs from madrasa admin and super admin authentication flows.
- Added `website` module seed entry and corrected `academic_report` feature key in schema.
- Removed duplicate `admit_card` feature seed row from schema.
