BEGIN;

-- Local numbers are reusable only after the row is permanently removed.
-- Soft-deleted/inactive rows still reserve theirs. Database IDs stay unique.
CREATE OR REPLACE FUNCTION assign_academic_local_no() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_number BIGINT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.madrasa_id <> OLD.madrasa_id OR NEW.local_no IS DISTINCT FROM OLD.local_no THEN
      RAISE EXCEPTION 'Institution and local number are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- One row lock per institution and kind serializes concurrent allocations.
  INSERT INTO academic_sequences (madrasa_id, kind, last_value)
  VALUES (NEW.madrasa_id, TG_ARGV[0], 0)
  ON CONFLICT (madrasa_id, kind) DO UPDATE
  SET last_value = academic_sequences.last_value;

  IF NEW.local_no IS NULL THEN
    EXECUTE format($query$
      SELECT MIN(candidate)
      FROM (
        SELECT 1::BIGINT AS candidate
        UNION ALL
        SELECT local_no::BIGINT + 1 FROM %I.%I WHERE madrasa_id = $1
      ) candidates
      WHERE NOT EXISTS (
        SELECT 1 FROM %I.%I occupied
        WHERE occupied.madrasa_id = $1 AND occupied.local_no = candidates.candidate
      )
    $query$, TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_TABLE_SCHEMA, TG_TABLE_NAME)
    INTO next_number USING NEW.madrasa_id;

    IF next_number IS NULL OR next_number > 2147483647 THEN
      RAISE EXCEPTION 'No available academic local number' USING ERRCODE = '23514';
    END IF;
    NEW.local_no := next_number::INTEGER;
  END IF;

  IF NEW.local_no < 1 THEN
    RAISE EXCEPTION 'Invalid local number' USING ERRCODE = '23514';
  END IF;
  UPDATE academic_sequences
  SET last_value = GREATEST(last_value, NEW.local_no)
  WHERE madrasa_id = NEW.madrasa_id AND kind = TG_ARGV[0];

  RETURN NEW;
END $$;

COMMIT;
