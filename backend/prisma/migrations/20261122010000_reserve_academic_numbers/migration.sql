BEGIN;

LOCK TABLE madrasa_divisions, madrasa_classes, madrasa_books IN ACCESS EXCLUSIVE MODE;

-- Preserve existing numbers and historical high-water marks, including deleted rows.
INSERT INTO academic_sequences (madrasa_id, kind, last_value)
SELECT madrasa_id, 'division', MAX(local_no) FROM madrasa_divisions GROUP BY madrasa_id
UNION ALL
SELECT madrasa_id, 'class:' || local_scope_id, MAX(local_no)
FROM madrasa_classes GROUP BY madrasa_id, local_scope_id
UNION ALL
SELECT madrasa_id, 'book:' || local_scope_id, MAX(local_no)
FROM madrasa_books GROUP BY madrasa_id, local_scope_id
ON CONFLICT (madrasa_id, kind) DO UPDATE
SET last_value = GREATEST(academic_sequences.last_value, EXCLUDED.last_value);

CREATE FUNCTION assign_reserved_academic_no() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  parent_scope INTEGER;
  counter_kind TEXT;
  previous_number INTEGER;
  next_number BIGINT;
BEGIN
  counter_kind := TG_ARGV[0];
  IF TG_ARGV[0] <> 'division' THEN
    IF TG_ARGV[0] = 'class' THEN
      SELECT COALESCE(division_id, 0) INTO STRICT parent_scope FROM classes WHERE id = NEW.class_id;
    ELSE
      SELECT class_id INTO STRICT parent_scope FROM books WHERE id = NEW.book_id;
    END IF;
    counter_kind := counter_kind || ':' || parent_scope;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.madrasa_id <> OLD.madrasa_id THEN
      RAISE EXCEPTION 'Institution is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.local_no IS DISTINCT FROM OLD.local_no THEN
      RAISE EXCEPTION 'Local number is managed by the database' USING ERRCODE = '23514';
    END IF;
    IF TG_ARGV[0] = 'division' THEN
      RETURN NEW;
    END IF;
    IF NEW.local_scope_id <> OLD.local_scope_id THEN
      RAISE EXCEPTION 'Local scope is managed by the database' USING ERRCODE = '23514';
    END IF;
    IF parent_scope = OLD.local_scope_id THEN
      RETURN NEW;
    END IF;
    -- A parent move consumes a new number; the old parent's number stays reserved.
    NEW.local_no := NULL;
  END IF;
  IF TG_ARGV[0] <> 'division' THEN
    NEW.local_scope_id := parent_scope;
  END IF;

  -- The counter row serializes allocations within each institution and parent.
  INSERT INTO academic_sequences (madrasa_id, kind, last_value)
  VALUES (NEW.madrasa_id, counter_kind, 0)
  ON CONFLICT (madrasa_id, kind) DO UPDATE SET last_value = academic_sequences.last_value
  RETURNING last_value INTO previous_number;

  next_number := COALESCE(NEW.local_no::BIGINT, previous_number::BIGINT + 1);
  IF next_number <= previous_number OR next_number > 2147483647 THEN
    RAISE EXCEPTION 'Academic number is reserved or exhausted' USING ERRCODE = '23514';
  END IF;
  NEW.local_no := next_number::INTEGER;
  UPDATE academic_sequences SET last_value = NEW.local_no
  WHERE madrasa_id = NEW.madrasa_id AND kind = counter_kind;
  RETURN NEW;
END $$;

DROP TRIGGER var_local_no ON madrasa_divisions;
DROP TRIGGER var_local_no ON madrasa_classes;
DROP TRIGGER var_local_no ON madrasa_books;
CREATE TRIGGER var_local_no BEFORE INSERT OR UPDATE ON madrasa_divisions
  FOR EACH ROW EXECUTE FUNCTION assign_reserved_academic_no('division');
CREATE TRIGGER var_local_no BEFORE INSERT OR UPDATE ON madrasa_classes
  FOR EACH ROW EXECUTE FUNCTION assign_reserved_academic_no('class');
CREATE TRIGGER var_local_no BEFORE INSERT OR UPDATE ON madrasa_books
  FOR EACH ROW EXECUTE FUNCTION assign_reserved_academic_no('book');

COMMIT;
