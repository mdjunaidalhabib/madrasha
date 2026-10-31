import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { BadRequestError } from "../../shared/errors";
import { buildObjectKey, r2Service } from "../../shared/storage/r2.service";
import { decodeImageDataUri, presetFor, processImage } from "../../shared/storage/image-processing";
import { platformSettingsService } from "../super-admin/platform-settings.service";
import {
  DEFAULT_WEBSITE_TEMPLATE,
  websiteTemplateSchema,
  WebsiteTemplate,
} from "./website-template.schema";

export async function getWebsiteTemplate(
  db: Pick<Prisma.TransactionClient, "platformWebsiteTemplate"> = prisma,
) {
  const row = await db.platformWebsiteTemplate.findUnique({ where: { id: 1 } });
  return {
    content: row
      ? websiteTemplateSchema.parse(row.content)
      : structuredClone(DEFAULT_WEBSITE_TEMPLATE),
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function saveWebsiteTemplate(input: unknown) {
  const result = websiteTemplateSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new BadRequestError(`${issue.path.join(".")}: ${issue.message}`);
  }
  const row = await prisma.platformWebsiteTemplate.upsert({
    where: { id: 1 },
    create: { id: 1, content: result.data },
    update: { content: result.data },
  });
  return { content: result.data, updatedAt: row.updatedAt };
}

export async function uploadWebsiteTemplateImage(image: unknown) {
  if (typeof image !== "string") throw new BadRequestError("Image is required");
  const decoded = decodeImageDataUri(image);
  const credentials = await platformSettingsService.resolveStorageCredentials();
  if (!credentials)
    throw new BadRequestError(
      "Cloud storage is not configured. Use an image URL or configure storage first.",
    );
  const processed = await processImage(decoded, presetFor("gallery"));
  const key = buildObjectKey("platform/", "website-demo", "webp");
  const url = await r2Service.putObject(credentials, key, processed, "image/webp");
  if (url.length > 255) throw new BadRequestError("Image URL exceeds the supported length");
  return { url };
}

// Substitute only display copy; names can never change image/link destinations.
export function personalizeWebsiteTemplate(
  template: WebsiteTemplate,
  institutionName: string,
): WebsiteTemplate {
  const copy = structuredClone(template);
  const replace = (value: string) => value.split("{{institution_name}}").join(institutionName);
  const settings = copy.settings;
  for (const key of [
    "heroTitle",
    "heroSubtitle",
    "noticeBarText",
    "muhtamimName",
    "muhtamimDesignation",
    "muhtamimMessage",
    "sovapotiName",
    "sovapotiDesignation",
    "sovapotiMessage",
  ] as const) {
    settings[key] = replace(settings[key]);
  }
  for (const key of [
    "heroTitle",
    "muhtamimName",
    "muhtamimDesignation",
    "sovapotiName",
    "sovapotiDesignation",
  ] as const) {
    settings[key] = settings[key].slice(0, 190);
  }
  for (const row of copy.pages) {
    row.title = replace(row.title).slice(0, 190);
    row.content = replace(row.content);
  }
  for (const row of copy.notices) {
    row.title = replace(row.title).slice(0, 190);
    row.content = replace(row.content);
  }
  return copy;
}

export async function provisionWebsiteOnTx(tx: Prisma.TransactionClient, madrasaId: number) {
  const { content } = await getWebsiteTemplate(tx);
  if (!content.enabled) return;
  const madrasa = await tx.madrasa.findUniqueOrThrow({
    where: { id: madrasaId },
    select: { name: true },
  });
  const template = personalizeWebsiteTemplate(content, madrasa.name);
  // WebsiteSettings' unique tenant key makes provisioning idempotent. An
  // existing website, including deliberately emptied sections, is preserved.
  const claimed = await tx.websiteSettings.createMany({
    data: [{ madrasaId, ...template.settings }],
    skipDuplicates: true,
  });
  if (!claimed.count) return;
  if (template.pages.length)
    await tx.websitePage.createMany({ data: template.pages.map((row) => ({ madrasaId, ...row })) });
  if (template.notices.length)
    await tx.websiteNotice.createMany({
      data: template.notices.map((row) => ({ madrasaId, ...row })),
    });
  if (template.slides.length)
    await tx.websiteSlide.createMany({
      data: template.slides.map((row) => ({ madrasaId, ...row })),
    });
  if (template.gallery.length)
    await tx.websiteGallery.createMany({
      data: template.gallery.map((row) => ({ madrasaId, ...row })),
    });
  if (template.committee.length)
    await tx.websiteCommitteeMember.createMany({
      data: template.committee.map((row) => ({ madrasaId, ...row })),
    });
  if (template.videos.length)
    await tx.websiteVideo.createMany({
      data: template.videos.map((row) => ({ madrasaId, ...row })),
    });
}
