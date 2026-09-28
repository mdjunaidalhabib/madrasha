import { z } from "zod";
import { vmsg } from "../../shared/validators/messages";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().min(1, vmsg({ bn: "ইমেইল আবশ্যক", en: "Email is required" })),
    password: z.string().min(1, vmsg({ bn: "পাসওয়ার্ড আবশ্যক", en: "Password is required" })),
  }),
});

export const unlockSchema = z.object({
  body: z.object({
    password: z.string().min(1, vmsg({ bn: "পাসওয়ার্ড আবশ্যক", en: "Password is required" })),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().min(1, vmsg({ bn: "ইমেইল আবশ্যক", en: "Email is required" })),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, vmsg({ bn: "টোকেন আবশ্যক", en: "Token is required" })),
    new_password: z.string().min(6, vmsg({ bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", en: "Password must be at least 6 characters" })),
  }),
});

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, vmsg({ bn: "নাম আবশ্যক", en: "Name is required" })).optional(),
    mobile: z.string().trim().max(20).optional().or(z.literal("")),
    photo_url: z.string().trim().optional().or(z.literal("")),
  }),
});

export const changeMyPasswordSchema = z.object({
  body: z.object({
    current_password: z.string().min(1, vmsg({ bn: "বর্তমান পাসওয়ার্ড আবশ্যক", en: "Current password is required" })),
    new_password: z.string().min(6, vmsg({ bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", en: "Password must be at least 6 characters" })),
  }),
});

export const verifyMyPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(1, vmsg({ bn: "পাসওয়ার্ড আবশ্যক", en: "Password is required" })),
  }),
});

// refreshToken is optional in the body since the browser client sends it as
// an httpOnly cookie instead - the controller falls back to the cookie when
// the body omits it. Kept in the schema for non-browser clients.
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1).optional(),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1).optional(),
  }),
});

// keep_current=true means "logout from OTHER devices" (this session stays
// signed in); omitted/false means every session including this one.
export const logoutAllSchema = z.object({
  body: z.object({
    keep_current: z.boolean().optional(),
  }),
});
