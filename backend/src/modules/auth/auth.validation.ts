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

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().min(1, "Email is required"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
    new_password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Name is required").optional(),
    mobile: z.string().trim().max(20).optional().or(z.literal("")),
    photo_url: z.string().trim().optional().or(z.literal("")),
  }),
});

export const changeMyPasswordSchema = z.object({
  body: z.object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});
