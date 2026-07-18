import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function syncDelete(
  label: string,
  existing: { id: number }[],
  keepIds: number[],
  del: (id: number) => Promise<unknown>,
) {
  const keep = new Set(keepIds);
  for (const row of existing) {
    if (keep.has(row.id)) continue;
    try {
      await del(row.id);
      console.log(`   🗑️  Removed ${label} (id=${row.id}) — no longer in seed.ts`);
    } catch {
      console.warn(
        `   ⚠️  Skipped removing ${label} (id=${row.id}) — still referenced by existing data ` +
          `(e.g. students/teachers/results). Remove that data first if you really want it gone.`,
      );
    }
  }
}

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
  const planIds: number[] = [];
  for (const plan of plans) {
    const row = await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        studentLimit: plan.studentLimit,
        userLimit: plan.userLimit,
        durationDays: plan.durationDays,
        price: plan.price,
      },
      create: plan,
    });
    planIds.push(row.id);
  }
  await syncDelete("plan", await prisma.plan.findMany({ select: { id: true } }), planIds, (id) =>
    prisma.plan.delete({ where: { id } }),
  );

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
      update: { name: d.name, nameBn: d.nameBn },
      create: d,
    });
    divisionIds[d.keyName] = row.id;
  }
  await syncDelete(
    "division",
    await prisma.division.findMany({ select: { id: true } }),
    Object.values(divisionIds),
    (id) => prisma.division.delete({ where: { id } }),
  );

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
      { name: "Sharhe Jami", nameBn: "শরহে জামী" },
      { name: "Sharhe Bekaya", nameBn: "শরহে বেকায়া" },
      { name: "Jalalain", nameBn: "জালালাইন" },
      { name: "Mishkat", nameBn: "মিশকাত" },
      { name: "Dawra", nameBn: "দাওরা" },
    ],
    takhassus: [
      { name: "Ifta", nameBn: "ইফতা" },
      { name: "Adab", nameBn: "আদব" },
      { name: "Hadith", nameBn: "হাদিস" },
      { name: "Tafsir", nameBn: "তাফসির" },
    ],
  };

  const classIds: Record<string, number> = {}; // key: "division/className"
  for (const [divisionKey, classes] of Object.entries(classesByDivision)) {
    const divisionId = divisionIds[divisionKey];
    if (!divisionId) continue; // division was removed above / not found
    for (const c of classes) {
      const row = await prisma.class.upsert({
        where: { divisionId_name: { divisionId, name: c.name } },
        update: { nameBn: c.nameBn },
        create: { ...c, divisionId },
      });
      classIds[`${divisionKey}/${c.name}`] = row.id;
    }
  }
  await syncDelete(
    "class",
    await prisma.class.findMany({ select: { id: true } }),
    Object.values(classIds),
    (id) => prisma.class.delete({ where: { id } }),
  );

  /* ============== BOOKS ============== */
  const booksByClass: Record<string, { name: string; nameBn: string }[]> = {
    "nurani/Child": [
      { name: "Quran", nameBn: "কুরআন" },
      { name: "Bangla", nameBn: "বাংলা" },
      { name: "English", nameBn: "ইংরেজি" },
      { name: "Gonit", nameBn: "গণিত" },
    ],
    "nurani/First": [
      { name: "Quran", nameBn: "কুরআন" },
      { name: "Bangla", nameBn: "বাংলা" },
      { name: "English", nameBn: "ইংরেজি" },
      { name: "Gonit", nameBn: "গণিত" },
    ],
    "nurani/Second": [
      { name: "Quran", nameBn: "কুরআন" },
      { name: "Bangla", nameBn: "বাংলা" },
      { name: "English", nameBn: "ইংরেজি" },
      { name: "Gonit", nameBn: "গণিত" },
    ],
    "nurani/Third": [
      { name: "Quran", nameBn: "কুরআন" },
      { name: "Bangla", nameBn: "বাংলা" },
      { name: "English", nameBn: "ইংরেজি" },
      { name: "Gonit", nameBn: "গণিত" },
    ],
    "nazera_hifz/Nazera": [
      { name: "Nazera", nameBn: "নাযেরা" },
      { name: "Tajweed", nameBn: "তাজবীদ" },
      { name: "Masael", nameBn: "মাসায়েল" },
    ],
    "nazera_hifz/Hifz": [
      { name: "Hifz", nameBn: "হিফজ" },
      { name: "Tajweed", nameBn: "তাজবীদ" },
      { name: "Masael", nameBn: "মাসায়েল" },
    ],
    "kitab/Urdu": [
      { name: "Urdu", nameBn: "উর্দু" },
      { name: "Arabi", nameBn: "আরবি" },
      { name: "Bangla", nameBn: "বাংলা" },
      { name: "English", nameBn: "ইংরেজি" },
      { name: "Gonit", nameBn: "গণিত" },
      { name: "Poheli Talimul Islam", nameBn: "পহেলি তালিমুল ইসলাম" },
      { name: "Talimul Islam 1,2,3", nameBn: "তালিমুল ইসলাম ১,২,৩" },
      { name: "Beheshti Zewar", nameBn: "বেহেশতি যিওর" },
      { name: "Gulzare Sunnat", nameBn: "গুলজারে সুন্নত" },
      { name: "Rahe Najat", nameBn: "রাহে নাজাত" },
      { name: "Mojizate Rasul", nameBn: "মুজিযাতে রাসূল" },
    ],
    "kitab/Taisir": [
      { name: "Taisirul Mubtadi", nameBn: "তাইসিরুল মুবতাদী" },
      { name: "Talimul Islam 4", nameBn: "তালিমুল ইসলাম ৪" },
      { name: "Urdu Tesri", nameBn: "উর্দু তেসরী" },
      { name: "Farsi Poheli", nameBn: "ফার্সি পহেলি" },
      { name: "Eso Arabi Shikhi 1", nameBn: "এসো আরবি শিখি ১" },
      { name: "Bangla", nameBn: "বাংলা" },
      { name: "English & Grammar", nameBn: "ইংরেজি ও গ্রামার" },
      { name: "Gonit", nameBn: "গণিত" },
      { name: "Itihas", nameBn: "ইতিহাস" },
      { name: "Bhugol", nameBn: "ভূগোল" },
    ],
    "kitab/Mizan": [
      { name: "Mizanus Sarf", nameBn: "মীযানুস সারফ" },
      { name: "Eso Arabi Shikhi 2", nameBn: "এসো আরবি শিখি ২" },
      { name: "Bakuratul Adab", nameBn: "বাকুরাতুল আদব" },
      { name: "Beheshti Gawhar", nameBn: "বেহেশতী গাওহার" },
      { name: "Tarikhul Islam", nameBn: "তারীখুল ইসলাম" },
      { name: "Bangla", nameBn: "বাংলা" },
      { name: "English & Grammar", nameBn: "ইংরেজি ও গ্রামার" },
    ],
    "kitab/Nahbemir": [
      { name: "Nahbemir", nameBn: "নাহবেমীর" },
      { name: "Sharhe Miate Amil", nameBn: "শরহে মিআতে আমিল" },
      { name: "Ilmus Sarf 3 & 4", nameBn: "ইলমুস সারফ ৩ ও ৪" },
      { name: "Rawzatul Adab", nameBn: "রওজাতুল আদব" },
      { name: "Gulistan", nameBn: "গুলিস্তাঁ" },
      { name: "Sirate Khatamul Ambia", nameBn: "সীরাতে খাতামুল আম্বিয়া" },
      { name: "Al-Fiqhul Muyassar", nameBn: "আল-ফিকহুল মুয়াসসার" },
    ],
    "kitab/Hedayatun Nahw": [
      { name: "Hedayatun Nahw", nameBn: "হেদায়াতুন নাহু" },
      { name: "Ilmus Sigah", nameBn: "ইলমুস সীগাহ" },
      { name: "Nurul Iyzah", nameBn: "নূরুল ঈযাহ" },
      { name: "Mukhtasarul Quduri", nameBn: "মুখতাসারুল কুদুরী" },
      { name: "Taisirul Mantiq", nameBn: "তাইসীরুল মানতিক" },
      { name: "Mirqat", nameBn: "মিরকাত" },
      { name: "Tarjamatul Quran", nameBn: "তরজমাতুল কুরআন" },
      { name: "At-Tariq Ilal Insha 1", nameBn: "আত-তরীক ইলাল ইনশা ১" },
      { name: "Al-Qiraatur Rashida 1 & 2", nameBn: "আল-কিরাআতুর রাশেদা ১ ও ২" },
    ],
    "kitab/Kafiya": [
      { name: "Kafiya", nameBn: "কাফিয়া" },
      { name: "Durusul Balagah", nameBn: "দুরূসুল বালাগাহ" },
      { name: "At-Tariq Ilal Insha 2", nameBn: "আত-তরীক ইলাল ইনশা ২" },
      { name: "Tarjamatul Quran", nameBn: "তরজমাতুল কুরআন" },
    ],
    "kitab/Sharhe Jami": [
      { name: "Sharhe Jami", nameBn: "শরহে জামী" },
      { name: "Sharhut Tahzib", nameBn: "শরহুত তাহযীব" },
      { name: "Tarjamatul Quran", nameBn: "তরজমাতুল কুরআন" },
    ],
    "kitab/Sharhe Bekaya": [
      { name: "Sharhe Bekaya", nameBn: "শরহে বেকায়া" },
      { name: "Mukhtasarul Maani", nameBn: "মুখতাসারুল মাআনী" },
      { name: "Nurul Anwar 1", nameBn: "নূরুল আনওয়ার ১" },
      { name: "Maqamatul Hariri", nameBn: "মাকামাতুল হারীরী" },
      { name: "At-Tariq Ilal Insha 3", nameBn: "আত-তরীক ইলাল ইনশা ৩" },
      { name: "Tarjamatul Quran", nameBn: "তরজমাতুল কুরআন" },
      { name: "Sirajee", nameBn: "সিরাজী" },
    ],
    "kitab/Jalalain": [
      { name: "Tafsire Jalalain", nameBn: "তাফসিরে জালালাইন" },
      { name: "Hedaya 1", nameBn: "হেদায়া ১" },
      { name: "Hedaya 2", nameBn: "হেদায়া ২" },
      { name: "Nurul Anwar 2", nameBn: "নূরুল আনওয়ার ২" },
      { name: "Al-Fawzul Kabir", nameBn: "আল-ফাউযুল কাবীর" },
      { name: "Aqidatut Tahawi", nameBn: "আকীদাতুত তাহাবী" },
    ],
    "kitab/Mishkat": [
      { name: "Mishkatul Masabih", nameBn: "মিশকাতুল মাসাবীহ" },
      { name: "Hedaya 3", nameBn: "হেদায়া ৩" },
      { name: "Hedaya 4", nameBn: "হেদায়া ৪" },
      { name: "Sharhe Nukhbatul Fikar", nameBn: "শরহে নুখবাতুল ফিকার" },
      { name: "Tafsire Baizavi", nameBn: "তাফসীরে বায়যাবী" },
      { name: "Sharhul Aqaid An-Nasafiyyah", nameBn: "শরহুল আকাঈদ আন-নাসাফিয়্যাহ" },
      { name: "Tarikhe Deoband", nameBn: "তারীখে দেওবন্দ" },
    ],
    "kitab/Dawra": [
      { name: "Sahih Bukhari", nameBn: "সহীহ বুখারী" },
      { name: "Sahih Muslim", nameBn: "সহীহ মুসলিম" },
      { name: "Sunan Abu Dawood", nameBn: "সুনানে আবু দাউদ" },
      { name: "Jame Tirmizi", nameBn: "জামে তিরমিযী" },
      { name: "Sunan Nasai", nameBn: "সুনানে নাসায়ী" },
      { name: "Sunan Ibn Majah", nameBn: "সুনানে ইবনে মাজাহ" },
      { name: "Muwatta Imam Malik", nameBn: "মুআত্তা ইমাম মালিক" },
      { name: "Sharhe Maanil Asar", nameBn: "শরহে মাআনিল আসার" },
      { name: "Aqidah", nameBn: "আকীদাহ" },
      { name: "Tafsir", nameBn: "তাফসির" },
    ],
    "takhassus/Ifta": [
      { name: "Advanced Fiqh", nameBn: "উচ্চতর ফিকহ" },
      { name: "Usulul Fiqh", nameBn: "উসূলুল ফিকহ" },
      { name: "Fatwa Practice", nameBn: "ফতোয়া অনুশীলন" },
      { name: "Research", nameBn: "গবেষণা" },
    ],
    "takhassus/Adab": [
      { name: "Arabic Literature", nameBn: "আরবি সাহিত্য" },
      { name: "Balagat", nameBn: "বালাগাত" },
      { name: "Nahw", nameBn: "নাহু" },
      { name: "Sarf", nameBn: "সারফ" },
    ],
    "takhassus/Hadith": [
      { name: "Usulul Hadith", nameBn: "উসূলুল হাদিস" },
      { name: "Ilalul Hadith", nameBn: "ইলালুল হাদিস" },
      { name: "Rijal", nameBn: "রিজাল" },
      { name: "Takhrij", nameBn: "তাখরিজ" },
    ],
    "takhassus/Tafsir": [
      { name: "Ulumul Quran", nameBn: "উলূমুল কুরআন" },
      { name: "Usulut Tafsir", nameBn: "উসূলুত তাফসির" },
      { name: "Tafsir Research", nameBn: "তাফসির গবেষণা" },
      { name: "Arabic Language", nameBn: "আরবি ভাষা" },
    ],
  };

  const bookIds: number[] = [];
  for (const [classKey, books] of Object.entries(booksByClass)) {
    const classId = classIds[classKey];
    if (!classId) continue; // class was removed above / not found
    for (const b of books) {
      const row = await prisma.book.upsert({
        where: { classId_name: { classId, name: b.name } },
        update: { nameBn: b.nameBn },
        create: { ...b, classId },
      });
      bookIds.push(row.id);
    }
  }
  await syncDelete("book", await prisma.book.findMany({ select: { id: true } }), bookIds, (id) =>
    prisma.book.delete({ where: { id } }),
  );

  /* ============== MODULES ============== */
  const modules = [
    {
      keyName: "dashboard",
      name: "Dashboard",
      nameBn: "ড্যাশবোর্ড",
      groupName: "core",
      sortOrder: 1,
    },
    { keyName: "ihtemam", name: "ihtemam", nameBn: "ইহতিমাম", groupName: "core", sortOrder: 2 },
    {
      keyName: "reports",
      name: "Reports",
      nameBn: "রিপোর্ট সমূহ",
      groupName: "core",
      sortOrder: 3,
    },
    {
      keyName: "talimat",
      name: "Talimat",
      nameBn: "তালিমাত",
      groupName: "education",
      sortOrder: 4,
    },
    {
      keyName: "accounts",
      name: "Accounts",
      nameBn: "হিসাব বিভাগ",
      groupName: "core",
      sortOrder: 5,
    },
    {
      keyName: "students",
      name: "Students",
      nameBn: "ছাত্র বিভাগ",
      groupName: "core",
      sortOrder: 6,
    },
    {
      keyName: "admission",
      name: "Admission",
      nameBn: "নতুন ভর্তি",
      groupName: "core",
      sortOrder: 7,
    },
    { keyName: "settings", name: "Settings", nameBn: "সেটিং", groupName: "core", sortOrder: 8 },
    {
      keyName: "activity",
      name: "Activity Log",
      nameBn: "অ্যাক্টিভিটি লগ",
      groupName: "core",
      sortOrder: 9,
    },
    {
      keyName: "website",
      name: "Website Settings",
      nameBn: "ওয়েবসাইট সেটিংস",
      groupName: "core",
      sortOrder: 10,
    },
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
  await syncDelete(
    "module",
    await prisma.moduleDef.findMany({ select: { id: true } }),
    Object.values(moduleIds),
    (id) => prisma.moduleDef.delete({ where: { id } }),
  );

  /* ============== MODULE FEATURES ============== */
  const featuresByModule: Record<
    string,
    { keyName: string; name: string; nameBn: string; sortOrder: number }[]
  > = {
    ihtemam: [
      {
        keyName: "teacher_admission",
        name: "Teacher Admission",
        nameBn: "নতুন শিক্ষক",
        sortOrder: 1,
      },
      { keyName: "all_teacher", name: "All Teachers", nameBn: "শিক্ষকসমূহ", sortOrder: 2 },
    ],
    reports: [
      {
        keyName: "academic_report",
        name: "Academic Report",
        nameBn: "একাডেমিক রিপোর্ট",
        sortOrder: 1,
      },
      { keyName: "student_report", name: "Student Report", nameBn: "ছাত্র রিপোর্ট", sortOrder: 2 },
      { keyName: "teacher_report", name: "Teacher Report", nameBn: "শিক্ষক রিপোর্ট", sortOrder: 3 },
      { keyName: "documents", name: "Documents", nameBn: "ডকুমেন্ট সমূহ", sortOrder: 4 },
    ],
    talimat: [
      { keyName: "class_panel", name: "Class Panel", nameBn: "ক্লাস প্যানেল", sortOrder: 1 },
      {
        keyName: "teacher_assignment",
        name: "Teacher Assignment",
        nameBn: "কিতাব বন্টন",
        sortOrder: 2,
      },
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

  const featureIds: number[] = [];
  for (const [moduleKey, features] of Object.entries(featuresByModule)) {
    const moduleId = moduleIds[moduleKey];
    if (!moduleId) continue; // module was removed above / not found
    for (const f of features) {
      const row = await prisma.moduleFeature.upsert({
        where: { moduleId_keyName: { moduleId, keyName: f.keyName } },
        update: { name: f.name, nameBn: f.nameBn, sortOrder: f.sortOrder },
        create: { ...f, moduleId },
      });
      featureIds.push(row.id);
    }
  }
  await syncDelete(
    "module feature",
    await prisma.moduleFeature.findMany({ select: { id: true } }),
    featureIds,
    (id) => prisma.moduleFeature.delete({ where: { id } }),
  );

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
  const permissionIds: number[] = [];
  for (const p of permissions) {
    const row = await prisma.permission.upsert({
      where: { keyName: p.keyName },
      update: { name: p.name },
      create: p,
    });
    permissionIds.push(row.id);
  }
  await syncDelete(
    "permission",
    await prisma.permission.findMany({ select: { id: true } }),
    permissionIds,
    (id) => prisma.permission.delete({ where: { id } }),
  );

  console.log("✅ Seed complete (added/updated/removed to match seed.ts).");
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
