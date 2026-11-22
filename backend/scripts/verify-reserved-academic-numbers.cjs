// Run by verify-private-academics.cjs against an isolated PostgreSQL engine.
const assert = require("node:assert/strict");
const fs = require("node:fs");

module.exports = async function verifyReservedAcademicNumbers(db) {
  const snapshotSql = `SELECT 'division' AS kind,id,local_no FROM madrasa_divisions
    UNION ALL SELECT 'class',id,local_no FROM madrasa_classes
    UNION ALL SELECT 'book',id,local_no FROM madrasa_books ORDER BY kind,id`;
  const before = (await db.query(snapshotSql)).rows;
  await db.exec(fs.readFileSync(
    "backend/prisma/migrations/20261122010000_reserve_academic_numbers/migration.sql", "utf8",
  ));
  assert.deepEqual((await db.query(snapshotSql)).rows, before, "migration preserves existing numbers");
  await db.exec("INSERT INTO madrasas(id,name,slug) VALUES (80,'Reserved A','reserved-a'),(81,'Reserved B','reserved-b')");

  async function master(kind, tenant, parent) {
    const table = kind === "division" ? "divisions" : kind === "class" ? "classes" : "books";
    const field = kind === "division" ? "" : kind === "class" ? "division_id" : "class_id";
    return (await db.query(
      `INSERT INTO ${table}(owner_madrasa_id,name_bn${field ? "," + field : ""})
       VALUES ($1,'Reserved'${field ? ",$2" : ""}) RETURNING id`,
      field ? [tenant, parent] : [tenant],
    )).rows[0].id;
  }
  async function create(kind, tenant, parent) {
    const id = await master(kind, tenant, parent);
    const table = kind === "division" ? "madrasa_divisions" : kind === "class" ? "madrasa_classes" : "madrasa_books";
    const field = kind === "division" ? "division_id" : kind === "class" ? "class_id" : "book_id";
    return (await db.query(
      `INSERT INTO ${table}(madrasa_id,${field}) VALUES ($1,$2) RETURNING *`, [tenant, id],
    )).rows[0];
  }
  const division = await master("division", 80);
  const cls = await master("class", 80, division);
  const otherDivision = await master("division", 81);
  const otherClass = await master("class", 81, otherDivision);
  for (const [kind, table, parent, otherParent] of [
    ["division", "madrasa_divisions", null, null],
    ["class", "madrasa_classes", division, otherDivision],
    ["book", "madrasa_books", cls, otherClass],
  ]) {
    const first = await create(kind, 80, parent);
    const second = await create(kind, 80, parent);
    const third = await create(kind, 80, parent);
    assert.deepEqual([first.local_no, second.local_no, third.local_no], [1, 2, 3]);
    await db.query(`UPDATE ${table} SET deleted_at=NOW() WHERE id=$1`, [second.id]);
    assert.equal((await create(kind, 80, parent)).local_no, 4, "trash reserves numbers");
    await db.query(`UPDATE ${table} SET deleted_at=NULL WHERE id=$1`, [second.id]);
    assert.equal((await db.query(`SELECT local_no FROM ${table} WHERE id=$1`, [second.id])).rows[0].local_no, 2);
    await db.query(`DELETE FROM ${table} WHERE id=$1`, [second.id]);
    assert.equal((await create(kind, 80, parent)).local_no, 5, "middle numbers are never reused");
    const highest = await create(kind, 80, parent);
    await db.query(`DELETE FROM ${table} WHERE id=$1`, [highest.id]);
    assert.equal((await create(kind, 80, parent)).local_no, 7, "highest numbers are never reused");
    await assert.rejects(db.query(`UPDATE ${table} SET local_no=99 WHERE id=$1`, [first.id]), /managed by the database/);
    assert.equal((await create(kind, 81, otherParent)).local_no, 1, "tenant isolation");
    const field = kind === "division" ? "division_id" : kind === "class" ? "class_id" : "book_id";
    const newId = await master(kind, 80, parent);
    await assert.rejects(db.query(
      `INSERT INTO ${table}(madrasa_id,${field},local_no) VALUES (80,$1,2)`, [newId],
    ), /reserved/);
    await db.query(`DELETE FROM ${table} WHERE madrasa_id=80`);
    assert.equal((await create(kind, 80, parent)).local_no, 8, "empty lists retain number history");
  }

  // Moving away and back must not reclaim a previously used code in either parent.
  const destination = await master("division", 80);
  const moving = await create("class", 80, division);
  const destinationClass = await create("class", 80, destination);
  await db.query("DELETE FROM madrasa_classes WHERE id=$1", [destinationClass.id]);
  await db.query("UPDATE classes SET division_id=$1 WHERE id=$2", [destination, moving.class_id]);
  assert.equal((await db.query("SELECT local_no FROM madrasa_classes WHERE id=$1", [moving.id])).rows[0].local_no, 2);
  await db.query("UPDATE classes SET division_id=$1 WHERE id=$2", [division, moving.class_id]);
  assert.equal((await db.query("SELECT local_no FROM madrasa_classes WHERE id=$1", [moving.id])).rows[0].local_no, 10);
  const movingBook = await create("book", 80, cls);
  const destinationBook = await create("book", 80, moving.class_id);
  await db.query("DELETE FROM madrasa_books WHERE id=$1", [destinationBook.id]);
  await db.query("UPDATE books SET class_id=$1 WHERE id=$2", [moving.class_id, movingBook.book_id]);
  assert.equal((await db.query("SELECT local_no FROM madrasa_books WHERE id=$1", [movingBook.id])).rows[0].local_no, 2);
  await db.query("UPDATE books SET class_id=$1 WHERE id=$2", [cls, movingBook.book_id]);
  assert.equal((await db.query("SELECT local_no FROM madrasa_books WHERE id=$1", [movingBook.id])).rows[0].local_no, 10);
  console.log("PASS: division/class/subject numbers stay reserved after trash, permanent deletion, empty lists and parent moves; existing numbers and tenant isolation are preserved");
};
