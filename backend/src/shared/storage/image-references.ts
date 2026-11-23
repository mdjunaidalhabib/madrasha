import { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma";

// Scan persisted business data, including soft-deleted rows, application JSON,
// rich text, template versions and snapshots. Audit text is not a live use.
// Deriving columns from Prisma also covers new image-bearing business models.
const referenceModels = Prisma.dmmf.datamodel.models
  .filter((model) => !/Log$/.test(model.name))
  .map((model) => ({
    table: model.dbName || model.name,
    fields: model.fields.filter(
      (field) => field.kind === "scalar" && (field.type === "String" || field.type === "Json"),
    ),
  }))
  .filter((model) => model.fields.length > 0);

const identifier = (value: string) => Prisma.raw(`"${value.replace(/"/g, '""')}"`);

/** A DB error must propagate: deletion must fail closed if a reference cannot be checked. */
export async function findReferencedImageKeys(keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const sources = referenceModels.map(
    (model) => Prisma.sql`
    SELECT 1 FROM ${identifier(model.table)} WHERE ${Prisma.join(
      model.fields.map(
        (field) => Prisma.sql`
        strpos(COALESCE(${identifier(field.dbName || field.name)}::text, ''), candidate.key) > 0
      `,
      ),
      " OR ",
    )}
  `,
  );
  const rows = await prisma.$queryRaw<Array<{ key: string }>>(Prisma.sql`
    SELECT candidate.key FROM (VALUES ${Prisma.join(keys.map((key) => Prisma.sql`(${key})`))}) AS candidate(key)
    WHERE EXISTS (${Prisma.join(sources, " UNION ALL ")})
  `);
  return new Set(rows.map((row) => row.key));
}
