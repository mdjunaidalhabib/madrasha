import { logActivity } from "../../shared/utils/activity.util";
import { describeDevice } from "../../shared/utils/device.util";
import { logger } from "../../shared/logger/logger";

/** Login/logout history lives in the activity log (the profile page's
 * device list only shows devices that are logged in right now). All rows
 * use this entity so the activity page can label them as security events. */
export const SECURITY_ACTIVITY_ENTITY = "security";

export const SECURITY_ACTIONS = {
  LOGIN: "LOGIN",
  LOGIN_FAILED: "LOGIN_FAILED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  LOGOUT: "LOGOUT",
  LOGOUT_DEVICE: "LOGOUT_DEVICE",
  LOGOUT_OTHERS: "LOGOUT_OTHERS",
  LOGOUT_ALL: "LOGOUT_ALL",
} as const;

export interface SessionClient {
  deviceInfo?: string | null;
  deviceId?: string | null;
  ipAddress?: string | null;
  city?: string | null;
  country?: string | null;
}

/** "ঢাকা, BD · 103.4.145.2" - whatever of place/IP is known. */
/** Loopback / LAN addresses have no public location (same machine or office network). */
const PRIVATE_IP = /^(::1$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|f[cd][0-9a-f]{2}:|fe80:)/i;

function locationLine(client: SessionClient): string | null {
  if (client.ipAddress && PRIVATE_IP.test(client.ipAddress)) return "অবস্থান: লোকাল নেটওয়ার্ক";
  const place = [client.city, client.country].filter(Boolean).join(", ");
  const text = [place, client.ipAddress].filter(Boolean).join(" · ");
  return text ? `অবস্থান: ${text}` : null;
}

export function userLine(user?: { name?: string | null; email?: string | null } | null): string | null {
  if (!user) return null;
  return `ইউজার: ${user.name || "—"}${user.email ? ` (${user.email})` : ""}`;
}

export function deviceLines(client: SessionClient): string[] {
  return [`ডিভাইস: ${describeDevice(client.deviceInfo)}`, locationLine(client)].filter(
    (line): line is string => Boolean(line),
  );
}

/** Never lets a logging failure break login/logout itself. */
export async function logSecurityEvent(args: {
  madrasaId: number;
  userId: number | null;
  action: (typeof SECURITY_ACTIONS)[keyof typeof SECURITY_ACTIONS];
  lines: Array<string | null | undefined>;
}): Promise<void> {
  try {
    await logActivity({
      madrasa_id: args.madrasaId,
      user_id: args.userId,
      action: args.action,
      entity: SECURITY_ACTIVITY_ENTITY,
      entity_id: args.userId,
      details: args.lines.filter(Boolean).join("\n") || null,
    });
  } catch (error) {
    logger.error("Security activity log failed", error);
  }
}
