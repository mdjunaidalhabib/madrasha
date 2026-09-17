import { prisma } from "../database/prisma";
import { isMuhtamimRole, isSuperAdminRole, normalizeAppRole } from "../permissions";
import { getRolePermissions } from "../middleware/rbac.middleware";

/**
 * Muhtamim/Super Admin already bypass every granular RBAC permission check
 * (see rbac.middleware.ts) - a genuinely single-admin madrasa has no second
 * person to hand a maker/checker step to, so those two roles are the
 * built-in escape hatch from any separation-of-duties check (e.g. "can't
 * verify your own submission", "can't approve a result you verified"),
 * exactly like every other permission gate in this app.
 */
export async function isPrivilegedActor(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { keyName: true, nameBn: true } } },
  });
  const role = normalizeAppRole(user?.role?.keyName || user?.role?.nameBn || "");
  return isSuperAdminRole(role) || isMuhtamimRole(role);
}

/**
 * True for an actor who holds full authority over marks entry AND
 * verification (both marks.submit and marks.verify, or the legacy
 * result.manage catch-all) - the common single-office-staff madrasa where
 * one TALIMAT account does the whole marks-entry lifecycle. For that actor,
 * the per-subject SUBMITTED/VERIFIED lock in ResultPanelService.saveMarks
 * exists only to satisfy processResult's "everything submitted+verified"
 * precondition, not as a real separation-of-duties gate (there is no
 * second person here to gate against) - so their own edits to an
 * already-submitted/verified subject are let through instead of rejected,
 * with that subject's MarkSubmission status quietly reverted to DRAFT
 * (see saveMarks) so the badge stays honest and the next submit+verify
 * pass re-covers it. A role limited to just ONE of these two permissions
 * (a genuine separate teacher/verifier) still hits the real lock.
 */
export async function hasFullMarksAuthority(userId: number): Promise<boolean> {
  if (await isPrivilegedActor(userId)) return true;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { roleId: true } });
  if (!user?.roleId) return false;

  const perms = await getRolePermissions(user.roleId);
  if (perms.includes("result.manage")) return true;
  return perms.includes("marks.submit") && perms.includes("marks.verify");
}

/**
 * True for an actor who holds full authority over the result-level
 * verify/approve stage (both result.verify and result.approve, or the
 * legacy result.manage catch-all) - the তালিমাত office in the common case
 * where one account owns the whole verify-result -> approve -> publish
 * tail of the workflow. Mirrors hasFullMarksAuthority's reasoning one
 * level up the pipeline: there is no second person to hand a maker/checker
 * step to, so this is the escape hatch resultPanelService.publishResult
 * uses to silently walk PROCESSING/RESULT_VERIFIED through to APPROVED in
 * the same click as Publish, and the one decideApproval's
 * "can't approve your own verified result" guard defers to instead of the
 * narrower isPrivilegedActor check. A madrasa that later splits verifier
 * and approver into separate people/roles (only one of the two
 * permissions each) still hits the real gate, exactly as intended.
 */
export async function hasFullResultAuthority(userId: number): Promise<boolean> {
  if (await isPrivilegedActor(userId)) return true;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { roleId: true } });
  if (!user?.roleId) return false;

  const perms = await getRolePermissions(user.roleId);
  if (perms.includes("result.manage")) return true;
  return perms.includes("result.verify") && perms.includes("result.approve");
}
