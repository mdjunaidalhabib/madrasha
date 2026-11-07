import { describe, expect, it } from "vitest";
import { createLeadSchema, updateLeadSchema } from "../lead.validation";

const valid = { name: "Demo Contact", phone: "01712345678", institution: "Demo School", institutionType: "school", consent: true };
describe("lead input validation", () => {
  it.each(["50", "200", "700", "2001", "9999999", "1-100", "1000+"])("accepts exact student counts and legacy bands: %s", (studentCount) => {
    expect(createLeadSchema.parse({ ...valid, studentCount }).studentCount).toBe(studentCount);
  });
  it.each(["0", "-1", "1.5", "10000000", "oops"])("rejects invalid exact student counts: %s", (studentCount) => {
    expect(createLeadSchema.safeParse({ ...valid, studentCount }).success).toBe(false);
  });
  it.each(["01712345678", "+880 1712-345678", "008801712345678", "০১৭১২৩৪৫৬৭৮"])("normalizes Bangladesh mobile format %s", (phone) => {
    expect(createLeadSchema.parse({ ...valid, phone }).phone).toBe("01712345678");
  });
  it.each(["01212345678", "017123", "017123456789", "01712345678<script>"])("rejects invalid phone %s", (phone) => {
    expect(createLeadSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });
  it("requires explicit contact consent and rejects the spam trap", () => {
    expect(createLeadSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(createLeadSchema.safeParse({ ...valid, consent: undefined }).success).toBe(false);
    expect(createLeadSchema.safeParse({ ...valid, website: "spam" }).success).toBe(false);
  });
  it("preserves attribution, trims inputs and prevents public status assignment", () => {
    const result = createLeadSchema.parse({ ...valid, name: " Demo Contact ", utmCampaign: "ad-01", status: "CONVERTED" });
    expect(result.name).toBe("Demo Contact");
    expect(result.utmCampaign).toBe("ad-01");
    expect(result).not.toHaveProperty("status");
  });
  it("allows only known stages and valid follow-up timestamps for admin updates", () => {
    expect(updateLeadSchema.safeParse({ status: "CONVERTED", followUpAt: "2026-11-08T12:00:00+06:00" }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ followUpAt: null, notes: "" }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ status: "INVALID" }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ followUpAt: "tomorrow" }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ phone: "01712345678" }).success).toBe(false);
    expect(updateLeadSchema.safeParse({}).success).toBe(false);
  });
});
