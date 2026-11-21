// Called by verify-private-academics.cjs against its isolated PostgreSQL engine.
const assert = require("node:assert/strict");
const fs = require("node:fs");

module.exports = async function verifyAcademicNumberReuse(db) {
  await db.exec(
    fs.readFileSync(
      "backend/prisma/migrations/20261121000000_reuse_deleted_academic_local_numbers/migration.sql",
      "utf8",
    ),
  );
  await db.exec(
    "INSERT INTO madrasas (id,name,slug) VALUES (40,'Reuse A','reuse-a'),(41,'Reuse B','reuse-b')",
  );
  const parents = new Map();
  for (const tenant of [40, 41]) {
    const division = (
      await db.query(
        "INSERT INTO divisions (owner_madrasa_id,name_bn) VALUES ($1,'Parent') RETURNING id",
        [tenant],
      )
    ).rows[0].id;
    const cls = (
      await db.query(
        "INSERT INTO classes (owner_madrasa_id,division_id,name_bn) VALUES ($1,$2,'Parent') RETURNING id",
        [tenant, division],
      )
    ).rows[0].id;
    parents.set(tenant, { division, cls });
  }

  async function create(kind, tenant) {
    if (kind === "exam")
      return (
        await db.query(
          "INSERT INTO exams (madrasa_id,name,year) VALUES ($1,'Reusable','2026') RETURNING id,local_no",
          [tenant],
        )
      ).rows[0];
    const master = kind === "division" ? "divisions" : kind === "class" ? "classes" : "books";
    const table =
      kind === "division"
        ? "madrasa_divisions"
        : kind === "class"
          ? "madrasa_classes"
          : "madrasa_books";
    const field = kind === "division" ? "division_id" : kind === "class" ? "class_id" : "book_id";
    const parent = parents.get(tenant);
    const sql =
      kind === "division"
        ? "INSERT INTO divisions (owner_madrasa_id,name_bn) VALUES ($1,'Reusable') RETURNING id"
        : "INSERT INTO " +
          master +
          " (owner_madrasa_id," +
          (kind === "class" ? "division_id" : "class_id") +
          ",name_bn) VALUES ($1,$2,'Reusable') RETURNING id";
    const args =
      kind === "division" ? [tenant] : [tenant, kind === "class" ? parent.division : parent.cls];
    const id = (await db.query(sql, args)).rows[0].id;
    return (
      await db.query(
        "INSERT INTO " + table + " (madrasa_id," + field + ") VALUES ($1,$2) RETURNING id,local_no",
        [tenant, id],
      )
    ).rows[0];
  }

  for (const kind of ["division", "class", "book", "exam"]) {
    const table =
      kind === "division"
        ? "madrasa_divisions"
        : kind === "class"
          ? "madrasa_classes"
          : kind === "book"
            ? "madrasa_books"
            : "exams";
    const first = await create(kind, 40);
    const second = await create(kind, 40);
    const third = await create(kind, 40);
    assert.deepEqual([first.local_no, second.local_no, third.local_no], [1, 2, 3]);
    await db.query("UPDATE " + table + " SET deleted_at=NOW() WHERE id=$1", [second.id]);
    const fourth = await create(kind, 40);
    assert.equal(fourth.local_no, 4, kind + " must reserve numbers in trash");
    await db.query("UPDATE " + table + " SET deleted_at=NULL WHERE id=$1", [second.id]);
    assert.equal(
      (await db.query("SELECT local_no FROM " + table + " WHERE id=$1", [second.id])).rows[0]
        .local_no,
      2,
    );
    await db.query("DELETE FROM " + table + " WHERE id=$1", [second.id]);
    const replacement = await create(kind, 40);
    assert.equal(replacement.local_no, 2, kind + " must reuse a hard-deleted middle number");
    assert.notEqual(replacement.id, second.id, kind + " database IDs must remain unique");
    await db.query("DELETE FROM " + table + " WHERE id=$1", [first.id]);
    assert.equal((await create(kind, 40)).local_no, 1, kind + " must reuse number 1");
    assert.equal((await create(kind, 41)).local_no, 1, kind + " numbering must be tenant-scoped");
    await db.exec("BEGIN");
    await db.query("DELETE FROM " + table + " WHERE id=$1", [replacement.id]);
    await db.exec("ROLLBACK");
    const fifth = await create(kind, 40);
    assert.equal(fifth.local_no, 5, kind + " must not free a rolled-back deletion");
    await db.query("DELETE FROM " + table + " WHERE id=$1", [fifth.id]);
    assert.equal(
      (await create(kind, 40)).local_no,
      5,
      kind + " must reuse a deleted highest number",
    );
    assert.equal(
      (await db.query("SELECT local_no FROM " + table + " WHERE id=$1", [third.id])).rows[0]
        .local_no,
      3,
      kind + " must not renumber surviving rows",
    );
  }
  console.log(
    "PASS: all four academic kinds reuse hard-deleted local numbers; trash, restore, rollback, tenant isolation and database IDs are preserved",
  );
};
