-- Per-subject pass mark override, tenant-specific like full_mark/is_miyari.
-- NULL (the default for every existing row) means: keep following the
-- madrasa's global fail_mark setting for this subject, unchanged from
-- today's behaviour. Only subjects that need a different pass threshold
-- than the global setting (e.g. a 100-mark তেলাওয়াত subject passing at 50,
-- or 50-mark হেফজ subjects passing at 20/25) get an explicit value here.
ALTER TABLE "madrasa_books"
ADD COLUMN "pass_mark" INTEGER;
