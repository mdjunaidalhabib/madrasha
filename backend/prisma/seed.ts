// Ported from the INSERT statements in `schema new.sql` (divisions, classes,
// books, modules, module_features, permissions, plans, super_admins).
// Run with: npx prisma db seed   (or automatically after `migrate dev`/`reset`)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  /* ============== SUPER ADMIN ==============
     Default login: admin@madrasa.com / admin123
     ⚠️ Change this password after your first login! */
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.superAdmin.upsert({
    where: { email: "admin@madrasa.com" },
    update: {},
    create: {
      name: "Platform Owner",
      email: "admin@madrasa.com",
      passwordHash,
      isActive: 1,
    },
  });

  /* ============== PLANS ============== */
  const plans = [
    { name: "Basic", studentLimit: 100, userLimit: 5, durationDays: 365, price: 2000 },
    { name: "Standard", studentLimit: 300, userLimit: 10, durationDays: 365, price: 5000 },
    { name: "Premium", studentLimit: 1000, userLimit: 50, durationDays: 365, price: 12000 },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({ where: { name: plan.name }, update: {}, create: plan });
  }

  /* ============== DIVISIONS ============== */
  const divisions = [
    { keyName: "nurani", name: "Nurani", nameBn: "নূরানী" },
    { keyName: "nazera_hifz", name: "Nazera/Hifz", nameBn: "নাযেরা/হিফজ" },
    { keyName: "kitab", name: "Kitab", nameBn: "কিতাব" },
    { keyName: "takhassus", name: "Takhassus", nameBn: "তাখাসসুস" },
  ];
  const divisionIds: Record<string, number> = {};
  for (const d of divisions) {
    const row = await prisma.division.upsert({
      where: { keyName: d.keyName },
      update: {},
      create: d,
    });
    divisionIds[d.keyName] = row.id;
  }

  /* ============== CLASSES ============== */
  const classesByDivision: Record<string, { name: string; nameBn: string }[]> = {
    nurani: [
      { name: "Child", nameBn: "শিশু" },
      { name: "First", nameBn: "প্রথম" },
      { name: "Second", nameBn: "দ্বিতীয়" },
      { name: "Third", nameBn: "তৃতীয়" },
    ],
    nazera_hifz: [
      { name: "Nazera", nameBn: "নাযেরা" },
      { name: "Hifz", nameBn: "হিফজ" },
    ],
    kitab: [
      { name: "Urdu", nameBn: "উর্দু" },
      { name: "Taisir", nameBn: "তাইসির" },
      { name: "Mizan", nameBn: "মিজান" },
      { name: "Nahbemir", nameBn: "নাহবেমীর" },
      { name: "Hedayatun Nahw", nameBn: "হেদায়াতুন নাহু" },
      { name: "Kafiya", nameBn: "কাফিয়া" },
      { name: "Sharhe Bekaya", nameBn: "শরহে বেকায়া" },
      { name: "Jalalain", nameBn: "জালালাইন" },
      { name: "Mishkat", nameBn: "মিশকাত" },
      { name: "Dawra", nameBn: "দাওরা" },
    ],
    takhassus: [
      { name: "Ifta", nameBn: "ইফতা" },
      { name: "Hadith", nameBn: "হাদিস" },
    ],
  };

  const classIds: Record<string, number> = {}; // key: "division/className"
  for (const [divisionKey, classes] of Object.entries(classesByDivision)) {
    for (const c of classes) {
      const row = await prisma.class.upsert({
        where: { divisionId_name: { divisionId: divisionIds[divisionKey], name: c.name } },
        update: {},
        create: { ...c, divisionId: divisionIds[divisionKey] },
      });
      classIds[`${divisionKey}/${c.name}`] = row.id;
    }
  }

  /* ============== BOOKS ============== */
  const booksByClass: Record<string, { name: string; nameBn: string }[]> = {
    "nurani/Child": [
      { name: "bangla book", nameBn: "বাংলা শিশু" },
      { name: "english book", nameBn: "ইংরেজি শিশু" },
      { name: "gonit book", nameBn: "গণিত শিশু" },
    ],
    "nurani/First": [
      { name: "bangla book", nameBn: "বাংলা প্রথম" },
      { name: "english book", nameBn: "ইংরেজি প্রথম" },
      { name: "gonit book", nameBn: "গণিত প্রথম" },
    ],
    "nurani/Second": [
      { name: "bangla book", nameBn: "বাংলা ২য়" },
      { name: "english book", nameBn: "ইংরেজি ২য়" },
      { name: "gonit book", nameBn: "গণিত ২য়" },
    ],
    "nurani/Third": [
      { name: "bangla book", nameBn: "বাংলা ৩য়" },
      { name: "english book", nameBn: "ইংরেজি ৩য়" },
      { name: "gonit book", nameBn: "গণিত ৩য়" },
    ],
    "nazera_hifz/Nazera": [
      { name: "Nazera", nameBn: "নাযেরা" },
      { name: "tazbid", nameBn: "তাজবিদ" },
      { name: "masala", nameBn: "মাসআলা" },
    ],
    "nazera_hifz/Hifz": [
      { name: "Hifz Book", nameBn: "হিফজ কিতাব" },
      { name: "tazbid Book", nameBn: "তাজবিদ কিতাব" },
      { name: "masala Book", nameBn: "মাসআলা কিতাব" },
    ],
    "kitab/Urdu": [{ name: "Urdu Book", nameBn: "উর্দু কিতাব" }],
    "kitab/Taisir": [{ name: "Taisir Book", nameBn: "তাইসির কিতাব" }],
    "kitab/Mizan": [
      { name: "Mizan Book", nameBn: "মিজান কিতাব" },
      { name: "Sarf Book", nameBn: "সরফ" },
      { name: "Nahw Book", nameBn: "নাহু" },
    ],
    "kitab/Nahbemir": [{ name: "Nahbemir", nameBn: "নাহবেমীর" }],
    "kitab/Hedayatun Nahw": [{ name: "Hedayatun Nahw", nameBn: "হেদায়াতুন নাহু" }],
    "kitab/Kafiya": [{ name: "Kafiya", nameBn: "কাফিয়া" }],
    "kitab/Sharhe Bekaya": [{ name: "Sharhe Bekaya", nameBn: "শরহে বেকায়া" }],
    "kitab/Jalalain": [{ name: "Tafsir Jalalain", nameBn: "তাফসির জালালাইন" }],
    "kitab/Mishkat": [{ name: "Mishkat Sharif", nameBn: "মিশকাত শরিফ" }],
    "kitab/Dawra": [
      { name: "Sahih Bukhari", nameBn: "সহিহ বুখারি" },
      { name: "Sahih Muslim", nameBn: "সহিহ মুসলিম" },
      { name: "Tirmizi", nameBn: "তিরমিজি" },
      { name: "Abu Dawood", nameBn: "আবু দাউদ" },
    ],
  };

  for (const [classKey, books] of Object.entries(booksByClass)) {
    const classId = classIds[classKey];
    if (!classId) continue;
    for (const b of books) {
      await prisma.book.upsert({
        where: { classId_name: { classId, name: b.name } },
        update: {},
        create: { ...b, classId },
      });
    }
  }

  /* ============== MODULES ============== */
  const modules = [
    { keyName: "dashboard", name: "Dashboard", nameBn: "ড্যাশবোর্ড", groupName: "core", sortOrder: 1 },
    { keyName: "ihtemam", name: "ihtemam", nameBn: "ইহতিমাম", groupName: "core", sortOrder: 2 },
    { keyName: "reports", name: "Reports", nameBn: "রিপোর্ট সমূহ", groupName: "core", sortOrder: 3 },
    { keyName: "talimat", name: "Talimat", nameBn: "তালিমাত", groupName: "education", sortOrder: 4 },
    { keyName: "accounts", name: "Accounts", nameBn: "হিসাব বিভাগ", groupName: "core", sortOrder: 5 },
    { keyName: "students", name: "Students", nameBn: "ছাত্র বিভাগ", groupName: "core", sortOrder: 6 },
    { keyName: "admission", name: "Admission", nameBn: "নতুন ভর্তি", groupName: "core", sortOrder: 7 },
    { keyName: "settings", name: "Settings", nameBn: "সেটিং", groupName: "core", sortOrder: 8 },
    { keyName: "activity", name: "Activity Log", nameBn: "অ্যাক্টিভিটি লগ", groupName: "core", sortOrder: 9 },
    { keyName: "website", name: "Website Settings", nameBn: "ওয়েবসাইট সেটিংস", groupName: "core", sortOrder: 10 },
  ];
  const moduleIds: Record<string, number> = {};
  for (const m of modules) {
    const row = await prisma.moduleDef.upsert({
      where: { keyName: m.keyName },
      update: { name: m.name, nameBn: m.nameBn, groupName: m.groupName, sortOrder: m.sortOrder },
      create: m,
    });
    moduleIds[m.keyName] = row.id;
  }

  /* ============== MODULE FEATURES ============== */
  const featuresByModule: Record<string, { keyName: string; name: string; nameBn: string; sortOrder: number }[]> = {
    ihtemam: [
      { keyName: "teacher_admission", name: "Teacher Admission", nameBn: "নতুন শিক্ষক", sortOrder: 1 },
      { keyName: "all_teacher", name: "All Teachers", nameBn: "শিক্ষকসমূহ", sortOrder: 2 },
    ],
    reports: [
      { keyName: "academic_report", name: "Academic Report", nameBn: "একাডেমিক রিপোর্ট", sortOrder: 1 },
      { keyName: "student_report", name: "Student Report", nameBn: "ছাত্র রিপোর্ট", sortOrder: 2 },
      { keyName: "teacher_report", name: "Teacher Report", nameBn: "শিক্ষক রিপোর্ট", sortOrder: 3 },
      { keyName: "documents", name: "Documents", nameBn: "ডকুমেন্ট সমূহ", sortOrder: 4 },
    ],
    talimat: [
      { keyName: "class_panel", name: "Class Panel", nameBn: "ক্লাস প্যানেল", sortOrder: 1 },
      { keyName: "teacher_assignment", name: "Teacher Assignment", nameBn: "কিতাব বন্টন", sortOrder: 2 },
      { keyName: "exam_panel", name: "Exam Panel", nameBn: "পরিক্ষা প্যানেল", sortOrder: 3 },
      { keyName: "results", name: "Results", nameBn: "রেজাল্ট", sortOrder: 4 },
      { keyName: "documents", name: "Documents", nameBn: "ডকুমেন্ট টেমপ্লেট", sortOrder: 5 },
    ],
    accounts: [
      { keyName: "income", name: "Income", nameBn: "আয়/রশিদ জমা", sortOrder: 1 },
      { keyName: "expense", name: "Expense", nameBn: "ব্যয়/ভাউচার তৈরী", sortOrder: 2 },
      { keyName: "report", name: "Report", nameBn: "আয় ব্যয় রিপোর্ট", sortOrder: 3 },
    ],
    students: [
      { keyName: "new_admission", name: "New Admission", nameBn: "নতুন ভর্তি", sortOrder: 1 },
      { keyName: "list", name: "list", nameBn: "ছাত্রসমূহ", sortOrder: 2 },
    ],
  };

  for (const [moduleKey, features] of Object.entries(featuresByModule)) {
    const moduleId = moduleIds[moduleKey];
    if (!moduleId) continue;
    for (const f of features) {
      await prisma.moduleFeature.upsert({
        where: { moduleId_keyName: { moduleId, keyName: f.keyName } },
        update: { name: f.name, nameBn: f.nameBn, sortOrder: f.sortOrder },
        create: { ...f, moduleId },
      });
    }
  }

  /* ============== PERMISSIONS ============== */
  const permissions = [
    { keyName: "students.read", name: "View Students" },
    { keyName: "students.create", name: "Create Students" },
    { keyName: "students.update", name: "Update Students" },
    { keyName: "students.delete", name: "Delete Students" },
    { keyName: "users.read", name: "View Users" },
    { keyName: "users.create", name: "Create Users" },
    { keyName: "accounts.read", name: "View Accounts" },
    { keyName: "accounts.create", name: "Create Accounts" },
  ];
  for (const p of permissions) {
    await prisma.permission.upsert({ where: { keyName: p.keyName }, update: {}, create: p });
  }

  console.log("✅ Seed complete.");
  console.log("   Super Admin login: admin@madrasa.com / admin123  (change this password!)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
