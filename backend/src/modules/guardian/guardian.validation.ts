import { z } from "zod";
import { vmsg } from "../../shared/validators/messages";

export const guardianLoginSchema = z.object({
  body: z.object({
    phone: z.string().trim().min(1, vmsg({ bn: "ফোন নম্বর আবশ্যক", en: "Phone is required", ar: "رقم الهاتف مطلوب" })),
    password: z.string().min(1, vmsg({ bn: "পাসওয়ার্ড আবশ্যক", en: "Password is required", ar: "كلمة المرور مطلوبة" })),
  }),
});

export const guardianChangePasswordSchema = z.object({
  body: z.object({
    new_password: z.string().min(4, vmsg({ bn: "পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে", en: "Password must be at least 4 characters", ar: "يجب أن تتكون كلمة المرور من 4 أحرف على الأقل" })),
  }),
});
