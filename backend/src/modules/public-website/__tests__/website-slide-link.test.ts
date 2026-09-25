import { describe, expect, it } from "vitest";
import { normalizeSlideLink } from "../website.service";

describe("normalizeSlideLink", () => {
  it("empty -> null", () => {
    expect(normalizeSlideLink(undefined)).toBeNull();
    expect(normalizeSlideLink("   ")).toBeNull();
  });

  it("keeps http(s) URLs and site paths", () => {
    expect(normalizeSlideLink(" https://example.com/x ")).toBe("https://example.com/x");
    expect(normalizeSlideLink("http://example.com")).toBe("http://example.com");
    expect(normalizeSlideLink("/admission")).toBe("/admission");
    expect(normalizeSlideLink("#about")).toBe("#about");
  });

  it("prepends https:// to a bare domain (incl. port)", () => {
    expect(normalizeSlideLink("www.example.com/page")).toBe("https://www.example.com/page");
    expect(normalizeSlideLink("example.com:8080")).toBe("https://example.com:8080");
  });

  it("rejects other schemes and protocol-relative URLs", () => {
    expect(() => normalizeSlideLink("javascript:alert(1)")).toThrow();
    expect(() => normalizeSlideLink("JavaScript:alert(1)")).toThrow();
    expect(() => normalizeSlideLink("data:text/html,x")).toThrow();
    expect(() => normalizeSlideLink("//evil.com")).toThrow();
  });

  it("rejects over-long links", () => {
    expect(() => normalizeSlideLink(`https://x.com/${"a".repeat(260)}`)).toThrow("too long");
  });
});
