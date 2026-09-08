import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";
import { logger } from "../logger/logger";

function normalizeSlug(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

async function getSlugFromRequest(req: Request) {
  // Path-based tenant mode: frontend sends this header from /:madrasaSlug/admin/*
  const headerSlug = normalizeSlug(req.headers["x-madrasa-slug"]);
  if (headerSlug) return headerSlug;

  // Optional API path support: /api/:madrasaSlug/...
  const paramSlug = normalizeSlug((req.params as any).madrasaSlug || (req.params as any).slug);
  if (paramSlug) return paramSlug;

  const querySlug = normalizeSlug(req.query.madrasaSlug || req.query.slug);
  if (querySlug) return querySlug;

  // Future-ready subdomain fallback: jamia.yourdomain.com
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  // NOTE: intentionally reads process.env directly (not the defaulted
  // appConfig.rootDomain) - this fallback must stay inert unless an
  // operator has explicitly set ROOT_DOMAIN.
  const rootDomain = process.env.ROOT_DOMAIN;
  if (rootDomain && host.endsWith(`.${rootDomain}`)) {
    const subdomain = host.replace(`.${rootDomain}`, "");
    if (subdomain && !subdomain.includes(".")) return normalizeSlug(subdomain);
  }

  // Defense-in-depth: a request landing directly on a tenant's own custom
  // domain without an X-Madrasa-Slug header (e.g. a staff bookmark hitting
  // an API route straight from that domain). The frontend's normal flow
  // resolves this client-side first (see resolve-domain) and always sends
  // the header afterwards - this DB lookup only covers requests that skip
  // that step entirely.
  if (host) {
    const madrasa = await prisma.madrasa.findFirst({ where: { customDomain: host }, select: { slug: true } });
    if (madrasa) return madrasa.slug;
  }

  return "";
}

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = await getSlugFromRequest(req);

    if (!slug) {
      return res.status(400).json({
        message: "Madrasa slug required. Example: /jamia/admin/login",
      });
    }

    const madrasa = await prisma.madrasa.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, isActive: true, deletedAt: true, websiteStatus: true },
    });

    if (!madrasa) {
      return res.status(410).json({ message: "Madrasa not found" });
    }

    if (madrasa.deletedAt) {
      return res.status(410).json({ message: "This madrasa has been deleted" });
    }

    if (!madrasa.isActive) {
      return res.status(423).json({ message: "This madrasa is suspended" });
    }

    req.tenant = {
      madrasa_id: madrasa.id,
      slug: madrasa.slug,
    };

    next();
  } catch (err: any) {
    logger.error("Tenant middleware error", err);
    return res.status(500).json({ message: "Tenant resolution failed" });
  }
};
