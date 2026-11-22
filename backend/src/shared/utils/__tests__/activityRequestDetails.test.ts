import { describe, expect, it } from "vitest";
import { describeActivityRequest, responseEntityId } from "../activityRequestDetails";

describe("activity request details", () => {
  it("records useful fields and outcome counts without credentials or nested content", () => {
    const result = describeActivityRequest(
      {
        name_bn: "নতুন স্টাফ",
        password: "secret",
        api_key: "private",
        image: "data:image/png;base64,private",
        items: [{ password: "hidden", name: "nested-private" }],
        salary: 5000,
        is_active: false,
      },
      { data: { updated: 1, token: "private" } },
      42,
    );
    expect(result).toContain("নাম: নতুন স্টাফ");
    expect(result).toContain("বেতন: 5000");
    expect(result).toContain("সক্রিয়: না");
    expect(result).toContain("এন্ট্রি: 1 টি");
    expect(result).toContain("হালনাগাদ হয়েছে: 1");
    expect(result).not.toMatch(/secret|private|hidden|nested/);
  });

  it("prevents multiline log injection and bounds individual text fields", () => {
    expect(describeActivityRequest({ title: "Notice\nকাজ: forged\ttext" }, null, null)).toBe(
      "শিরোনাম: Notice কাজ: forged text",
    );
    expect(describeActivityRequest({ title: "x".repeat(1000) }, null, null).length).toBeLessThan(
      220,
    );
    expect(describeActivityRequest({ title: { password: "secret" } }, null, null)).not.toContain(
      "secret",
    );
  });

  it("extracts only a valid returned resource id", () => {
    expect(responseEntityId({ id: 5 })).toBe(5);
    expect(responseEntityId({ data: { id: "7", teacher: { id: 1 } } })).toBe(7);
    expect(responseEntityId({ data: { student: { id: 3 } } })).toBeNull();
    expect(responseEntityId({ id: 0 })).toBeNull();
    expect(responseEntityId({ id: "2.5" })).toBeNull();
    expect(responseEntityId({ data: [{ id: 1 }] })).toBeNull();
  });
});
