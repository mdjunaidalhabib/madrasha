-- Store the student's roll number at the time each result was processed.
-- students.roll is overwritten every academic year on promotion, so
-- marksheets/result notices for past exams were silently showing the
-- student's *current* roll instead of the roll they had during that exam.
ALTER TABLE "results_summary" ADD COLUMN "roll" INTEGER;

-- Best-effort backfill for existing rows from the student's current roll.
-- From this migration forward, new rows always store the roll captured at
-- processing time (see ResultPanelService.processResult).
UPDATE results_summary rs
SET roll = s.roll
FROM students s
WHERE rs.student_id = s.id;
