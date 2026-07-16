import "express";
import { AuthenticatedUser, TenantContext } from "./common.types";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenant?: TenantContext;
    }
  }
}
export {};
