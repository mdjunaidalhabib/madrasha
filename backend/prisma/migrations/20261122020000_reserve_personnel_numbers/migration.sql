BEGIN;

LOCK TABLE students, teachers, staff IN ACCESS EXCLUSIVE MODE;
CREATE TABLE personnel_number_reservations (
  madrasa_id INTEGER NOT NULL REFERENCES madrasas(id) ON DELETE CASCADE ON UPDATE CASCADE,
  kind TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  number INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  CONSTRAINT personnel_number_reservations_pkey PRIMARY KEY (madrasa_id, kind, scope, number)
);

INSERT INTO personnel_number_reservations (madrasa_id,kind,scope,number,person_id)
SELECT madrasa_id,'student-registration','',registration_no,id FROM students WHERE registration_no IS NOT NULL
UNION ALL SELECT madrasa_id,'teacher-registration','',registration_no,id FROM teachers
UNION ALL SELECT madrasa_id,'staff-registration','',registration_no,id FROM staff;

INSERT INTO personnel_number_reservations (madrasa_id,kind,scope,number,person_id)
SELECT madrasa_id,'student-roll',class_id || ':' || academic_year,roll,MIN(id)
FROM students WHERE roll IS NOT NULL GROUP BY madrasa_id,class_id,academic_year,roll;

-- Recover old class/year rolls that are still recorded in promotion history.
INSERT INTO personnel_number_reservations (madrasa_id,kind,scope,number,person_id)
SELECT b.madrasa_id,'student-roll',b.from_class_id || ':' || b.from_year,r.old_roll,r.student_id
FROM promotion_records r JOIN promotion_batches b ON b.id=r.batch_id
UNION ALL
SELECT b.madrasa_id,'student-roll',
  (CASE WHEN r.status='PROMOTED' THEN b.to_class_id ELSE b.from_class_id END) || ':' || b.to_year,
  r.new_roll,r.student_id
FROM promotion_records r JOIN promotion_batches b ON b.id=r.batch_id WHERE r.new_roll IS NOT NULL
ON CONFLICT DO NOTHING;

-- Keep historical class-block high-water marks even if their holders were deleted.
INSERT INTO personnel_number_reservations (madrasa_id,kind,scope,number,person_id)
SELECT mc.madrasa_id,'student-registration','',n,0
FROM madrasa_classes mc
CROSS JOIN LATERAL generate_series(mc.reg_no_start, LEAST(mc.reg_no_last_issued,mc.reg_no_end)) n
WHERE mc.reg_no_start IS NOT NULL AND mc.reg_no_last_issued IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE FUNCTION reserve_personnel_numbers() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  registration_kind TEXT := TG_ARGV[0] || '-registration';
  reserved_owner INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.madrasa_id <> OLD.madrasa_id THEN
      RAISE EXCEPTION 'Institution is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.registration_no IS DISTINCT FROM OLD.registration_no THEN
      IF TG_ARGV[0] <> 'student' THEN
        RAISE EXCEPTION 'Registration number is managed by the system' USING ERRCODE = '23514';
      END IF;
      IF OLD.registration_no IS NOT NULL AND NEW.class_id = OLD.class_id THEN
        RAISE EXCEPTION 'Registration number changes only with the class' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF NEW.registration_no IS NOT NULL THEN
    INSERT INTO personnel_number_reservations(madrasa_id,kind,scope,number,person_id)
    VALUES (NEW.madrasa_id,registration_kind,'',NEW.registration_no,NEW.id)
    ON CONFLICT (madrasa_id,kind,scope,number) DO UPDATE
      SET person_id = personnel_number_reservations.person_id
    RETURNING person_id INTO reserved_owner;
    IF reserved_owner <> NEW.id THEN
      RAISE EXCEPTION 'Registration number is permanently reserved' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_ARGV[0] = 'student' THEN
    IF NEW.roll IS NOT NULL THEN
      INSERT INTO personnel_number_reservations(madrasa_id,kind,scope,number,person_id)
      VALUES (NEW.madrasa_id,'student-roll',NEW.class_id || ':' || NEW.academic_year,NEW.roll,NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER reserve_student_numbers BEFORE INSERT OR UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION reserve_personnel_numbers('student');
CREATE TRIGGER reserve_teacher_numbers BEFORE INSERT OR UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION reserve_personnel_numbers('teacher');
CREATE TRIGGER reserve_staff_numbers BEFORE INSERT OR UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION reserve_personnel_numbers('staff');
COMMIT;
