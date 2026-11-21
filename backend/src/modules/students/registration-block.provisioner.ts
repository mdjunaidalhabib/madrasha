import { TransactionClient } from "../../shared/database/transaction";
import { lockStudentRegistrationScopeOnTx } from "./registration-no.allocator";

/**
 * Gives every active class that has no registration-number block yet a
 * block sized by the plan's per-বিভাগ block size (PlanDivisionRegBlock -
 * default: 50 per madrasa class), laid out one after
 * another in the madrasa's own বিভাগ → শ্রেণি order, starting after the
 * highest number already reserved or used.
 *
 * Only fills gaps: a class that already has a block - including one the
 * madrasa admin edited by hand - is never touched. Runs on madrasa creation,
 * plan change, madrasa edit (new classes activated) and when a class is
 * added from the admin panel.
 *
 * `planId` defaults to the madrasa's current (active) subscription plan;
 * without a plan, classes use the allocator's no-block fallback. Custom
 * madrasa divisions without a configured plan size receive 50 numbers.
 */
export async function assignMissingRegistrationBlocksOnTx(
  tx: TransactionClient,
  madrasaId: number,
  planId?: number | null,
): Promise<number> {
  const resolvedPlanId =
    planId ??
    (
      await tx.madrasaSubscription.findFirst({
        where: { madrasaId, isActive: 1 },
        orderBy: { id: "desc" },
        select: { planId: true },
      })
    )?.planId;
  if (!resolvedPlanId) return 0;
  await lockStudentRegistrationScopeOnTx(tx, madrasaId);

  const sizes = await tx.planDivisionRegBlock.findMany({
    where: { planId: resolvedPlanId, blockSize: { gt: 0 } },
    select: { divisionId: true, blockSize: true },
  });
  const sizeByDivision = new Map(sizes.map((s) => [s.divisionId, s.blockSize]));

  const [divisionOrder, missing] = await Promise.all([
    tx.madrasaDivision.findMany({
      where: { madrasaId },
      select: {
        divisionId: true,
        sortOrder: true,
        division: { select: { sourceTemplateId: true, institutionType: true } },
      },
    }),
    tx.madrasaClass.findMany({
      where: {
        madrasaId,
        isActive: 1,
        regNoStart: null,
      },
      select: { id: true, sortOrder: true, class: { select: { divisionId: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);
  const blockSize = (divisionId: number) => {
    const division = divisionOrder.find((d) => d.divisionId === divisionId)?.division;
    return (
      sizeByDivision.get(division?.sourceTemplateId ?? divisionId) ??
      (division?.institutionType === "MADRASA" ? 50 : undefined)
    );
  };
  const eligible = missing.filter(
    (row) => row.class.divisionId != null && blockSize(row.class.divisionId) != null,
  );
  if (!eligible.length) return 0;

  const divisionRank = new Map(divisionOrder.map((d) => [d.divisionId, d.sortOrder]));
  eligible.sort(
    (a, b) =>
      (divisionRank.get(a.class.divisionId!) ?? 0) - (divisionRank.get(b.class.divisionId!) ?? 0) ||
      a.class.divisionId! - b.class.divisionId! ||
      a.sortOrder - b.sortOrder ||
      a.id - b.id,
  );

  // Same lock as number allocation, so a block is never laid over a number
  // being handed out concurrently.
  const [blocks, used] = await Promise.all([
    tx.madrasaClass.aggregate({ where: { madrasaId }, _max: { regNoEnd: true } }),
    tx.student.aggregate({ where: { madrasaId }, _max: { registrationNo: true } }),
  ]);
  let cursor = Math.max(blocks._max.regNoEnd ?? 0, used._max.registrationNo ?? 0);

  for (const row of eligible) {
    const size = blockSize(row.class.divisionId!)!;
    await tx.madrasaClass.update({
      where: { id: row.id },
      data: { regNoStart: cursor + 1, regNoEnd: cursor + size },
    });
    cursor += size;
  }
  return eligible.length;
}
