-- A fail grade (general "F", madrasa "রাসিব") is not a grade band: failed
-- students automatically receive it as a fallback label. Remove the legacy
-- rows that were seeded/provisioned as ordinary bands. Nothing references
-- grade rows by FK (result_summaries stores the grade as a string), so a plain
-- DELETE is safe.
DELETE FROM "general_grades" WHERE "name" = 'F';
DELETE FROM "madrasa_grades" WHERE "name" = 'রাসিব';
DELETE FROM "default_general_grades" WHERE "name" = 'F';
DELETE FROM "default_madrasa_grades" WHERE "name" = 'রাসিব';
