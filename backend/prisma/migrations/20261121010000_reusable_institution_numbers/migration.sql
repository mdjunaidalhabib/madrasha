BEGIN;

-- Keep tenant primary keys immutable. Only the visible institution number is reusable.
ALTER TABLE "madrasas" ADD COLUMN "madrasa_no" INTEGER;
UPDATE "madrasas" SET "madrasa_no" = "id";
CREATE UNIQUE INDEX "uniq_madrasa_no" ON "madrasas"("madrasa_no");

CREATE FUNCTION assign_madrasa_number() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE next_number BIGINT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.madrasa_no IS DISTINCT FROM OLD.madrasa_no THEN
      RAISE EXCEPTION 'Institution number is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('platform-institution-number', 0));
  IF NEW.madrasa_no IS NULL THEN
    SELECT MIN(candidate) INTO next_number FROM (
      SELECT 1::BIGINT AS candidate
      UNION ALL SELECT madrasa_no::BIGINT + 1 FROM madrasas WHERE madrasa_no IS NOT NULL
    ) candidates WHERE NOT EXISTS (SELECT 1 FROM madrasas m WHERE m.madrasa_no = candidates.candidate);
    IF next_number IS NULL OR next_number > 2147483647 THEN
      RAISE EXCEPTION 'No available institution number' USING ERRCODE = '23514';
    END IF;
    NEW.madrasa_no := next_number::INTEGER;
  END IF;
  IF NEW.madrasa_no < 1 THEN RAISE EXCEPTION 'Invalid institution number' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assign_madrasa_number BEFORE INSERT OR UPDATE ON "madrasas"
FOR EACH ROW EXECUTE FUNCTION assign_madrasa_number();

COMMIT;
