import "express";
import { AuthenticatedGuardian, AuthenticatedUser, TenantContext } from "./common.types";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenant?: TenantContext;
      guardian?: AuthenticatedGuardian;
    }
  }
}
export {};
