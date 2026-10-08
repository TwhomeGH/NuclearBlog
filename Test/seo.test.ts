import { describe, expect, it } from "vitest";
import { canonicalUrl, postDescription, serializeJsonLd } from "../src/utils/seo";
import { inspectSeoPage } from "../src/plugins/seo-sitemap.mjs";

describe("SEO metadata", () => {
 it("uses one canonical without query or fragment", () => {
  expect(canonicalUrl("/posts/a/?utm_source=x#part", "https://example.com")).toBe("https://example.com/posts/a/");
  expect(() => canonicalUrl("https://other.example/", "https://example.com")).toThrow();
 });
 it("keeps manual descriptions and excludes code from automatic excerpts", () => {
  expect(postDescription(" 自訂摘要 ", "body", "title")).toBe("自訂摘要");
  expect(postDescription("", "正文 **重點**\n\n```js\nsecretCode()\n```", "title")).toContain("正文 重點");
  expect(postDescription("", "```js\nsecretCode()\n```", "title")).toBe("title");
 });
 it("never extracts protected article text", () => {
  expect(postDescription("私密摘要", "私密正文", "title", true)).toBe("此文章受密碼保護。");
 });
 it("escapes closing script tags in structured data", () => {
  const output = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
  expect(output).not.toContain("<");
  expect(JSON.parse(output).headline).toContain("</script>");
 });
 it("excludes duplicate and noindex pages from sitemap; keeps last modification", () => {
  const head = '<head><link rel="canonical" href="https://example.com/a/"><script type="application/ld+json">{"@type":"BlogPosting","dateModified":"2026-10-01T00:00:00.000Z"}</script></head>';
  expect(inspectSeoPage(head, "https://example.com/a/").lastmod).toBe("2026-10-01T00:00:00.000Z");
  expect(inspectSeoPage(head, "https://example.com/alias/")).toBeUndefined();
  expect(inspectSeoPage(head.replace("<head>", '<head><meta name="robots" content="noindex, follow">'), "https://example.com/a/")).toBeUndefined();
 });
});
