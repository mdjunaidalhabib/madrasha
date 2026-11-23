BEGIN;

LOCK TABLE "madrasas" IN ACCESS EXCLUSIVE MODE;

CREATE TABLE "madrasa_id_counter" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "last_id" INTEGER NOT NULL,
  CONSTRAINT "madrasa_id_counter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "madrasa_id_counter_singleton" CHECK ("id" = 1),
  CONSTRAINT "madrasa_id_counter_nonnegative" CHECK ("last_id" >= 0)
);

-- Preserve the old high-water mark, even if the highest ID was deleted.
-- Never renumber existing tenants or reuse previously consumed IDs.
DO $$
DECLARE
  old_sequence TEXT;
  old_last BIGINT := 0;
  old_called BOOLEAN;
  existing_last BIGINT;
BEGIN
  old_sequence := pg_get_serial_sequence('madrasas', 'id');
  IF old_sequence IS NOT NULL THEN
    EXECUTE format('SELECT last_value, is_called FROM %s', old_sequence)
      INTO old_last, old_called;
    IF NOT old_called THEN old_last := 0; END IF;
  END IF;
  SELECT COALESCE(MAX(id), 0) INTO existing_last FROM madrasas;
  INSERT INTO madrasa_id_counter (id, last_id)
    VALUES (1, GREATEST(old_last, existing_last));
END $$;

ALTER TABLE "madrasas" ALTER COLUMN "id" DROP DEFAULT;

CREATE FUNCTION assign_transactional_madrasa_id() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE previous_id INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Madrasa ID is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT last_id INTO previous_id FROM madrasa_id_counter WHERE id = 1 FOR UPDATE;
  IF previous_id IS NULL THEN
    RAISE EXCEPTION 'Madrasa ID counter is missing' USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS NULL THEN
    IF previous_id = 2147483647 THEN
      RAISE EXCEPTION 'No available madrasa ID' USING ERRCODE = '23514';
    END IF;
    NEW.id := previous_id + 1;
  ELSIF NEW.id <= previous_id THEN
    RAISE EXCEPTION 'Madrasa ID must exceed all previously assigned IDs' USING ERRCODE = '23514';
  END IF;

  -- This update commits with provisioning. A failed create rolls it back;
  -- deleting a committed tenant never reduces the counter.
  UPDATE madrasa_id_counter SET last_id = NEW.id WHERE id = 1;
  RETURN NEW;
END $$;

-- Acquire the ID counter before the existing institution-number trigger.
CREATE TRIGGER allocate_madrasa_id BEFORE INSERT OR UPDATE ON "madrasas"
FOR EACH ROW EXECUTE FUNCTION assign_transactional_madrasa_id();

COMMIT;
