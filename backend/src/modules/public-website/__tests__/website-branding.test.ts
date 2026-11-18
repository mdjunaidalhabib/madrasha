import { describe, expect, it } from "vitest";
import { toMadrasaApiDto } from "../website.mapper";

describe("public website branding contacts", () => {
  it("exposes every branded contact and adapts branding social links for the website", () => {
    const dto = toMadrasaApiDto({
      name: "School", address: "Campus", reportLogo: "/logo.png",
      phone: "private-phone", email: "private@example.com",
      brandingPhones: ["01700000000", "01800000000"],
      brandingEmails: ["office@example.com", "info@example.com"],
      brandingSocialLinks: [
        { type: "facebook_page", label: "Our page", value: "https://facebook.com/school" },
        { type: "facebook_group", value: "https://facebook.com/groups/school" },
        { type: "whatsapp", value: "+880 1700-000000" },
        { type: "youtube", value: "" },
      ],
    });
    expect(dto).toMatchObject({
      name: "School", address: "Campus", logo_url: "/logo.png",
      phones: ["01700000000", "01800000000"],
      emails: ["office@example.com", "info@example.com"],
      social_links: [
        { platform: "facebook", label: "Our page", url: "https://facebook.com/school" },
        { platform: "facebook", url: "https://facebook.com/groups/school" },
        { platform: "whatsapp", url: "https://wa.me/8801700000000" },
      ],
    });
  });

  it("keeps cleared branding contacts empty without substituting account contacts", () => {
    const dto = toMadrasaApiDto({ phone: "private-phone", email: "private@example.com", brandingPhones: [], brandingEmails: [], brandingSocialLinks: [] });
    expect(dto).toMatchObject({ phones: [], emails: [], social_links: [] });
    expect(toMadrasaApiDto({})).toMatchObject({ phones: [], emails: [], social_links: [] });
  });
});
