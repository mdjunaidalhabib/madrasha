# Update Notes

## Fixed

- Reports menu restored in Madrasa Admin sidebar.
- Report route mapping fixed for `reports`, `report`, `acadamic-report`, `academic-report`, `student_report`, and `teacher_report`.
- Madrasa Admin website settings page expanded.
- Madrasa Admin can now update public website name, phone, email, address, logo URL, hero/banner title, hero subtitle, theme color, publish status, section visibility, about/admission/contact page content, notices, and gallery image URLs.
- Public website now renders Madrasa Admin controlled sections dynamically.

## After extracting

Run the database migration in `backend/migrations/002_admin_website_builder.sql` if your existing database does not already have these new columns/tables.

## 2026-05-10 admin menu/report/public website fixes

- Removed duplicate report menu rendering by filtering dynamic `report/reports` module keys and rendering one professional report group only.
- Moved Madrasa Admin `ওয়েবসাইট সেটিংস` to a pinned bottom sidebar position, visible only when website module is enabled.
- Added report module alias support (`report` and `reports`) so report pages open even if the database/module key uses either name.
- Fixed unauthorized module redirect to stay inside the current madrasa admin dashboard instead of going to `/`.
- Preserved old typo route `/reports/acadamic-report` as a redirect to `/reports/academic-report`.

## 2026-07-20 dynamic subject-based result synchronization

- Subject deletion now checks whether linked marks actually exist before choosing the confirmation message.
- Subject lists are refreshed immediately after add, update, or delete operations through the existing GET-cache invalidation flow.

## 2026-07-20 subject rename and guarded deletion adjustment

- Renaming a subject now changes only its displayed name, without recalculating results.
- Before deletion, the UI requests a fresh count of saved marks for the selected subject.
- When marks exist, the confirmation dialog shows the number of entries and warns that all of them will be permanently deleted with the subject.
- When no marks exist, a normal subject deletion confirmation is shown.
