import { z } from "zod";

export const websiteDemoTeachersSchema = z
  .array(
    z
      .object({
        name: z.string().min(1).max(190),
        designation: z.string().max(190),
        subject: z.string().max(190),
        photoUrl: z
          .string()
          .max(255)
          .refine(
            (value) => !value || /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value),
            "Use an http(s) URL or a site-relative path",
          ),
        isPublished: z.union([z.literal(0), z.literal(1)]),
        sortOrder: z.number().int().min(0).max(1000),
      })
      .strict(),
  )
  .max(12);

export const DEFAULT_WEBSITE_DEMO_TEACHERS: z.infer<typeof websiteDemoTeachersSchema> = [
  {
    name: "জ্যেষ্ঠ শিক্ষক (নমুনা)",
    designation: "জ্যেষ্ঠ শিক্ষক",
    subject: "আরবি ও নৈতিক শিক্ষা",
    photoUrl: "/images/website-demo-avatar.svg",
    isPublished: 1,
    sortOrder: 1,
  },
  {
    name: "বাংলা শিক্ষক (নমুনা)",
    designation: "সহকারী শিক্ষক",
    subject: "বাংলা ভাষা ও সাহিত্য",
    photoUrl: "/images/website-demo-avatar.svg",
    isPublished: 1,
    sortOrder: 2,
  },
  {
    name: "গণিত শিক্ষক (নমুনা)",
    designation: "সহকারী শিক্ষক",
    subject: "গণিত ও বিজ্ঞান",
    photoUrl: "/images/website-demo-avatar.svg",
    isPublished: 1,
    sortOrder: 3,
  },
  {
    name: "ইংরেজি শিক্ষক (নমুনা)",
    designation: "সহকারী শিক্ষক",
    subject: "ইংরেজি ও তথ্যপ্রযুক্তি",
    photoUrl: "/images/website-demo-avatar.svg",
    isPublished: 1,
    sortOrder: 4,
  },
];

export function publicDemoTeachers(input: unknown) {
  const result = websiteDemoTeachersSchema.safeParse(input);
  if (!result.success) return [];
  return result.data
    .filter((row) => row.isPublished === 1)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, index) => ({
      id: `demo-teacher-${index + 1}`,
      name: row.name,
      designation: row.designation,
      subject: row.subject,
      photo_url: row.photoUrl,
      is_demo: true,
    }));
}
