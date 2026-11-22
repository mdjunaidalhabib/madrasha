const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
require("../node_modules/ts-node").register({
  project: path.resolve("backend/tsconfig.json"),
  transpileOnly: true,
});
const { createPermanentNumberPool, getNextReservedRoll } = require("../src/shared/utils/personnel-number.util.ts");
const {
  allocateStudentRegistrationNoOnTx,
  createRegistrationNoBatchOnTx,
} = require("../src/modules/students/registration-no.allocator.ts");

module.exports = async function verifyPersonnelNumbers(db) {
  await db.exec(fs.readFileSync("backend/prisma/migrations/20261122020000_reserve_personnel_numbers/migration.sql", "utf8"));
  for (const table of ["sessions", "students", "classes", "books", "divisions", "madrasas"]) {
    await db.exec(
      "SELECT setval(pg_get_serial_sequence('" +
        table +
        "','id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM " +
        table,
    );
  }
  const initial = (
    await db.query("SELECT id,madrasa_no FROM madrasas WHERE id IN (1,2,3) ORDER BY id")
  ).rows;
  assert.deepEqual(
    initial.map((r) => r.madrasa_no),
    [1, 2, 3],
  );
  const insertInstitution = async (id) =>
    (
      await db.query(
        "INSERT INTO madrasas (id,name,slug) VALUES ($1,'Number test',$2) RETURNING id,madrasa_no",
        [id, "number-test-" + id],
      )
    ).rows[0];
  const institution = await insertInstitution(800);
  await db.query("UPDATE madrasas SET deleted_at=NOW() WHERE id=800");
  assert.notEqual((await insertInstitution(801)).madrasa_no, institution.madrasa_no);
  await db.query("UPDATE madrasas SET deleted_at=NULL WHERE id=800");
  const empty = await insertInstitution(802);
  await db.query("DELETE FROM madrasas WHERE id=802");
  const replacement = await insertInstitution(803);
  assert.equal(replacement.madrasa_no, empty.madrasa_no);
  assert.notEqual(replacement.id, empty.id);

  const division = (
    await db.query(
      "INSERT INTO divisions (owner_madrasa_id,name_bn) VALUES (800,'Personnel') RETURNING id",
    )
  ).rows[0].id;
  const otherDivision = (
    await db.query(
      "INSERT INTO divisions (owner_madrasa_id,name_bn) VALUES (801,'Personnel') RETURNING id",
    )
  ).rows[0].id;
  const classes = [];
  for (const start of [1, 51]) {
    const id = (
      await db.query(
        "INSERT INTO classes (owner_madrasa_id,division_id,name_bn) VALUES (800,$1,'Class') RETURNING id",
        [division],
      )
    ).rows[0].id;
    await db.query(
      "INSERT INTO madrasa_classes (madrasa_id,class_id,reg_no_start,reg_no_end) VALUES (800,$1,$2,$3)",
      [id, start, start + 49],
    );
    classes.push(id);
  }
  const session = (
    await db.query(
      "INSERT INTO sessions (madrasa_id,name,start_date,end_date) VALUES (800,'2026','2026-01-01','2026-12-31') RETURNING id",
    )
  ).rows[0].id;
  const tx = {
    $queryRaw: async (sql) => (await db.query(sql.text, sql.values)).rows,
    student: {
      findMany: async () =>
        (
          await db.query(
            'SELECT registration_no AS "registrationNo" FROM students WHERE madrasa_id=800 AND registration_no IS NOT NULL',
          )
        ).rows,
    },
    madrasaClass: {
      findFirst: async ({ where }) =>
        (
          await db.query(
            'SELECT id,reg_no_start AS "regNoStart",reg_no_end AS "regNoEnd",reg_no_last_issued AS "regNoLastIssued" FROM madrasa_classes WHERE madrasa_id=$1 AND class_id=$2',
            [where.madrasaId, where.classId],
          )
        ).rows[0] ?? null,
      aggregate: async () => ({
        _max: {
          regNoEnd: (
            await db.query("SELECT MAX(reg_no_end) AS n FROM madrasa_classes WHERE madrasa_id=800")
          ).rows[0].n,
        },
      }),
      update: async ({ where, data }) =>
        db.query("UPDATE madrasa_classes SET reg_no_last_issued=$1 WHERE id=$2", [
          data.regNoLastIssued,
          where.id,
        ]),
    },
  };
  async function create(kind, tenant = 800, classId = classes[0]) {
    if (kind === "student") {
      const n = await allocateStudentRegistrationNoOnTx(tx, tenant, classId);
      return (
        await db.query(
          "INSERT INTO students (madrasa_id,division_id,class_id,session_id,name_bn,registration_no) VALUES (800,$1,$2,$3,'Test',$4) RETURNING id,registration_no",
          [division, classId, session, n],
        )
      ).rows[0];
    }
    const table = kind === "teacher" ? "teachers" : "staff";
    const numbers = (
      await db.query("SELECT number FROM personnel_number_reservations WHERE madrasa_id=$1 AND kind=$2", [tenant, kind + "-registration"])
    ).rows.map((r) => r.number);
    const n = createPermanentNumberPool(numbers).next();
    return (
      await db.query(
        "INSERT INTO " +
          table +
          " (madrasa_id,name_bn,registration_no" +
          (kind === "teacher" ? ",division_id" : "") +
          ") VALUES ($1,'Test',$2" +
          (kind === "teacher" ? ",$3" : "") +
          ") RETURNING id,registration_no",
        kind === "teacher" ? [tenant, n, tenant === 800 ? division : otherDivision] : [tenant, n],
      )
    ).rows[0];
  }
  for (const kind of ["student", "teacher", "staff"]) {
    const table = kind === "student" ? "students" : kind === "teacher" ? "teachers" : "staff";
    const first = await create(kind),
      second = await create(kind),
      third = await create(kind);
    assert.deepEqual(
      [first.registration_no, second.registration_no, third.registration_no],
      [1, 2, 3],
    );
    await db.query("UPDATE " + table + " SET deleted_at=NOW() WHERE id=$1", [second.id]);
    assert.equal((await create(kind)).registration_no, 4);
    await db.query("UPDATE " + table + " SET deleted_at=NULL WHERE id=$1", [second.id]);
    await db.query("DELETE FROM " + table + " WHERE id=$1", [second.id]);
    const next = await create(kind);
    assert.equal(next.registration_no, 5);
    assert.notEqual(next.id, second.id);
    assert.equal(
      (await db.query("SELECT registration_no FROM " + table + " WHERE id=$1", [third.id])).rows[0]
        .registration_no,
      3,
    );
    if (kind !== "student") assert.equal((await create(kind, 801)).registration_no, 1);
  }
  assert.equal((await create("student", 800, classes[1])).registration_no, 51);
  const batch = createRegistrationNoBatchOnTx(tx, 800);
  assert.equal(await batch.next(classes[0]), 6);
  assert.equal(await batch.next(classes[0]), 7);
  await batch.flush();
  const student = await create("student");
  await db.query("UPDATE students SET roll=4 WHERE id=$1", [student.id]);
  assert.equal(await getNextReservedRoll(tx, 800, classes[0], "2025"), 5);
  await db.query("UPDATE students SET roll=2 WHERE id=$1", [student.id]);
  assert.equal(await getNextReservedRoll(tx, 800, classes[0], "2025"), 5, "manual adjustment does not free the old roll for automatic reuse");
  await assert.rejects(db.query("UPDATE students SET registration_no=49 WHERE id=$1", [student.id]), /only with the class/);
  const newReg = await allocateStudentRegistrationNoOnTx(tx, 800, classes[1]);
  await db.query("UPDATE students SET class_id=$1,registration_no=$2 WHERE id=$3", [classes[1], newReg, student.id]);
  assert.equal((await db.query("SELECT registration_no FROM students WHERE id=$1", [student.id])).rows[0].registration_no, newReg, "class changes receive the new class registration number");
  await db.query("DELETE FROM students WHERE id=$1", [student.id]);
  assert.equal(await getNextReservedRoll(tx, 800, classes[0], "2025"), 5, "permanent deletion retains roll history");
  assert.equal(await getNextReservedRoll(tx, 800, classes[1], "2025"), 3, "class changes reserve the roll in the destination");
  for (const table of ["teachers", "staff"]) {
    await assert.rejects(db.query(`UPDATE ${table} SET registration_no=99 WHERE madrasa_id=800`), /managed by the system/);
    const highest = await create(table === "teachers" ? "teacher" : "staff");
    await db.query(`DELETE FROM ${table} WHERE id=$1`, [highest.id]);
    assert.equal((await create(table === "teachers" ? "teacher" : "staff")).registration_no, highest.registration_no + 1, "highest deleted number stays reserved");
    const tenant = await create(table === "teachers" ? "teacher" : "staff", 801);
    assert.equal(tenant.registration_no, 2, "tenant numbering stays independent");
  }
  console.log(
    "PASS: student class blocks and teacher/staff registration numbers stay reserved after permanent deletion; institution numbering and internal IDs are preserved",
  );
};
