// Run from the repository root:
// node backend/scripts/verify-transactional-madrasa-ids.cjs .cache/academic-db-test/node_modules/@electric-sql/pglite
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require(path.resolve(process.argv[2]));
const migration = fs.readFileSync(
  "backend/prisma/migrations/20261123120000_transactional_madrasa_ids/migration.sql",
  "utf8",
);

async function verify(existing) {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE madrasas (id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE)");
    if (existing) {
      await db.exec("INSERT INTO madrasas (name,slug) VALUES ('Existing','existing'); SELECT setval('madrasas_id_seq',7,true)");
    }
    await db.exec(fs.readFileSync(
      "backend/prisma/migrations/20261121010000_reusable_institution_numbers/migration.sql", "utf8",
    ));
    await db.exec(migration);
    const insert = async (slug) => (await db.query(
      "INSERT INTO madrasas (name,slug) VALUES ('Test',$1) RETURNING id,madrasa_no", [slug],
    )).rows[0];
    const first = await insert("first");
    assert.equal(first.id, existing ? 8 : 1);
    if (existing) {
      assert.deepEqual((await db.query("SELECT id,madrasa_no FROM madrasas WHERE slug='existing'")).rows, [{ id: 1, madrasa_no: 1 }]);
    }

    // Provisioning fails AFTER the madrasa row was inserted.
    await db.exec("BEGIN");
    const provisional = await insert("failed-provisioning");
    await assert.rejects(() => db.exec("SELECT 1/0"));
    await db.exec("ROLLBACK");
    const second = await insert("second");
    assert.deepEqual(second, provisional);

    // A statement constraint failure must not consume an ID either.
    await assert.rejects(() => insert("second"));
    const third = await insert("third");
    assert.equal(third.id, second.id + 1);
    await assert.rejects(() => db.exec("INSERT INTO madrasas (name,slug) VALUES ('Test','batch'),('Test','second')"));
    const fourth = await insert("fourth");
    assert.equal(fourth.id, third.id + 1);

    // Deleting the highest committed ID must never release it.
    await db.query("DELETE FROM madrasas WHERE id=$1", [fourth.id]);
    const replacement = await insert("replacement");
    assert.equal(replacement.id, fourth.id + 1);
    assert.equal(replacement.madrasa_no, fourth.madrasa_no);
    await assert.rejects(() => db.query(
      "INSERT INTO madrasas (id,name,slug) VALUES ($1,'Test','reused')", [fourth.id],
    ));
    await assert.rejects(() => db.query("UPDATE madrasas SET id=1000 WHERE id=$1", [first.id]));
    await db.query("UPDATE madrasas SET name='Renamed' WHERE id=$1", [first.id]);

    // Explicit imports can advance the counter but cannot reuse old IDs.
    await db.exec("INSERT INTO madrasas (id,name,slug) VALUES (100,'Imported','imported')");
    assert.equal((await insert("after-import")).id, 101);
    await db.exec("UPDATE madrasa_id_counter SET last_id=2147483647 WHERE id=1");
    await assert.rejects(() => insert("overflow"));
  } finally {
    await db.close();
  }
}

(async () => {
  await verify(false);
  await verify(true);
  console.log("PASS: failed creates release IDs; committed IDs never reused; existing IDs preserved; imports, rollback, constraints and overflow verified.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
