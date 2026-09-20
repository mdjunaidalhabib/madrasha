import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../../shared/logger/logger";
import { attendanceDeviceRepository } from "./attendance-device.repository";
import { hashDeviceKey } from "./device-secret.util";

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

const reject = (req: Request, res: Response, status: number, message: string, reason: string) => {
  // Never log the key itself, only that auth failed and why.
  logger.warn("Attendance device connector auth failed", {
    reason,
    status,
    tenant: req.tenant?.slug,
    ip: req.ip,
    path: req.path,
  });
  return res.status(status).json({ success: false, message });
};

/**
 * Authenticates the local Connector (a machine, not a logged-in user) by its
 * raw device key in `x-device-key`. Must run after tenantMiddleware.
 *
 *  - the key hash is looked up ONLY inside the request's tenant madrasa, so a
 *    key of madrasa A can never act on madrasa B;
 *  - if the request names a device_id (body/query) it must equal the
 *    authenticated device's code, and institution_id (if sent) must equal the
 *    tenant madrasa id. The madrasa is never taken from the body.
 */
export const attendanceDeviceConnectorAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawKey = req.headers["x-device-key"];
    if (!rawKey || typeof rawKey !== "string" || rawKey.length > 200) {
      return reject(req, res, 401, "Device key required", "missing_key");
    }

    const madrasaId = Number(req.tenant?.madrasa_id);
    if (!madrasaId) return reject(req, res, 400, "Madrasa not found in tenant", "no_tenant");

    const device = await attendanceDeviceRepository.findByKeyHash(madrasaId, hashDeviceKey(rawKey));
    if (!device) return reject(req, res, 401, "Invalid device key", "unknown_key");
    if (!device.isActive) return reject(req, res, 403, "Device is disabled", "device_inactive");

    const claimedDevice = first((req.body as Record<string, unknown> | undefined)?.device_id) ?? first(req.query.device_id);
    if (claimedDevice !== undefined && claimedDevice !== null && String(claimedDevice) !== device.deviceCode) {
      return reject(req, res, 403, "device_id does not match the authenticated device", "device_id_mismatch");
    }

    const claimedInstitution =
      first((req.body as Record<string, unknown> | undefined)?.institution_id) ?? first(req.query.institution_id);
    if (claimedInstitution !== undefined && claimedInstitution !== null && claimedInstitution !== "") {
      if (Number(claimedInstitution) !== madrasaId) {
        return reject(req, res, 403, "institution_id does not match", "institution_mismatch");
      }
    }

    req.attendanceDevice = device;
    // Any authenticated connector call proves the connector is alive.
    attendanceDeviceRepository.updateDevice(madrasaId, device.id, { lastSeenAt: new Date() }).catch(() => {});
    return next();
  } catch (err) {
    logger.error("Attendance device connector auth error", { reason: (err as Error)?.message });
    return res.status(500).json({ success: false, message: "Device authentication failed" });
  }
};

const tooMany = { success: false, message: "Too many requests. Slow down." };

/** Pre-auth brute-force guard: only FAILED (>=400) requests count, keyed by IP. */
export const connectorFailedAuthLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});

const deviceKeyOrIp = (req: Request) =>
  req.attendanceDevice ? `device:${req.attendanceDevice.id}` : (req.ip ?? "unknown");

/** Per-device budget for config/heartbeat polling (default poll every 30s). */
export const connectorPollLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: deviceKeyOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});

/** Stricter per-device budget for ingest (each call can carry up to 500 events). */
export const connectorIngestLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: deviceKeyOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});
