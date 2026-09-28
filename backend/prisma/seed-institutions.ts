import type { InstitutionType } from "@prisma/client";

/**
 * Baseline catalogue for the non-madrasa institution types (school, college,
 * kindergarten) - Bangladesh NCTB / board structure. Merged into seed.ts's
 * divisions/classes/books/fee tiers with the same create-if-missing
 * semantics, so super-admin edits to these rows are never reverted.
 *
 * Key shape matches seed.ts: division keyName -> classes, "division/Class"
 * -> books.
 */

type SeedDivision = { keyName: string; name: string; nameBn: string; institutionType: InstitutionType };
type SeedNamed = { name: string; nameBn: string };

export const NON_MADRASA_DIVISIONS: SeedDivision[] = [
  // ---- SCHOOL ----
  { keyName: "school_primary", name: "Primary", nameBn: "প্রাথমিক", institutionType: "SCHOOL" },
  { keyName: "school_junior", name: "Junior Secondary", nameBn: "নিম্ন মাধ্যমিক", institutionType: "SCHOOL" },
  { keyName: "ssc_science", name: "Secondary - Science", nameBn: "মাধ্যমিক - বিজ্ঞান", institutionType: "SCHOOL" },
  { keyName: "ssc_business", name: "Secondary - Business Studies", nameBn: "মাধ্যমিক - ব্যবসায় শিক্ষা", institutionType: "SCHOOL" },
  { keyName: "ssc_humanities", name: "Secondary - Humanities", nameBn: "মাধ্যমিক - মানবিক", institutionType: "SCHOOL" },
  // ---- COLLEGE ----
  { keyName: "hsc_science", name: "HSC - Science", nameBn: "উচ্চ মাধ্যমিক - বিজ্ঞান", institutionType: "COLLEGE" },
  { keyName: "hsc_business", name: "HSC - Business Studies", nameBn: "উচ্চ মাধ্যমিক - ব্যবসায় শিক্ষা", institutionType: "COLLEGE" },
  { keyName: "hsc_humanities", name: "HSC - Humanities", nameBn: "উচ্চ মাধ্যমিক - মানবিক", institutionType: "COLLEGE" },
  // ---- KINDERGARTEN ----
  { keyName: "kg_preprimary", name: "Pre-Primary", nameBn: "প্রাক-প্রাথমিক", institutionType: "KINDERGARTEN" },
  { keyName: "kg_primary", name: "Primary", nameBn: "প্রাথমিক", institutionType: "KINDERGARTEN" },
];

const PRIMARY_CLASSES: SeedNamed[] = [
  { name: "Class One", nameBn: "প্রথম শ্রেণি" },
  { name: "Class Two", nameBn: "দ্বিতীয় শ্রেণি" },
  { name: "Class Three", nameBn: "তৃতীয় শ্রেণি" },
  { name: "Class Four", nameBn: "চতুর্থ শ্রেণি" },
  { name: "Class Five", nameBn: "পঞ্চম শ্রেণি" },
];
const SSC_CLASSES: SeedNamed[] = [
  { name: "Class Nine", nameBn: "নবম শ্রেণি" },
  { name: "Class Ten", nameBn: "দশম শ্রেণি" },
];
const HSC_CLASSES: SeedNamed[] = [
  { name: "Class Eleven", nameBn: "একাদশ শ্রেণি" },
  { name: "Class Twelve", nameBn: "দ্বাদশ শ্রেণি" },
];

export const NON_MADRASA_CLASSES: Record<string, SeedNamed[]> = {
  school_primary: PRIMARY_CLASSES,
  school_junior: [
    { name: "Class Six", nameBn: "ষষ্ঠ শ্রেণি" },
    { name: "Class Seven", nameBn: "সপ্তম শ্রেণি" },
    { name: "Class Eight", nameBn: "অষ্টম শ্রেণি" },
  ],
  ssc_science: SSC_CLASSES,
  ssc_business: SSC_CLASSES,
  ssc_humanities: SSC_CLASSES,
  hsc_science: HSC_CLASSES,
  hsc_business: HSC_CLASSES,
  hsc_humanities: HSC_CLASSES,
  kg_preprimary: [
    { name: "Play", nameBn: "প্লে" },
    { name: "Nursery", nameBn: "নার্সারি" },
    { name: "KG", nameBn: "কেজি" },
  ],
  kg_primary: PRIMARY_CLASSES,
};

const s = (name: string, nameBn: string): SeedNamed => ({ name, nameBn });

const PRIMARY_EARLY = [s("Bangla", "বাংলা"), s("English", "ইংরেজি"), s("Mathematics", "গণিত")];
const PRIMARY_LATE = [
  ...PRIMARY_EARLY,
  s("Bangladesh and Global Studies", "বাংলাদেশ ও বিশ্বপরিচয়"),
  s("Primary Science", "প্রাথমিক বিজ্ঞান"),
  s("Religion and Moral Education", "ধর্ম ও নৈতিক শিক্ষা"),
];
const JUNIOR = [
  s("Bangla 1st Paper", "বাংলা ১ম পত্র"),
  s("Bangla 2nd Paper", "বাংলা ২য় পত্র"),
  s("English 1st Paper", "ইংরেজি ১ম পত্র"),
  s("English 2nd Paper", "ইংরেজি ২য় পত্র"),
  s("Mathematics", "গণিত"),
  s("Science", "বিজ্ঞান"),
  s("Bangladesh and Global Studies", "বাংলাদেশ ও বিশ্বপরিচয়"),
  s("Religion and Moral Education", "ধর্ম ও নৈতিক শিক্ষা"),
  s("ICT", "তথ্য ও যোগাযোগ প্রযুক্তি"),
  s("Agriculture Studies", "কৃষিশিক্ষা"),
];
const SSC_COMMON = [
  s("Bangla 1st Paper", "বাংলা ১ম পত্র"),
  s("Bangla 2nd Paper", "বাংলা ২য় পত্র"),
  s("English 1st Paper", "ইংরেজি ১ম পত্র"),
  s("English 2nd Paper", "ইংরেজি ২য় পত্র"),
  s("Mathematics", "গণিত"),
  s("Religion and Moral Education", "ধর্ম ও নৈতিক শিক্ষা"),
  s("ICT", "তথ্য ও যোগাযোগ প্রযুক্তি"),
];
const SSC_SCIENCE = [
  ...SSC_COMMON,
  s("Physics", "পদার্থবিজ্ঞান"),
  s("Chemistry", "রসায়ন"),
  s("Biology", "জীববিজ্ঞান"),
  s("Higher Mathematics", "উচ্চতর গণিত"),
  s("Bangladesh and Global Studies", "বাংলাদেশ ও বিশ্বপরিচয়"),
];
const SSC_BUSINESS = [
  ...SSC_COMMON,
  s("Accounting", "হিসাববিজ্ঞান"),
  s("Finance and Banking", "ফিন্যান্স ও ব্যাংকিং"),
  s("Business Entrepreneurship", "ব্যবসায় উদ্যোগ"),
  s("General Science", "বিজ্ঞান"),
  s("Agriculture Studies", "কৃষিশিক্ষা"),
];
const SSC_HUMANITIES = [
  ...SSC_COMMON,
  s("History of Bangladesh and World Civilization", "বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা"),
  s("Geography and Environment", "ভূগোল ও পরিবেশ"),
  s("Civics and Citizenship", "পৌরনীতি ও নাগরিকতা"),
  s("Economics", "অর্থনীতি"),
  s("General Science", "বিজ্ঞান"),
];
const HSC_COMMON = [
  s("Bangla 1st Paper", "বাংলা ১ম পত্র"),
  s("Bangla 2nd Paper", "বাংলা ২য় পত্র"),
  s("English 1st Paper", "ইংরেজি ১ম পত্র"),
  s("English 2nd Paper", "ইংরেজি ২য় পত্র"),
  s("ICT", "তথ্য ও যোগাযোগ প্রযুক্তি"),
];
const papers = (name: string, nameBn: string) => [s(`${name} 1st Paper`, `${nameBn} ১ম পত্র`), s(`${name} 2nd Paper`, `${nameBn} ২য় পত্র`)];
const HSC_SCIENCE = [
  ...HSC_COMMON,
  ...papers("Physics", "পদার্থবিজ্ঞান"),
  ...papers("Chemistry", "রসায়ন"),
  ...papers("Biology", "জীববিজ্ঞান"),
  ...papers("Higher Mathematics", "উচ্চতর গণিত"),
];
const HSC_BUSINESS = [
  ...HSC_COMMON,
  ...papers("Accounting", "হিসাববিজ্ঞান"),
  ...papers("Business Organization and Management", "ব্যবসায় সংগঠন ও ব্যবস্থাপনা"),
  ...papers("Finance, Banking and Insurance", "ফিন্যান্স, ব্যাংকিং ও বিমা"),
  ...papers("Production Management and Marketing", "উৎপাদন ব্যবস্থাপনা ও বিপণন"),
];
const HSC_HUMANITIES = [
  ...HSC_COMMON,
  ...papers("History", "ইতিহাস"),
  ...papers("Civics and Good Governance", "পৌরনীতি ও সুশাসন"),
  ...papers("Economics", "অর্থনীতি"),
  ...papers("Islamic History and Culture", "ইসলামের ইতিহাস ও সংস্কৃতি"),
];
const KG_EARLY = [
  s("Bangla", "বাংলা"),
  s("English", "ইংরেজি"),
  s("Mathematics", "গণিত"),
  s("Rhymes and Stories", "ছড়া ও গল্প"),
  s("Drawing", "ছবি আঁকা"),
];
const KG_UPPER = [
  s("Bangla", "বাংলা"),
  s("English", "ইংরেজি"),
  s("Mathematics", "গণিত"),
  s("General Knowledge", "সাধারণ জ্ঞান"),
  s("Religion", "ধর্ম"),
  s("Drawing", "ছবি আঁকা"),
];

const forClasses = (division: string, classes: SeedNamed[], books: (c: SeedNamed, i: number) => SeedNamed[]) =>
  Object.fromEntries(classes.map((c, i) => [`${division}/${c.name}`, books(c, i)]));

export const NON_MADRASA_BOOKS: Record<string, SeedNamed[]> = {
  ...forClasses("school_primary", PRIMARY_CLASSES, (_c, i) => (i < 2 ? PRIMARY_EARLY : PRIMARY_LATE)),
  ...forClasses("school_junior", NON_MADRASA_CLASSES.school_junior, () => JUNIOR),
  ...forClasses("ssc_science", SSC_CLASSES, () => SSC_SCIENCE),
  ...forClasses("ssc_business", SSC_CLASSES, () => SSC_BUSINESS),
  ...forClasses("ssc_humanities", SSC_CLASSES, () => SSC_HUMANITIES),
  ...forClasses("hsc_science", HSC_CLASSES, () => HSC_SCIENCE),
  ...forClasses("hsc_business", HSC_CLASSES, () => HSC_BUSINESS),
  ...forClasses("hsc_humanities", HSC_CLASSES, () => HSC_HUMANITIES),
  ...forClasses("kg_preprimary", NON_MADRASA_CLASSES.kg_preprimary, (_c, i) => (i < 2 ? KG_EARLY : KG_UPPER)),
  ...forClasses("kg_primary", PRIMARY_CLASSES, (_c, i) => (i < 2 ? PRIMARY_EARLY : PRIMARY_LATE)),
};

type FeeTier = { admission: number; form: number; tuition: number; exam: number; boarding: number };

/** Demo per-class fee amounts (same shape as seed.ts feeTierByDivision). */
export const NON_MADRASA_FEE_TIERS: Record<string, FeeTier> = {
  school_primary: { admission: 1000, form: 200, tuition: 500, exam: 300, boarding: 0 },
  school_junior: { admission: 1500, form: 250, tuition: 700, exam: 400, boarding: 0 },
  ssc_science: { admission: 2000, form: 300, tuition: 900, exam: 500, boarding: 0 },
  ssc_business: { admission: 2000, form: 300, tuition: 850, exam: 500, boarding: 0 },
  ssc_humanities: { admission: 2000, form: 300, tuition: 800, exam: 500, boarding: 0 },
  hsc_science: { admission: 3000, form: 400, tuition: 1200, exam: 700, boarding: 0 },
  hsc_business: { admission: 3000, form: 400, tuition: 1100, exam: 700, boarding: 0 },
  hsc_humanities: { admission: 3000, form: 400, tuition: 1000, exam: 700, boarding: 0 },
  kg_preprimary: { admission: 1500, form: 200, tuition: 800, exam: 300, boarding: 0 },
  kg_primary: { admission: 1500, form: 200, tuition: 900, exam: 350, boarding: 0 },
};

/** Per-plan registration-number block size for each non-madrasa division. */
export const NON_MADRASA_REG_BLOCKS: Record<string, Record<string, number>> = {
  Basic: {
    school_primary: 40, school_junior: 40, ssc_science: 30, ssc_business: 30, ssc_humanities: 30,
    hsc_science: 50, hsc_business: 50, hsc_humanities: 50, kg_preprimary: 30, kg_primary: 30,
  },
  Standard: {
    school_primary: 80, school_junior: 80, ssc_science: 60, ssc_business: 60, ssc_humanities: 60,
    hsc_science: 100, hsc_business: 100, hsc_humanities: 100, kg_preprimary: 60, kg_primary: 60,
  },
  Premium: {
    school_primary: 200, school_junior: 200, ssc_science: 150, ssc_business: 150, ssc_humanities: 150,
    hsc_science: 250, hsc_business: 250, hsc_humanities: 250, kg_preprimary: 150, kg_primary: 150,
  },
};
