import "express";
import { AuthenticatedGuardian, AuthenticatedUser, TenantContext } from "./common.types";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenant?: TenantContext;
      guardian?: AuthenticatedGuardian;
      /** Set by attendanceDeviceConnectorAuth for /attendance-devices/connector/* requests. */
      attendanceDevice?: import("@prisma/client").AttendanceDevice;
    }
  }
}
export {};
