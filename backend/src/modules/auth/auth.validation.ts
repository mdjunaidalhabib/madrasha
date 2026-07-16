import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().min(1, "Email is required"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const unlockSchema = z.object({
  body: z.object({
    password: z.string().min(1, "Password is required"),
  }),
});
