import { prisma } from "../../shared/database/prisma";
import { comparePassword } from "../../shared/utils/hash.util";
import { BadRequestError } from "../../shared/errors";
import { t } from "../../shared/i18n";

/** Verify the acting account on the destructive request itself. */
export async function verifyWebsiteResetPassword(userId: number | undefined, password: unknown, madrasaId?: number) {
  if (!Number.isInteger(userId) || typeof password !== "string" || !password.length) {
    throw new BadRequestError(t({ bn: "আপনার বর্তমান লগইন পাসওয়ার্ড দিন।", en: "Enter your current login password." }));
  }
  const account = madrasaId === undefined
    ? await prisma.superAdmin.findFirst({ where: { id: userId, isActive: 1 }, select: { passwordHash: true } })
    : await prisma.user.findFirst({ where: { id: userId, madrasaId }, select: { passwordHash: true } });
  if (!account?.passwordHash || !(await comparePassword(password, account.passwordHash))) {
    throw new BadRequestError(t({ bn: "পাসওয়ার্ড সঠিক নয়।", en: "Incorrect password." }));
  }
}
