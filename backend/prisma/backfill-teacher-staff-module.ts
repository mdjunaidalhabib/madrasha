import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/** One-off backfill for already-provisioned madrasas — applies the new
 * "শিক্ষক স্টাফ" (teacher_staff) module split on real DB rows instead of
 * relying solely on sidebar.service.ts's virtual-row fallback:
 *   - creates the "staff.*" permission catalog rows
 *   - creates the "teacher_staff" ModuleDef row
 *   - re-points the existing "teacher_admission"/"all_teacher" ModuleFeature
 *     rows from ইহতিমাম to the new module, and creates the new
 *     "staff_admission"/"all_staff" feature rows
 *   - activates "teacher_staff" (MadrasaModule) for every madrasa that
 *     already has ইহতিমাম active
 *
 * Purely additive/re-pointing - never deletes a ModuleDef/Permission row, so
 * it's safe to run against production alongside seed.ts (which already
 * contains the same target shape for brand-new madrasas).
 *
 * Idempotent: safe to re-run.
 *
 * Dry run (default): npx ts-node prisma/backfill-teacher-staff-module.ts
 * Apply for real:     npx ts-node prisma/backfill-teacher-staff-module.ts --apply */

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

async function main() {
  /* ========== 1. Permission catalog ========== */
  const staffPermissions = [
    { keyName: "staff.read", name: "View Staff" },
    { keyName: "staff.create", name: "Create Staff" },
    { keyName: "staff.update", name: "Update Staff" },
    { keyName: "staff.delete", name: "Delete Staff" },
  ];
  const existingPerms = await prisma.permission.findMany({
    where: { keyName: { in: staffPermissions.map((p) => p.keyName) } },
    select: { keyName: true },
  });
  const existingPermKeys = new Set(existingPerms.map((p) => p.keyName));
  const missingPerms = staffPermissions.filter((p) => !existingPermKeys.has(p.keyName));
  console.log(`Permissions to create: ${missingPerms.length} (${missingPerms.map((p) => p.keyName).join(", ") || "none"})`);
  if (APPLY) {
    for (const p of missingPerms) {
      await prisma.permission.upsert({ where: { keyName: p.keyName }, update: {}, create: p });
    }
  }

  /* ========== 2. teacher_staff ModuleDef ========== */
  let teacherStaffModule = await prisma.moduleDef.findUnique({ where: { keyName: "teacher_staff" } });
  console.log(teacherStaffModule ? "teacher_staff module: already exists" : "teacher_staff module: to create");
  if (APPLY && !teacherStaffModule) {
    teacherStaffModule = await prisma.moduleDef.create({
      data: {
        keyName: "teacher_staff",
        name: "Teacher Staff",
        nameBn: "শিক্ষক ও স্টাফ",
        groupName: "core",
        sortOrder: 3,
      },
    });
  }

  /* ========== 3. Module features ========== */
  const ihtemamModule = await prisma.moduleDef.findUnique({ where: { keyName: "ihtemam" } });
  if (APPLY && teacherStaffModule) {
    if (ihtemamModule) {
      // Re-point the two moved features to the new module, preserving their ids.
      await prisma.moduleFeature.updateMany({
        where: { moduleId: ihtemamModule.id, keyName: "teacher_admission" },
        data: { moduleId: teacherStaffModule.id, nameBn: "নতুন শিক্ষক", sortOrder: 1 },
      });
      await prisma.moduleFeature.updateMany({
        where: { moduleId: ihtemamModule.id, keyName: "all_teacher" },
        data: { moduleId: teacherStaffModule.id, nameBn: "শিক্ষকসমূহ", sortOrder: 2 },
      });
    }

    const newFeatures = [
      { keyName: "staff_admission", name: "Staff Admission", nameBn: "নতুন স্টাফ", sortOrder: 3 },
      { keyName: "all_staff", name: "All Staff", nameBn: "স্টাফসমূহ", sortOrder: 4 },
    ];
    for (const f of newFeatures) {
      await prisma.moduleFeature.upsert({
        where: { moduleId_keyName: { moduleId: teacherStaffModule.id, keyName: f.keyName } },
        update: { name: f.name, nameBn: f.nameBn, sortOrder: f.sortOrder },
        create: { ...f, moduleId: teacherStaffModule.id },
      });
    }
  } else {
    console.log("Module features: dry run - would re-point teacher_admission/all_teacher and create staff_admission/all_staff");
  }

  /* ========== 4. Activate for existing madrasas that have ihtemam ========== */
  if (ihtemamModule) {
    const activeIhtemam = await prisma.madrasaModule.findMany({
      where: { moduleId: ihtemamModule.id, isActive: 1 },
      select: { madrasaId: true },
    });
    console.log(`Madrasas with ইহতিমাম active: ${activeIhtemam.length}`);

    if (APPLY && teacherStaffModule) {
      await prisma.madrasaModule.createMany({
        data: activeIhtemam.map((m) => ({
          madrasaId: m.madrasaId,
          moduleId: teacherStaffModule!.id,
          isActive: 1,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (!APPLY) {
    console.log("\nDry run only - no rows written. Re-run with --apply to actually write these changes.");
    return;
  }
  console.log("\n✅ Backfill applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
