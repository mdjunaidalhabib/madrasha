import type { Request } from "express";
import { normalizeHost } from "./host.util";

// Browser Origin is authoritative when the API is hosted separately. Never
// accept a query/header-supplied tenant hostname in place of a browser origin.
export function adminRequestHost(req: Request): string {
  if (req.headers.origin) return normalizeHost(req.headers.origin);
  return normalizeHost(req.headers.host);
}
