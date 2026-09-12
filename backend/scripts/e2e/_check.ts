import { prisma } from "../../src/shared/database/prisma";
const j = (v: unknown) => JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? Number(val) : val));
async function main() {
  const inRange = await prisma.$queryRawUnsafe(`SELECT COUNT(*) c FROM students WHERE madrasa_id=21 AND roll BETWEEN 1000 AND 1199`);
  console.log("bulk-range(1000-1199) count madrasaA", j(inRange));

  const outRange = await prisma.$queryRawUnsafe(`SELECT id, roll, registration_no, name_bn, is_active, admission_status FROM students WHERE madrasa_id=21 AND roll > 1199 ORDER BY roll LIMIT 20`);
  console.log("outlier rows madrasaA", j(outRange));

  const outRangeCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) c FROM students WHERE madrasa_id=21 AND roll > 1199`);
  console.log("outlier count madrasaA", j(outRangeCount));

  const nameSample = await prisma.$queryRawUnsafe(`SELECT name_bn, COUNT(*) c FROM students WHERE madrasa_id=21 AND roll > 1199 GROUP BY name_bn ORDER BY c DESC LIMIT 10`);
  console.log("outlier name distribution madrasaA", j(nameSample));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
