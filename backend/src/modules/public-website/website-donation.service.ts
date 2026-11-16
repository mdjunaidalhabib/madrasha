import { z } from "zod";
import { prisma } from "../../shared/database/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { getWebsiteTemplate } from "./website-template.service";

async function donationDemoForInstitution(id: number) {
  const institution = await prisma.madrasa.findFirst({ where: { id, deletedAt: null }, select: { name: true } });
  if (!institution) throw new NotFoundError("Institution not found");
  const { content } = await getWebsiteTemplate();
  const replace = (value: string) => value.split("{{institution_name}}").join(institution.name);
  return { published: false, title: replace(content.donation.title).slice(0, 150), description: replace(content.donation.description).slice(0, 4000),
    instructions: replace(content.donation.instructions).slice(0, 2000), contactPhone: "", checkoutUrl: "", methods: [] };
}

const text = (max: number) => z.string().trim().max(max);
export const donationConfigSchema = z.object({
  published: z.boolean(),
  title: text(150),
  description: text(4000),
  instructions: text(2000),
  contactPhone: text(25).regex(/^[+\d\s()-]*$/, "Invalid contact phone"),
  checkoutUrl: text(1000).refine((value) => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
    catch { return false; }
  }, "Payment link must be a valid HTTPS URL"),
  methods: z.array(z.object({
    type: z.enum(["bkash", "nagad", "rocket", "bank"]),
    accountName: text(150).min(1, "Account holder name is required"),
    accountNumber: text(80).min(1, "Account number is required"),
    details: text(500),
    accountType: z.enum(["personal", "merchant", "savings", "current"]).optional(),
    bankName: text(120).optional(),
    branchName: text(120).optional(),
    routingNumber: text(9).regex(/^(\d{9})?$/, "Routing number must contain 9 digits").optional(),
  }).strict().superRefine((method, ctx) => {
    if (method.accountType && !(method.type === "bank" ? ["savings", "current"] : ["personal", "merchant"]).includes(method.accountType)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose a valid account type for this payment method" });
    }
    if (method.type === "bank" && method.accountType && (!method.bankName || !method.branchName)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ব্যাংক ও শাখার নাম দিন / Enter the bank and branch names" });
    }
    if (method.type !== "bank" && (method.bankName || method.branchName || method.routingNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank details are only supported for bank transfers" });
    }
  })).max(10),
}).strict().superRefine((config, ctx) => {
  if (config.published && (!config.title || (!config.methods.length && !config.checkoutUrl))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "প্রকাশ করতে শিরোনাম এবং অন্তত একটি পেমেন্ট মাধ্যম বা লিংক দিন / Add a title and a payment method or link before publishing" });
  }
});

export function publicDonationConfig(row: { allowed: boolean; config: unknown } | null) {
  if (!row?.allowed) return null;
  const result = donationConfigSchema.safeParse(row.config);
  return result.success && result.data.published ? result.data : null;
}

async function assertInstitution(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestError("Invalid institution ID");
  if (!await prisma.madrasa.findFirst({ where: { id, deletedAt: null }, select: { id: true } })) {
    throw new NotFoundError("Institution not found");
  }
}

export const websiteDonationService = {
  async get(id: number) {
    await assertInstitution(id);
    const row = await prisma.websiteDonationSettings.findUnique({ where: { madrasaId: id } });
    const parsed = donationConfigSchema.safeParse(row?.config);
    return { allowed: row?.allowed === true,
      config: parsed.success ? parsed.data : row?.allowed ? await donationDemoForInstitution(id) : null };
  },
  async demo(id: number) {
    const access = await prisma.websiteDonationSettings.findUnique({ where: { madrasaId: id }, select: { allowed: true } });
    if (!access?.allowed) throw new ForbiddenError("Donation access requires super admin approval");
    return donationDemoForInstitution(id);
  },
  async setAccess(id: number, input: unknown) {
    const result = z.object({ allowed: z.boolean() }).strict().safeParse(input);
    if (!result.success) throw new BadRequestError("allowed must be a boolean");
    await assertInstitution(id);
    const config = result.data.allowed ? await donationDemoForInstitution(id) : {};
    const row = await prisma.websiteDonationSettings.upsert({
      where: { madrasaId: id }, create: { madrasaId: id, allowed: result.data.allowed, config },
      update: { allowed: result.data.allowed },
    });
    return { allowed: row.allowed };
  },
  async save(id: number, input: unknown) {
    const result = donationConfigSchema.safeParse(input);
    if (!result.success) throw new BadRequestError(result.error.issues[0].message);
    // Atomic conditional write: a revoked grant cannot be bypassed by a stale admin page.
    const saved = await prisma.websiteDonationSettings.updateMany({
      where: { madrasaId: id, allowed: true, madrasa: { deletedAt: null } },
      data: { config: result.data },
    });
    if (!saved.count) throw new ForbiddenError("অনুদান সুবিধার জন্য সুপার অ্যাডমিনের অনুমতি প্রয়োজন / Donation access requires super admin approval");
    return result.data;
  },
};
