import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function canonicalUrl(path: string, site: string | URL): string {
  const result = new URL(path, site);
  if (result.origin !== new URL(site).origin) throw new Error("Canonical must use the site origin");
  result.search = "";
  result.hash = "";
  return result.href;
}

export function postDescription(description: string, body: string, title: string, encrypted = false): string {
  if (encrypted) return "此文章受密碼保護。";
  if (description.trim()) return description.trim();
  const source = body.replace(/```[^]*?```|~~~[^]*?~~~/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const html = marked.parse(source, { async: false });
  const plain = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {}, nonTextTags: ["script", "style", "textarea", "pre", "code"] }).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  const chars = Array.from(plain || title);
  return chars.length > 160 ? chars.slice(0, 160).join("") + "…" : chars.join("");
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
