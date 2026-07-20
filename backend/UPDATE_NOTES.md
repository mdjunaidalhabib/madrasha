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

## 2026-07-20 dynamic subject-based result synchronization

- Result calculations now include only subjects currently active for the madrasa.
- Adding or deleting a subject rebuilds affected result sessions for that class and returns them to Draft status for review.
- Renaming a subject updates only the subject name; it does not recalculate totals, averages, grades, pass/fail status, ranks, or publication status.
- Deleting a subject removes that madrasa's obsolete marks before totals, averages, grades, pass/fail status, and ranks are recalculated.
- Shared catalogue subjects now use tenant-safe copy-on-write when renamed, so one madrasa cannot rename a subject for other madrasas.
- Result entry, full-result preview, single-student editing, and printable reports all resolve their columns from the active subject list.

## 2026-07-20 subject rename and guarded deletion adjustment

- Subject rename no longer triggers result recalculation.
- Added a fresh mark-count check before subject deletion.
- The backend rejects deletion of a subject containing marks unless explicit mark-deletion confirmation is supplied.
- Confirmed deletion removes the subject marks and then recalculates affected result sessions.
