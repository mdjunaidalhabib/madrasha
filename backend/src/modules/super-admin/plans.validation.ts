import { z } from "zod";
import { BadRequestError } from "../../shared/errors";
import { t } from "../../shared/i18n";

const money = z.coerce.number().finite().min(0).max(99_999_999);
const flag = z
  .union([z.literal(0), z.literal(1), z.literal("0"), z.literal("1"), z.boolean()])
  .transform(Number);
const schema = z
  .object({
    name: z.string().trim().min(1).max(100),
    studentLimit: z.coerce.number().int().min(0),
    userLimit: z.coerce.number().int().min(0).nullable(),
    durationDays: z.coerce.number().int().min(1),
    price: money,
    renewalPrice: money.nullable(),
    extraStudentPriceFirst: money.nullable(),
    extraStudentPriceRenewal: money.nullable(),
    nameBn: z.string().trim().nullable(),
    tagline: z.string().trim().nullable(),
    taglineBn: z.string().trim().nullable(),
    showOnLanding: flag,
    isFeatured: flag,
    isActive: flag,
    sortOrder: z.coerce.number().int().min(0),
    accentColor: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
      .nullable(),
  })
  .refine((p) => p.renewalPrice === null || p.renewalPrice <= p.price, {
    path: ["renewalPrice"],
    message: "Renewal price exceeds first-year price",
  });

const aliases: Record<string, string> = {
  student_limit: "studentLimit",
  user_limit: "userLimit",
  duration_days: "durationDays",
  is_active: "isActive",
  renewal_price: "renewalPrice",
  extra_student_price_first: "extraStudentPriceFirst",
  extra_student_price_renewal: "extraStudentPriceRenewal",
  name_bn: "nameBn",
  tagline_bn: "taglineBn",
  show_on_landing: "showOnLanding",
  is_featured: "isFeatured",
  accent_color: "accentColor",
  sort_order: "sortOrder",
};
export function parsePlanFields(input: object, existing?: object) {
  const fields: Record<string, unknown> = {
    studentLimit: 0,
    userLimit: null,
    durationDays: 365,
    price: 0,
    renewalPrice: null,
    extraStudentPriceFirst: null,
    extraStudentPriceRenewal: null,
    nameBn: null,
    tagline: null,
    taglineBn: null,
    accentColor: null,
    showOnLanding: 1,
    isFeatured: 0,
    isActive: 1,
    sortOrder: 0,
    ...existing,
  };
  for (const [key, value] of Object.entries(input))
    if (value !== undefined) fields[aliases[key] ?? key] = value;
  for (const key of [
    "price",
    "renewalPrice",
    "extraStudentPriceFirst",
    "extraStudentPriceRenewal",
  ]) {
    if (fields[key] != null) fields[key] = Number(fields[key]);
  }
  const result = schema.safeParse(fields);
  if (!result.success)
    throw new BadRequestError(
      t({
        bn: "প্ল্যানের তথ্য সঠিক নয়। মূল্য, সীমা ও রং পরীক্ষা করুন।",
        en: "Invalid plan fields. Check prices, limits and color.",
      }),
      result.error.flatten(),
    );
  return result.data;
}
