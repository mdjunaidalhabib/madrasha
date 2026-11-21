const assert = require("node:assert/strict");
const fs = require("node:fs");

module.exports = async function verifyParentScopedAcademics(db) {
  const before = (
    await db.query(
      "SELECT id,madrasa_id,class_id,reg_no_start,reg_no_end,deleted_at FROM madrasa_classes ORDER BY id",
    )
  ).rows;
  const beforeBooks = (
    await db.query(
      "SELECT id,madrasa_id,book_id,full_mark,pass_mark,deleted_at FROM madrasa_books ORDER BY id",
    )
  ).rows;
  await db.exec(
    fs.readFileSync(
      "backend/prisma/migrations/20261121020000_parent_scoped_academic_numbers/migration.sql",
      "utf8",
    ),
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT id,madrasa_id,class_id,reg_no_start,reg_no_end,deleted_at FROM madrasa_classes ORDER BY id",
      )
    ).rows,
    before,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT id,madrasa_id,book_id,full_mark,pass_mark,deleted_at FROM madrasa_books ORDER BY id",
      )
    ).rows,
    beforeBooks,
  );
  const invalid = (
    await db.query(`SELECT mc.id FROM madrasa_classes mc JOIN classes c ON c.id=mc.class_id WHERE mc.local_scope_id<>COALESCE(c.division_id,0)
    UNION ALL SELECT mb.id FROM madrasa_books mb JOIN books b ON b.id=mb.book_id WHERE mb.local_scope_id<>b.class_id`)
  ).rows;
  assert.equal(invalid.length, 0);
  await db.exec(
    "INSERT INTO madrasas(id,name,slug) VALUES (70,'Scoped A','scoped-a'),(71,'Scoped B','scoped-b')",
  );
  async function master(table, tenant, parentField, parent) {
    const values = parentField ? [tenant, parent] : [tenant];
    return (
      await db.query(
        `INSERT INTO ${table}(owner_madrasa_id,name_bn${parentField ? "," + parentField : ""}) VALUES ($1,'Scoped'${parentField ? ",$2" : ""}) RETURNING id`,
        values,
      )
    ).rows[0].id;
  }
  async function cls(tenant, division) {
    const id = await master("classes", tenant, "division_id", division);
    return (
      await db.query(
        "INSERT INTO madrasa_classes(madrasa_id,class_id) VALUES ($1,$2) RETURNING *",
        [tenant, id],
      )
    ).rows[0];
  }
  async function book(tenant, classId) {
    const id = await master("books", tenant, "class_id", classId);
    return (
      await db.query("INSERT INTO madrasa_books(madrasa_id,book_id) VALUES ($1,$2) RETURNING *", [
        tenant,
        id,
      ])
    ).rows[0];
  }
  const d1 = await master("divisions", 70),
    d2 = await master("divisions", 70),
    d3 = await master("divisions", 71);
  const a = await cls(70, d1),
    b = await cls(70, d1),
    c = await cls(70, d2),
    other = await cls(71, d3);
  assert.deepEqual([a.local_no, b.local_no, c.local_no, other.local_no], [1, 2, 1, 1]);
  const s1 = await book(70, a.class_id),
    s2 = await book(70, a.class_id),
    s3 = await book(70, b.class_id),
    s4 = await book(71, other.class_id);
  assert.deepEqual([s1.local_no, s2.local_no, s3.local_no, s4.local_no], [1, 2, 1, 1]);
  for (const [table, first, create] of [
    ["madrasa_classes", a, () => cls(70, d1)],
    ["madrasa_books", s1, () => book(70, a.class_id)],
  ]) {
    await db.query(`UPDATE ${table} SET deleted_at=NOW() WHERE id=$1`, [first.id]);
    assert.equal((await create()).local_no, 3, "trash reserves the number");
    await db.query(`UPDATE ${table} SET deleted_at=NULL WHERE id=$1`, [first.id]);
    assert.equal(
      (await db.query(`SELECT local_no FROM ${table} WHERE id=$1`, [first.id])).rows[0].local_no,
      1,
    );
    await db.query(`DELETE FROM ${table} WHERE id=$1`, [first.id]);
    const replacement = await create();
    assert.equal(replacement.local_no, 1, "hard deletion frees the number only in its parent");
    assert.notEqual(replacement.id, first.id);
    await assert.rejects(
      db.query(`UPDATE ${table} SET local_no=99 WHERE id=$1`, [replacement.id]),
      /managed by the database/,
    );
    await db.exec("BEGIN");
    await db.query(`DELETE FROM ${table} WHERE id=$1`, [replacement.id]);
    await db.exec("ROLLBACK");
    assert.equal((await create()).local_no, 4, "rollback does not free the number");
  }
  // Parent moves obtain a free number in the destination, without rewriting IDs.
  await db.query("UPDATE classes SET division_id=$1 WHERE id=$2", [d2, b.class_id]);
  assert.deepEqual(
    (await db.query("SELECT local_scope_id,local_no FROM madrasa_classes WHERE id=$1", [b.id]))
      .rows[0],
    { local_scope_id: d2, local_no: 2 },
  );
  await db.query("UPDATE books SET class_id=$1 WHERE id=$2", [b.class_id, s2.book_id]);
  assert.deepEqual(
    (await db.query("SELECT local_scope_id,local_no FROM madrasa_books WHERE id=$1", [s2.id]))
      .rows[0],
    { local_scope_id: b.class_id, local_no: 2 },
  );
  // An unassigned class still has its own explicit institution-local scope.
  assert.equal((await cls(70, null)).local_no, 1);
  console.log(
    "PASS: class numbers per division, subject numbers per class, tenant isolation, trash/restore/hard-delete/rollback, parent moves and preserved references",
  );
};
