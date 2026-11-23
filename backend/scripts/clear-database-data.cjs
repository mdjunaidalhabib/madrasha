// Explicitly requested full data reset. Keep schema, functions, triggers and
// Prisma migration history; do not run seed. Dry-run unless --execute is passed.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const quote = (value) => '"' + value.replace(/"/g, '""') + '"';

async function main() {
  const execute = process.argv.includes('--execute');
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    const [target] = await tx.$queryRaw`
      SELECT current_schema() AS schema, current_database() AS database
    `;
    if (!target?.schema || target.schema.startsWith('pg_') || target.schema === 'information_schema')
      throw new Error('Refusing to clear a system or unresolved schema');
    const tables = await tx.$queryRaw`
      SELECT tablename AS name FROM pg_tables
      WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `;
    if (!tables.length) throw new Error('No application tables found');
    // Supplying every table together resolves application FK dependencies.
    // No CASCADE: unexpected references outside this list must stop the reset.
    const qualified = (name) => `${quote(target.schema)}.${quote(name)}`;
    const countSql = tables.map(({ name }) =>
      `SELECT '${name.replace(/'/g, "''")}' AS name, COUNT(*)::bigint AS rows FROM ${qualified(name)}`
    ).join(' UNION ALL ');
    const before = await tx.$queryRawUnsafe(countSql);
    const migrationTable = await tx.$queryRaw`
      SELECT 1 FROM pg_tables WHERE schemaname = current_schema() AND tablename = '_prisma_migrations'
    `;
    const migrationSql = `SELECT COUNT(*)::bigint AS rows FROM ${qualified('_prisma_migrations')}`;
    const migrationsBefore = migrationTable.length ? await tx.$queryRawUnsafe(migrationSql) : [];
    const summary = { database: target.database, schema: target.schema, tableCount: tables.length,
      rowsBefore: before.reduce((sum, row) => sum + Number(row.rows), 0),
      nonemptyTables: before.filter((row) => row.rows > 0n).map((row) => ({ name: row.name, rows: Number(row.rows) })) };
    if (!execute) return { mode: 'dry-run', ...summary };
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map(({ name }) => qualified(name)).join(', ')} RESTART IDENTITY`);
    const after = await tx.$queryRawUnsafe(countSql);
    const remainingRows = after.reduce((sum, row) => sum + Number(row.rows), 0);
    if (remainingRows !== 0) throw new Error('Reset verification failed; rolling back');
    const migrationsAfter = migrationTable.length ? await tx.$queryRawUnsafe(migrationSql) : [];
    if (migrationsBefore[0]?.rows !== migrationsAfter[0]?.rows)
      throw new Error('Migration history changed; rolling back');
    return { mode: 'cleared', ...summary, remainingRows, identitiesRestarted: true, migrationsPreserved: true, seedRun: false };
  }, { timeout: 60000, maxWait: 10000 });
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  // Do not print connection strings or database credentials in error output.
  console.error(JSON.stringify({ status: 'failed', code: error.errorCode || error.code || error.name,
    message: 'Database reset did not complete. The reset transaction is atomic.' }));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
