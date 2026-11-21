BEGIN;

LOCK TABLE madrasa_classes, madrasa_books IN ACCESS EXCLUSIVE MODE;
DROP TRIGGER var_local_no ON madrasa_classes;
DROP TRIGGER var_local_no ON madrasa_books;
DROP INDEX uniq_madrasa_class_local_no;
DROP INDEX uniq_madrasa_book_local_no;

ALTER TABLE madrasa_classes ADD COLUMN local_scope_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE madrasa_books ADD COLUMN local_scope_id INTEGER NOT NULL DEFAULT 0;

-- Change display numbers only. Primary IDs and all academic references stay intact.
WITH numbered AS (
  SELECT mc.id, COALESCE(c.division_id, 0) AS scope,
    ROW_NUMBER() OVER (PARTITION BY mc.madrasa_id, c.division_id ORDER BY mc.local_no, mc.id)::INTEGER AS number
  FROM madrasa_classes mc JOIN classes c ON c.id = mc.class_id
)
UPDATE madrasa_classes mc SET local_scope_id = n.scope, local_no = n.number
FROM numbered n WHERE n.id = mc.id;

WITH numbered AS (
  SELECT mb.id, b.class_id AS scope,
    ROW_NUMBER() OVER (PARTITION BY mb.madrasa_id, b.class_id ORDER BY mb.local_no, mb.id)::INTEGER AS number
  FROM madrasa_books mb JOIN books b ON b.id = mb.book_id
)
UPDATE madrasa_books mb SET local_scope_id = n.scope, local_no = n.number
FROM numbered n WHERE n.id = mb.id;

CREATE UNIQUE INDEX uniq_madrasa_class_local_no ON madrasa_classes (madrasa_id, local_scope_id, local_no);
CREATE UNIQUE INDEX uniq_madrasa_book_local_no ON madrasa_books (madrasa_id, local_scope_id, local_no);

CREATE FUNCTION assign_parent_scoped_academic_no() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  parent_scope INTEGER;
  counter_kind TEXT;
  next_number BIGINT;
BEGIN
  IF TG_ARGV[0] = 'class' THEN
    SELECT COALESCE(division_id, 0) INTO STRICT parent_scope FROM classes WHERE id = NEW.class_id;
  ELSE
    SELECT class_id INTO STRICT parent_scope FROM books WHERE id = NEW.book_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.madrasa_id <> OLD.madrasa_id THEN
      RAISE EXCEPTION 'Institution is immutable' USING ERRCODE = '23514';
    END IF;
    IF parent_scope = OLD.local_scope_id THEN
      IF NEW.local_no IS DISTINCT FROM OLD.local_no OR NEW.local_scope_id <> OLD.local_scope_id THEN
        RAISE EXCEPTION 'Local number and scope are managed by the database' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;
    -- Moving a record to another parent assigns a free number in that parent.
    NEW.local_no := NULL;
  END IF;
  NEW.local_scope_id := parent_scope;
  counter_kind := TG_ARGV[0] || ':' || parent_scope;

  -- Serialize allocations in the same institution and parent, including imports.
  INSERT INTO academic_sequences (madrasa_id, kind, last_value)
  VALUES (NEW.madrasa_id, counter_kind, 0)
  ON CONFLICT (madrasa_id, kind) DO UPDATE SET last_value = academic_sequences.last_value;

  IF NEW.local_no IS NULL THEN
    EXECUTE format($query$
      SELECT MIN(candidate) FROM (
        SELECT 1::BIGINT AS candidate UNION ALL
        SELECT local_no::BIGINT + 1 FROM %I.%I
        WHERE madrasa_id = $1 AND local_scope_id = $2
      ) candidates WHERE NOT EXISTS (
        SELECT 1 FROM %I.%I occupied WHERE occupied.madrasa_id = $1
          AND occupied.local_scope_id = $2 AND occupied.local_no = candidates.candidate
      )
    $query$, TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_TABLE_SCHEMA, TG_TABLE_NAME)
    INTO next_number USING NEW.madrasa_id, parent_scope;
    IF next_number IS NULL OR next_number > 2147483647 THEN
      RAISE EXCEPTION 'No available academic local number' USING ERRCODE = '23514';
    END IF;
    NEW.local_no := next_number::INTEGER;
  END IF;
  IF NEW.local_no < 1 THEN
    RAISE EXCEPTION 'Invalid local number' USING ERRCODE = '23514';
  END IF;
  UPDATE academic_sequences SET last_value = GREATEST(last_value, NEW.local_no)
    WHERE madrasa_id = NEW.madrasa_id AND kind = counter_kind;
  RETURN NEW;
END $$;

CREATE TRIGGER var_local_no BEFORE INSERT OR UPDATE ON madrasa_classes
  FOR EACH ROW EXECUTE FUNCTION assign_parent_scoped_academic_no('class');
CREATE TRIGGER var_local_no BEFORE INSERT OR UPDATE ON madrasa_books
  FOR EACH ROW EXECUTE FUNCTION assign_parent_scoped_academic_no('book');

-- Keep numbering scopes correct when the parent of a master record changes.
CREATE FUNCTION refresh_academic_number_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'classes' THEN
    UPDATE madrasa_classes SET local_no = local_no WHERE class_id = NEW.id;
  ELSE
    UPDATE madrasa_books SET local_no = local_no WHERE book_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER refresh_class_number_scope AFTER UPDATE OF division_id ON classes
  FOR EACH ROW WHEN (OLD.division_id IS DISTINCT FROM NEW.division_id)
  EXECUTE FUNCTION refresh_academic_number_scope();
CREATE TRIGGER refresh_book_number_scope AFTER UPDATE OF class_id ON books
  FOR EACH ROW WHEN (OLD.class_id IS DISTINCT FROM NEW.class_id)
  EXECUTE FUNCTION refresh_academic_number_scope();

COMMIT;
