// Run from the repository root with an isolated PGlite installation:
// npm install --prefix .cache/academic-db-test --no-save --ignore-scripts @electric-sql/pglite
// node backend/scripts/verify-private-academics.cjs .cache/academic-db-test/node_modules/@electric-sql/pglite
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { PGlite } = require(path.resolve(process.argv[2]));

function beforeSchema() {
  if (process.argv[3]) return fs.readFileSync(process.argv[3], "utf8");
  fs.mkdirSync(".cache", { recursive: true });
  const scratch = fs.mkdtempSync(path.resolve(".cache/academic-schema-"));
  const source = path.resolve("backend/prisma");
  for (const file of fs
    .readdirSync(source, { recursive: true })
    .filter((f) => f.endsWith(".prisma"))) {
    let text = fs.readFileSync(path.join(source, file), "utf8");
    text = text.replace(/model AcademicSequence \{[\s\S]*?\n\}/g, "");
    text = text
      .split(/\r?\n/)
      .filter((line) => !/\b(sourceTemplateId|localNo|localScopeId|academicSequences|madrasaNo)\b/.test(line))
      .join("\n");
    const target = path.join(scratch, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return renderSchema(scratch);
}

function renderSchema(schemaPath) {
  return execFileSync(
    process.execPath,
    [
      path.resolve("backend/node_modules/prisma/build/index.js"),
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      schemaPath,
      "--script",
    ],
    { cwd: path.resolve("backend"), encoding: "utf8" },
  );
}

async function main() {
  const db = new PGlite();
  try {
    await db.exec(beforeSchema());
    await db.exec(`
      INSERT INTO madrasas (id, name, slug) VALUES (1, 'A', 'a'), (2, 'B', 'b'), (3, 'C', 'c');
      INSERT INTO divisions (id, key_name, name, name_bn) VALUES (1, 'nurani', 'Nurani', 'Nurani');
      INSERT INTO classes (id, division_id, name, name_bn) VALUES (1, 1, 'First', 'First');
      INSERT INTO books (id, class_id, name, name_bn) VALUES (1, 1, 'Arabic', 'Arabic');
      SELECT setval(pg_get_serial_sequence('divisions', 'id'), 1);
      SELECT setval(pg_get_serial_sequence('classes', 'id'), 1);
      SELECT setval(pg_get_serial_sequence('books', 'id'), 1);
      INSERT INTO madrasa_divisions (madrasa_id, division_id, name_bn) VALUES (1, 1, 'A custom name'), (2, 1, NULL);
      INSERT INTO madrasa_classes (madrasa_id, class_id, reg_no_start, reg_no_end) VALUES (1, 1, 1, 50), (2, 1, 1, 50);
      INSERT INTO madrasa_books (madrasa_id, book_id, full_mark, pass_mark, is_miyari) VALUES (1, 1, 50, 20, TRUE), (2, 1, 100, NULL, FALSE);
      INSERT INTO sessions (id, madrasa_id, name, start_date, end_date, division_id) VALUES (1, 1, '2026', '2026-01-01', '2026-12-31', 1), (2, 2, '2026', '2026-01-01', '2026-12-31', 1);
      INSERT INTO students (id, madrasa_id, division_id, class_id, previous_class_id, session_id, name_bn, registration_no) VALUES (1, 1, 1, 1, 1, 1, 'Student A', 1), (2, 2, 1, 1, 1, 2, 'Student B', 1);
      INSERT INTO exams (id, madrasa_id, name, year) VALUES (1, 1, 'Annual', '2026'), (2, 2, 'Annual', '2026');
      SELECT setval(pg_get_serial_sequence('exams', 'id'), 2);
      INSERT INTO exam_divisions (exam_id, division_id) VALUES (1, 1), (2, 1);
      INSERT INTO results_master (id, madrasa_id, exam_id, class_id) VALUES (1, 1, 1, 1), (2, 2, 2, 1);
      INSERT INTO marks (madrasa_id, result_master_id, student_id, exam_id, class_id, book_id,mark) VALUES (1, 1, 1, 1, 1, 1, 42), (2, 2, 2, 2, 1, 1, 84);
      INSERT INTO exam_candidates (madrasa_id, exam_id, student_id, session_id, class_id, division_id) VALUES (1, 1, 1, 1, 1, 1), (2, 2, 2, 2, 1, 1);
      INSERT INTO promotion_batches (madrasa_id, from_class_id, to_class_id, from_year, to_year, promoted_by) VALUES (1, 1, 1, '2026', '2027', 1);
      INSERT INTO classes (id, division_id, name_bn, owner_madrasa_id) VALUES (100, 1, 'Private class', 1);
      INSERT INTO books (id, class_id, name_bn, owner_madrasa_id) VALUES (100, 1, 'Private book', 1);
    `);
    await db.exec(
      fs.readFileSync(
        "backend/prisma/migrations/20261120010000_private_integer_academic_snapshots/migration.sql",
        "utf8",
      ),
    );
    await db.exec(fs.readFileSync("backend/prisma/migrations/20261121010000_reusable_institution_numbers/migration.sql", "utf8"));
    const rows = (
      await db.query(`SELECT s.madrasa_id, s.division_id, s.class_id, m.book_id, m.mark,
      d.owner_madrasa_id AS division_owner, c.owner_madrasa_id AS class_owner, b.owner_madrasa_id AS book_owner,
      c.division_id AS parent_division, b.class_id AS parent_class
      FROM students s JOIN marks m ON m.student_id = s.id
      JOIN divisions d ON d.id = s.division_id JOIN classes c ON c.id = s.class_id JOIN books b ON b.id = m.book_id
      ORDER BY s.madrasa_id`)
    ).rows;
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.division_owner, row.madrasa_id);
      assert.equal(row.class_owner, row.madrasa_id);
      assert.equal(row.book_owner, row.madrasa_id);
      assert.equal(row.parent_division, row.division_id);
      assert.equal(row.parent_class, row.class_id);
    }
    assert.notEqual(rows[0].division_id, rows[1].division_id);
    assert.notEqual(rows[0].class_id, rows[1].class_id);
    assert.notEqual(rows[0].book_id, rows[1].book_id);
    assert.deepEqual(
      rows.map((r) => r.mark),
      [42, 84],
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT s.previous_class_id, s.class_id FROM students s ORDER BY s.madrasa_id",
        )
      ).rows.map((r) => r.previous_class_id === r.class_id),
      [true, true],
    );
    for (const row of rows) {
      for (const table of ["sessions", "exam_candidates"]) {
        assert.equal(
          (
            await db.query("SELECT division_id FROM " + table + " WHERE madrasa_id=$1", [
              row.madrasa_id,
            ])
          ).rows[0].division_id,
          row.division_id,
        );
      }
      for (const table of ["results_master", "exam_candidates"]) {
        assert.equal(
          (
            await db.query("SELECT class_id FROM " + table + " WHERE madrasa_id=$1", [
              row.madrasa_id,
            ])
          ).rows[0].class_id,
          row.class_id,
        );
      }
      assert.equal(
        (
          await db.query(
            "SELECT ed.division_id FROM exam_divisions ed JOIN exams e ON e.id=ed.exam_id WHERE e.madrasa_id=$1",
            [row.madrasa_id],
          )
        ).rows[0].division_id,
        row.division_id,
      );
    }
    assert.deepEqual(
      (await db.query("SELECT from_class_id,to_class_id FROM promotion_batches WHERE madrasa_id=1"))
        .rows[0],
      { from_class_id: rows[0].class_id, to_class_id: rows[0].class_id },
    );
    assert.equal(
      (await db.query("SELECT division_id FROM classes WHERE id=100")).rows[0].division_id,
      rows[0].division_id,
    );
    assert.equal(
      (await db.query("SELECT class_id FROM books WHERE id=100")).rows[0].class_id,
      rows[0].class_id,
    );
    assert.equal(
      (
        await db.query(
          "SELECT COUNT(*)::INTEGER AS n FROM divisions WHERE owner_madrasa_id IS NULL",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query("SELECT name_bn FROM madrasa_divisions WHERE madrasa_id=1")).rows[0].name_bn,
      "A custom name",
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT full_mark, pass_mark, is_miyari FROM madrasa_books WHERE madrasa_id=1",
        )
      ).rows[0],
      { full_mark: 50, pass_mark: 20, is_miyari: true },
    );
    for (const table of ["madrasa_divisions", "madrasa_classes", "madrasa_books", "exams"]) {
      assert.deepEqual(
        (await db.query("SELECT local_no FROM " + table + " ORDER BY madrasa_id")).rows.map(
          (r) => r.local_no,
        ),
        [1, 1],
      );
    }
    await assert.rejects(
      db.exec(
        "INSERT INTO madrasa_divisions (madrasa_id, division_id) VALUES (3, " +
          rows[0].division_id +
          " )",
      ),
      /another institution/,
    );
    await assert.rejects(
      db.exec(
        "INSERT INTO classes (owner_madrasa_id, division_id, name_bn) VALUES (3, " +
          rows[0].division_id +
          ", 'Foreign parent')",
      ),
      /another institution/,
    );
    await assert.rejects(
      db.exec(
        "INSERT INTO books (owner_madrasa_id, class_id, name_bn) VALUES (3, " +
          rows[0].class_id +
          ", 'Foreign parent')",
      ),
      /another institution/,
    );
    await db.exec("INSERT INTO exams (madrasa_id, name, year) VALUES (1, 'Monthly', '2026')");
    assert.equal(
      (await db.query("SELECT local_no FROM exams WHERE madrasa_id=1 AND name='Monthly'")).rows[0]
        .local_no,
      2,
    );
    await db.exec("UPDATE exams SET sort_order=99 WHERE madrasa_id=1 AND name='Annual'");
    assert.equal(
      (await db.query("SELECT local_no FROM exams WHERE madrasa_id=1 AND name='Annual'")).rows[0]
        .local_no,
      1,
    );
    await db.exec("DELETE FROM exams WHERE madrasa_id=1 AND name='Monthly'");
    await db.exec(
      "INSERT INTO exams (madrasa_id,name,year) VALUES (1,'New','2026'),(2,'Monthly','2026'),(3,'Annual','2026')",
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT madrasa_id,local_no FROM exams WHERE name IN ('New','Monthly') OR madrasa_id=3 ORDER BY madrasa_id",
        )
      ).rows,
      [
        { madrasa_id: 1, local_no: 3 },
        { madrasa_id: 2, local_no: 2 },
        { madrasa_id: 3, local_no: 1 },
      ],
    );
    await assert.rejects(db.exec("UPDATE exams SET local_no=20 WHERE id=1"), /immutable/);
    await require("./verify-academic-number-reuse.cjs")(db);
    await require("./verify-personnel-number-reuse.cjs")(db);
    await require("./verify-parent-scoped-academics.cjs")(db);
    const expected = new PGlite();
    try {
      await expected.exec(renderSchema(path.resolve("backend/prisma")));
      const columns = "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name";
      assert.deepEqual((await db.query(columns)).rows, (await expected.query(columns)).rows);
      const indexes = "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname";
      assert.deepEqual((await db.query(indexes)).rows, (await expected.query(indexes)).rows);
    } finally {
      await expected.close();
    }
    console.log(
      "PASS: private IDs, parent links, historical references, settings, local numbers and ownership guards",
    );
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
