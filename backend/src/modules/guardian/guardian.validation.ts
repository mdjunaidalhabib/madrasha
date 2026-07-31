import { z } from "zod";

export const guardianLoginSchema = z.object({
  body: z.object({
    phone: z.string().trim().min(1, "Phone is required"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const guardianChangePasswordSchema = z.object({
  body: z.object({
    new_password: z.string().min(4, "Password must be at least 4 characters"),
  }),
});
