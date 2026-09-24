import { TransactionClient } from "../../shared/database/transaction";
import { lockStudentRegistrationScopeOnTx } from "./registration-no.allocator";

/**
 * Gives every active class that has no registration-number block yet a
 * block sized by the plan's per-বিভাগ block size (PlanDivisionRegBlock -
 * e.g. Basic: নূরানী 30, নাযেরা/হিফজ 40, কিতাব 20), laid out one after
 * another in the madrasa's own বিভাগ → শ্রেণি order, starting after the
 * highest number already reserved or used.
 *
 * Only fills gaps: a class that already has a block - including one the
 * madrasa admin edited by hand - is never touched. Runs on madrasa creation,
 * plan change, madrasa edit (new classes activated) and when a class is
 * added from the admin panel.
 *
 * `planId` defaults to the madrasa's current (active) subscription plan;
 * with no plan, or no size set for a বিভাগ, those classes are left without
 * a block (they then use the no-block fallback in the allocator).
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

  const sizes = await tx.planDivisionRegBlock.findMany({
    where: { planId: resolvedPlanId, blockSize: { gt: 0 } },
    select: { divisionId: true, blockSize: true },
  });
  if (!sizes.length) return 0;
  const sizeByDivision = new Map(sizes.map((s) => [s.divisionId, s.blockSize]));

  const [divisionOrder, missing] = await Promise.all([
    tx.madrasaDivision.findMany({
      where: { madrasaId },
      select: { divisionId: true, sortOrder: true },
    }),
    tx.madrasaClass.findMany({
      where: {
        madrasaId,
        isActive: 1,
        regNoStart: null,
        class: { divisionId: { in: [...sizeByDivision.keys()] } },
      },
      select: { id: true, sortOrder: true, class: { select: { divisionId: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);
  if (!missing.length) return 0;

  const divisionRank = new Map(divisionOrder.map((d) => [d.divisionId, d.sortOrder]));
  missing.sort(
    (a, b) =>
      (divisionRank.get(a.class.divisionId!) ?? 0) - (divisionRank.get(b.class.divisionId!) ?? 0) ||
      a.class.divisionId! - b.class.divisionId! ||
      a.sortOrder - b.sortOrder ||
      a.id - b.id,
  );

  // Same lock as number allocation, so a block is never laid over a number
  // being handed out concurrently.
  await lockStudentRegistrationScopeOnTx(tx, madrasaId);
  const [blocks, used] = await Promise.all([
    tx.madrasaClass.aggregate({ where: { madrasaId }, _max: { regNoEnd: true } }),
    tx.student.aggregate({ where: { madrasaId }, _max: { registrationNo: true } }),
  ]);
  let cursor = Math.max(blocks._max.regNoEnd ?? 0, used._max.registrationNo ?? 0);

  for (const row of missing) {
    const size = sizeByDivision.get(row.class.divisionId!)!;
    await tx.madrasaClass.update({
      where: { id: row.id },
      data: { regNoStart: cursor + 1, regNoEnd: cursor + size },
    });
    cursor += size;
  }
  return missing.length;
}
