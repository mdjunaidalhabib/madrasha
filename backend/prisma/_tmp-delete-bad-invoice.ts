import { prisma } from "../src/shared/database/prisma";

async function main() {
  const invoice = await prisma.invoice.findUnique({ where: { id: 5126 } });
  if (!invoice || invoice.feeStructureId !== 1170 || invoice.studentId !== 391 || Number(invoice.paidAmount) !== 0) {
    throw new Error(`Safety check failed - unexpected invoice state: ${JSON.stringify(invoice)}`);
  }
  const deleted = await prisma.invoice.delete({ where: { id: 5126 } });
  console.log("Deleted invoice:", JSON.stringify(deleted, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
