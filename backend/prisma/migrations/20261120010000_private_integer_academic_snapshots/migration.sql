BEGIN;

ALTER TABLE "divisions" ADD COLUMN "source_template_id" INTEGER;
ALTER TABLE "classes" ADD COLUMN "source_template_id" INTEGER;
ALTER TABLE "books" ADD COLUMN "source_template_id" INTEGER;
CREATE UNIQUE INDEX "uniq_division_owner_template" ON "divisions"("owner_madrasa_id", "source_template_id");
CREATE UNIQUE INDEX "uniq_class_owner_template" ON "classes"("owner_madrasa_id", "source_template_id");
CREATE UNIQUE INDEX "uniq_book_owner_template" ON "books"("owner_madrasa_id", "source_template_id");

-- Collect every existing tenant reference, including inactive/trash/history.
-- The shared Super Admin catalogue and plan/default templates stay shared.
CREATE TEMP TABLE academic_refs (
  kind TEXT NOT NULL, madrasa_id INTEGER NOT NULL, old_id INTEGER NOT NULL,
  PRIMARY KEY (kind, madrasa_id, old_id)
) ON COMMIT DROP;
DO $$
DECLARE ref RECORD;
BEGIN
  FOR ref IN
    SELECT c.conrelid::regclass AS table_name, a.attname AS column_name,
      CASE c.confrelid WHEN 'divisions'::regclass THEN 'division'
        WHEN 'classes'::regclass THEN 'class' ELSE 'book' END AS kind
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND c.confrelid IN ('divisions'::regclass, 'classes'::regclass, 'books'::regclass)
      AND EXISTS (SELECT 1 FROM pg_attribute t WHERE t.attrelid = c.conrelid
        AND t.attname = 'madrasa_id' AND NOT t.attisdropped)
  LOOP
    EXECUTE format('INSERT INTO academic_refs SELECT %L, madrasa_id, %I FROM %s WHERE %I IS NOT NULL ON CONFLICT DO NOTHING',
      ref.kind, ref.column_name, ref.table_name, ref.column_name);
  END LOOP;
END $$;
INSERT INTO academic_refs SELECT 'division', e.madrasa_id, esd.division_id
FROM "exam_divisions" esd JOIN "exams" e ON e.id = esd.exam_id ON CONFLICT DO NOTHING;
INSERT INTO academic_refs SELECT 'class', madrasa_id, from_class_id FROM "promotion_batches" ON CONFLICT DO NOTHING;
INSERT INTO academic_refs SELECT 'class', madrasa_id, to_class_id FROM "promotion_batches" ON CONFLICT DO NOTHING;
INSERT INTO academic_refs SELECT 'class', madrasa_id, class_id FROM "session_attendances" WHERE class_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO academic_refs SELECT 'book', madrasa_id, book_id FROM "result_corrections" WHERE book_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO academic_refs SELECT 'division', owner_madrasa_id, id FROM "divisions" WHERE owner_madrasa_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO academic_refs SELECT 'class', owner_madrasa_id, id FROM "classes" WHERE owner_madrasa_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO academic_refs SELECT 'book', owner_madrasa_id, id FROM "books" WHERE owner_madrasa_id IS NOT NULL ON CONFLICT DO NOTHING;
-- Include parents even when a historical/disabled child has no active link.
INSERT INTO academic_refs SELECT 'class', r.madrasa_id, b.class_id FROM academic_refs r JOIN "books" b ON r.kind = 'book' AND b.id = r.old_id ON CONFLICT DO NOTHING;
INSERT INTO academic_refs SELECT 'division', r.madrasa_id, c.division_id FROM academic_refs r JOIN "classes" c ON r.kind = 'class' AND c.id = r.old_id WHERE c.division_id IS NOT NULL ON CONFLICT DO NOTHING;

CREATE TEMP TABLE academic_map (
  kind TEXT NOT NULL, madrasa_id INTEGER NOT NULL, old_id INTEGER NOT NULL, new_id INTEGER NOT NULL,
  PRIMARY KEY (kind, madrasa_id, old_id)
) ON COMMIT DROP;

INSERT INTO "divisions" (name, name_bn, institution_type, owner_madrasa_id, source_template_id, sort_order, created_at, updated_at)
SELECT d.name, COALESCE(l.name_bn, d.name_bn), d.institution_type, r.madrasa_id, d.id,
  COALESCE(l.sort_order, d.sort_order), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM academic_refs r JOIN "divisions" d ON r.kind = 'division' AND d.id = r.old_id AND d.owner_madrasa_id IS NULL
LEFT JOIN "madrasa_divisions" l ON l.madrasa_id = r.madrasa_id AND l.division_id = d.id;
INSERT INTO academic_map SELECT 'division', owner_madrasa_id, COALESCE(source_template_id, id), id FROM "divisions" WHERE owner_madrasa_id IS NOT NULL;

INSERT INTO "classes" (name, name_bn, division_id, is_active, owner_madrasa_id, source_template_id, sort_order, created_at, updated_at)
SELECT c.name, COALESCE(l.name_bn, c.name_bn), dm.new_id, c.is_active, r.madrasa_id, c.id,
  COALESCE(l.sort_order, c.sort_order), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM academic_refs r JOIN "classes" c ON r.kind = 'class' AND c.id = r.old_id AND c.owner_madrasa_id IS NULL
LEFT JOIN academic_map dm ON dm.kind = 'division' AND dm.madrasa_id = r.madrasa_id AND dm.old_id = c.division_id
LEFT JOIN "madrasa_classes" l ON l.madrasa_id = r.madrasa_id AND l.class_id = c.id;
INSERT INTO academic_map SELECT 'class', owner_madrasa_id, COALESCE(source_template_id, id), id FROM "classes" WHERE owner_madrasa_id IS NOT NULL;

INSERT INTO "books" (name, name_bn, class_id, owner_madrasa_id, source_template_id, sort_order, created_at, updated_at)
SELECT b.name, b.name_bn, cm.new_id, r.madrasa_id, b.id,
  COALESCE(l.sort_order, b.sort_order), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM academic_refs r JOIN "books" b ON r.kind = 'book' AND b.id = r.old_id AND b.owner_madrasa_id IS NULL
JOIN academic_map cm ON cm.kind = 'class' AND cm.madrasa_id = r.madrasa_id AND cm.old_id = b.class_id
LEFT JOIN "madrasa_books" l ON l.madrasa_id = r.madrasa_id AND l.book_id = b.id;
INSERT INTO academic_map SELECT 'book', owner_madrasa_id, COALESCE(source_template_id, id), id FROM "books" WHERE owner_madrasa_id IS NOT NULL;

-- Repoint every real FK with a tenant column, preserving all operational rows.
DO $$
DECLARE ref RECORD;
BEGIN
  FOR ref IN
    SELECT c.conrelid::regclass AS table_name, a.attname AS column_name,
      CASE c.confrelid WHEN 'divisions'::regclass THEN 'division'
        WHEN 'classes'::regclass THEN 'class' ELSE 'book' END AS kind
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND c.confrelid IN ('divisions'::regclass, 'classes'::regclass, 'books'::regclass)
      AND EXISTS (SELECT 1 FROM pg_attribute t WHERE t.attrelid = c.conrelid
        AND t.attname = 'madrasa_id' AND NOT t.attisdropped)
  LOOP
    EXECUTE format('UPDATE %s t SET %I = m.new_id FROM academic_map m WHERE m.kind = %L AND t.madrasa_id = m.madrasa_id AND t.%I = m.old_id AND m.old_id <> m.new_id',
      ref.table_name, ref.column_name, ref.kind, ref.column_name);
  END LOOP;
END $$;
UPDATE "classes" c SET division_id = m.new_id FROM academic_map m WHERE m.kind = 'division' AND c.owner_madrasa_id = m.madrasa_id AND c.division_id = m.old_id AND m.old_id <> m.new_id;
UPDATE "books" b SET class_id = m.new_id FROM academic_map m WHERE m.kind = 'class' AND b.owner_madrasa_id = m.madrasa_id AND b.class_id = m.old_id AND m.old_id <> m.new_id;
UPDATE "exam_divisions" d SET division_id = m.new_id FROM "exams" e, academic_map m WHERE e.id = d.exam_id AND m.kind = 'division' AND e.madrasa_id = m.madrasa_id AND d.division_id = m.old_id AND m.old_id <> m.new_id;
UPDATE "promotion_batches" t SET "from_class_id" = m.new_id FROM academic_map m WHERE m.kind = 'class' AND t.madrasa_id = m.madrasa_id AND t."from_class_id" = m.old_id AND m.old_id <> m.new_id;
UPDATE "promotion_batches" t SET "to_class_id" = m.new_id FROM academic_map m WHERE m.kind = 'class' AND t.madrasa_id = m.madrasa_id AND t."to_class_id" = m.old_id AND m.old_id <> m.new_id;
UPDATE "session_attendances" t SET "class_id" = m.new_id FROM academic_map m WHERE m.kind = 'class' AND t.madrasa_id = m.madrasa_id AND t."class_id" = m.old_id AND m.old_id <> m.new_id;
UPDATE "result_corrections" t SET "book_id" = m.new_id FROM academic_map m WHERE m.kind = 'book' AND t.madrasa_id = m.madrasa_id AND t."book_id" = m.old_id AND m.old_id <> m.new_id;
 
CREATE TABLE "academic_sequences" (
  "madrasa_id" INTEGER NOT NULL REFERENCES "madrasas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "last_value" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("madrasa_id", "kind")
);
ALTER TABLE "madrasa_divisions" ADD COLUMN "local_no" INTEGER;
WITH numbered AS ( SELECT id, ROW_NUMBER() OVER (PARTITION BY madrasa_id ORDER BY (deleted_at IS NULL) DESC, is_active DESC NULLS LAST, sort_order, id)::INTEGER AS n FROM "madrasa_divisions" )
UPDATE "madrasa_divisions" t SET local_no = n.n FROM numbered n WHERE t.id = n.id;
CREATE UNIQUE INDEX "uniq_madrasa_division_local_no" ON "madrasa_divisions" ("madrasa_id", "local_no");
INSERT INTO "academic_sequences" ("madrasa_id", "kind", "last_value") SELECT "madrasa_id", 'division', MAX("local_no") FROM "madrasa_divisions" GROUP BY "madrasa_id";
ALTER TABLE "madrasa_classes" ADD COLUMN "local_no" INTEGER;
WITH numbered AS ( SELECT id, ROW_NUMBER() OVER (PARTITION BY madrasa_id ORDER BY (deleted_at IS NULL) DESC, is_active DESC NULLS LAST, sort_order, id)::INTEGER AS n FROM "madrasa_classes" )
UPDATE "madrasa_classes" t SET local_no = n.n FROM numbered n WHERE t.id = n.id;
CREATE UNIQUE INDEX "uniq_madrasa_class_local_no" ON "madrasa_classes" ("madrasa_id", "local_no");
INSERT INTO "academic_sequences" ("madrasa_id", "kind", "last_value") SELECT "madrasa_id", 'class', MAX("local_no") FROM "madrasa_classes" GROUP BY "madrasa_id";
ALTER TABLE "madrasa_books" ADD COLUMN "local_no" INTEGER;
WITH numbered AS ( SELECT id, ROW_NUMBER() OVER (PARTITION BY madrasa_id ORDER BY (deleted_at IS NULL) DESC, is_active DESC NULLS LAST, sort_order, id)::INTEGER AS n FROM "madrasa_books" )
UPDATE "madrasa_books" t SET local_no = n.n FROM numbered n WHERE t.id = n.id;
CREATE UNIQUE INDEX "uniq_madrasa_book_local_no" ON "madrasa_books" ("madrasa_id", "local_no");
INSERT INTO "academic_sequences" ("madrasa_id", "kind", "last_value") SELECT "madrasa_id", 'book', MAX("local_no") FROM "madrasa_books" GROUP BY "madrasa_id";
ALTER TABLE "exams" ADD COLUMN "local_no" INTEGER;
WITH numbered AS ( SELECT id, ROW_NUMBER() OVER (PARTITION BY madrasa_id ORDER BY (deleted_at IS NULL) DESC, is_active DESC NULLS LAST, sort_order, id)::INTEGER AS n FROM "exams" )
UPDATE "exams" t SET local_no = n.n FROM numbered n WHERE t.id = n.id;
CREATE UNIQUE INDEX "uniq_exam_madrasa_local_no" ON "exams" ("madrasa_id", "local_no");
INSERT INTO "academic_sequences" ("madrasa_id", "kind", "last_value") SELECT "madrasa_id", 'exam', MAX("local_no") FROM "exams" GROUP BY "madrasa_id";
CREATE FUNCTION assign_academic_local_no() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.madrasa_id <> OLD.madrasa_id OR NEW.local_no IS DISTINCT FROM OLD.local_no THEN
      RAISE EXCEPTION 'Institution and local number are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.local_no IS NULL THEN
    INSERT INTO academic_sequences (madrasa_id, kind, last_value)
    VALUES (NEW.madrasa_id, TG_ARGV[0], 1)
    ON CONFLICT (madrasa_id, kind) DO UPDATE
    SET last_value = academic_sequences.last_value + 1
    RETURNING last_value INTO NEW.local_no;
  ELSE
    IF NEW.local_no < 1 THEN RAISE EXCEPTION 'Invalid local number' USING ERRCODE = '23514'; END IF;
    INSERT INTO academic_sequences (madrasa_id, kind, last_value)
    VALUES (NEW.madrasa_id, TG_ARGV[0], NEW.local_no)
    ON CONFLICT (madrasa_id, kind) DO UPDATE
    SET last_value = GREATEST(academic_sequences.last_value, EXCLUDED.last_value);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "var_local_no" BEFORE INSERT OR UPDATE ON "madrasa_divisions" FOR EACH ROW EXECUTE FUNCTION assign_academic_local_no('division');
CREATE TRIGGER "var_local_no" BEFORE INSERT OR UPDATE ON "madrasa_classes" FOR EACH ROW EXECUTE FUNCTION assign_academic_local_no('class');
CREATE TRIGGER "var_local_no" BEFORE INSERT OR UPDATE ON "madrasa_books" FOR EACH ROW EXECUTE FUNCTION assign_academic_local_no('book');
CREATE TRIGGER "var_local_no" BEFORE INSERT OR UPDATE ON "exams" FOR EACH ROW EXECUTE FUNCTION assign_academic_local_no('exam');

CREATE FUNCTION check_academic_link_owner() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE owner_id INTEGER;
BEGIN
  EXECUTE format('SELECT owner_madrasa_id FROM %I WHERE id = $1', TG_ARGV[0])
    INTO owner_id USING (to_jsonb(NEW)->>TG_ARGV[1])::INTEGER;
  IF owner_id IS DISTINCT FROM NEW.madrasa_id THEN
    RAISE EXCEPTION 'Academic record belongs to another institution' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_owner BEFORE INSERT OR UPDATE OF "madrasa_id", "division_id" ON "madrasa_divisions" FOR EACH ROW EXECUTE FUNCTION check_academic_link_owner('divisions', 'division_id');
CREATE TRIGGER check_owner BEFORE INSERT OR UPDATE OF "madrasa_id", "class_id" ON "madrasa_classes" FOR EACH ROW EXECUTE FUNCTION check_academic_link_owner('classes', 'class_id');
CREATE TRIGGER check_owner BEFORE INSERT OR UPDATE OF "madrasa_id", "book_id" ON "madrasa_books" FOR EACH ROW EXECUTE FUNCTION check_academic_link_owner('books', 'book_id');

CREATE FUNCTION check_academic_parent_owner() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_owner INTEGER; parent_id INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.owner_madrasa_id IS DISTINCT FROM OLD.owner_madrasa_id THEN
    RAISE EXCEPTION 'Academic ownership is immutable' USING ERRCODE = '23514';
  END IF;
  parent_id := (to_jsonb(NEW)->>TG_ARGV[1])::INTEGER;
  IF parent_id IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT owner_madrasa_id FROM %I WHERE id = $1', TG_ARGV[0]) INTO parent_owner USING parent_id;
  IF NEW.owner_madrasa_id IS DISTINCT FROM parent_owner THEN
    RAISE EXCEPTION 'Academic parent belongs to another institution' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_parent_owner BEFORE INSERT OR UPDATE OF "owner_madrasa_id", "division_id" ON "classes" FOR EACH ROW EXECUTE FUNCTION check_academic_parent_owner('divisions', 'division_id');
CREATE TRIGGER check_parent_owner BEFORE INSERT OR UPDATE OF "owner_madrasa_id", "class_id" ON "books" FOR EACH ROW EXECUTE FUNCTION check_academic_parent_owner('classes', 'class_id');
COMMIT;
