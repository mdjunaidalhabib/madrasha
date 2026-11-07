import { z } from "zod";

export const leadStatuses = ["NEW", "CONTACTED", "DEMO_SCHEDULED", "CONVERTED", "LOST"] as const;
export function normalizeLeadPhone(value: string) {
  const digits = value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit))).replace(/[\s()+-]/g, "");
  return digits.replace(/^(?:0088|88)(01)/, "$1");
}
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const createLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().max(40).transform(normalizeLeadPhone).pipe(z.string().regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladesh mobile number")),
  institution: z.string().trim().min(2).max(180),
  institutionType: z.enum(["madrasa", "school", "college", "kindergarten", "other"]),
  // Preserve historical reporting bands while accepting the demo form's exact count.
  studentCount: z.union([z.enum(["1-100", "101-300", "301-500", "501-1000", "1000+"]), z.string().regex(/^[1-9]\d{0,6}$/)]).optional(),
  message: optionalText(2000),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
  utmSource: optionalText(200), utmMedium: optionalText(200), utmCampaign: optionalText(200),
  utmContent: optionalText(200), utmTerm: optionalText(200), fbclid: optionalText(500), landingPath: optionalText(300),
});
export const updateLeadSchema = z.object({
  status: z.enum(leadStatuses).optional(),
  notes: z.string().trim().max(10000).nullable().optional(),
  followUpAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
