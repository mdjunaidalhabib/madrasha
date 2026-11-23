import { Prisma, PrismaClient } from "@prisma/client";
import { BadRequestError } from "../errors";
import { t } from "../i18n";
import { logger } from "../logger/logger";

// These models can contain images in fields, HTML or designer JSON. Historical
// versions/snapshots are included so deleting their last reference also cleans up.
export const IMAGE_MODELS = new Set([
  "Madrasa",
  "User",
  "Student",
  "Teacher",
  "Staff",
  "Setting",
  "WebsiteSettings",
  "WebsitePage",
  "WebsiteNotice",
  "PrintableNotice",
  "WebsiteGallery",
  "WebsiteSlide",
  "WebsiteCommitteeMember",
  "WebsiteAdmissionApplication",
  "DocumentTemplateVersion",
  "PlatformWebsiteTemplate",
  "PlatformVendorPromo",
  "PlatformVendorService",
  "ResultSnapshot",
]);

export function imageKeysIn(value: unknown): string[] {
  const text = JSON.stringify(value) || "";
  return [
    ...new Set(
      text.match(
        /(?:madrasas\/[a-z0-9-]+\/|platform\/(?:document-templates|website-demo)\/)[a-zA-Z0-9/._-]+\.webp/g,
      ) ?? [],
    ),
  ];
}

/** Prevent newly supplied inline images; existing legacy rows are still readable. */
export function assertNoInlineImages(value: unknown): void {
  if (/data:image\//i.test(JSON.stringify(value) || "")) {
    throw new BadRequestError(
      t({
        bn: "ছবি আপলোড শেষ হলে সেভ করুন। সরাসরি ছবির ডেটা সংরক্ষণ করা যাবে না।",
        en: "Wait for the image upload before saving. Inline image data cannot be stored.",
      }),
    );
  }
}

export function withImageLifecycle(client: PrismaClient) {
  return client.$extends({
    name: "image-lifecycle",
    query: {
      $allModels: {
        async $allOperations({ model: modelName, operation, args, query }) {
          if (
            !IMAGE_MODELS.has(modelName) ||
            ![
              "create",
              "createMany",
              "createManyAndReturn",
              "update",
              "updateMany",
              "updateManyAndReturn",
              "upsert",
              "delete",
              "deleteMany",
            ].includes(operation)
          ) {
            return query(args);
          }
          const writeArgs = args as Record<string, unknown>;
          // Only writes are inspected, never old rows loaded for deletion/cleanup.
          // Result snapshots may contain legacy inline photos copied from old rows.
          // They are immutable historical records, not an upload entry point.
          if (modelName !== "ResultSnapshot")
            assertNoInlineImages(writeArgs.data ?? [writeArgs.create, writeArgs.update]);
          let previousKeys: string[] = [];
          if (
            [
              "update",
              "updateMany",
              "updateManyAndReturn",
              "upsert",
              "delete",
              "deleteMany",
            ].includes(operation)
          ) {
            try {
              const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === modelName)!;
              const deleting = operation === "delete" || operation === "deleteMany";
              const changes = (writeArgs.data ?? writeArgs.update ?? {}) as Record<string, unknown>;
              const select = Object.fromEntries(
                model.fields
                  .filter(
                    (field) =>
                      field.kind === "scalar" &&
                      ["String", "Json"].includes(field.type) &&
                      (deleting || field.name in changes) &&
                      (field.type === "Json" ||
                        /image|photo|logo|banner|watermark|signature|background|content|html|body|template|value|data|snapshot|layout|layers|url|asset|cover|attachment|avatar/i.test(
                          field.name,
                        )),
                  )
                  .map((field) => [field.name, true]),
              );
              // Ordinary name/mobile/status changes do not read old photos or
              // schedule reference scans. Cascades remain covered by the sweep.
              if (!Object.keys(select).length) return query(args);
              const name = modelName[0].toLowerCase() + modelName.slice(1);
              const delegate = (
                client as unknown as Record<
                  string,
                  {
                    findMany: (args: unknown) => Promise<unknown>;
                    findUnique: (args: unknown) => Promise<unknown>;
                  }
                >
              )[name];
              const rows = operation.includes("Many")
                ? await delegate.findMany({ where: writeArgs.where, select })
                : await delegate.findUnique({ where: writeArgs.where, select });
              const retained = new Set(deleting ? [] : imageKeysIn(changes));
              previousKeys = imageKeysIn(rows).filter((key) => !retained.has(key));
            } catch (error) {
              // Maintenance must never prevent a business write. The bucket sweep
              // is the durable fallback (also covers cascades and raw SQL deletes).
              logger.error("[STORAGE:cleanup] deferred to bucket sweep", error);
            }
          }
          const result = await query(args);
          if (previousKeys.length) {
            // Delay until the enclosing transaction has had a chance to commit.
            // Reference checks protect rollbacks and shared/historic uses.
            void import("./image-cleanup")
              .then(({ queueImageCleanup }) => queueImageCleanup(previousKeys))
              .catch((error) =>
                logger.error("[STORAGE:cleanup] enqueue failed; sweep will retry", error),
              );
          }
          return result;
        },
      },
    },
  });
}
