import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../shared/database/prisma";
import { adminRequestHost } from "../../shared/utils/admin-domain.util";

// Independent of public-website status: staff must be able to log in even
// when their public website is disabled or their subscription needs renewal.
export async function resolveAdminDomain(req: Request, res: Response, next: NextFunction) {
  try {
    const host = adminRequestHost(req);
    const institution = host
      ? await prisma.madrasa.findFirst({
          where: { adminDomain: host, deletedAt: null },
          select: { slug: true, name: true, reportLogo: true },
        })
      : null;
    res.setHeader("Cache-Control", "no-store");
    res.json({
      data: institution
        ? {
            slug: institution.slug,
            name: institution.name,
            logo: institution.reportLogo,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
}
