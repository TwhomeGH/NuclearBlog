import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import sitemap from "@astrojs/sitemap";

export function inspectSeoPage(html, pageUrl) {
  const head = parse(html).querySelector("head");
  if (!head) return undefined;
  const robots = head.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
  if (/\bnoindex\b/i.test(robots)) return undefined;
  const canonical = head.querySelector('link[rel="canonical"]')?.getAttribute("href");
  if (!canonical || canonical !== pageUrl) return undefined;
  let lastmod;
  for (const script of head.querySelectorAll('script[type="application/ld+json"]')) {
    const data = JSON.parse(script.textContent);
    if (data["@type"] === "BlogPosting" && typeof data.dateModified === "string" && Number.isFinite(Date.parse(data.dateModified))) lastmod = data.dateModified;
  }
  return { lastmod };
}

export function seoSitemap() {
  const indexable = new Map();
  let site;
  return [{
    name: "seo-sitemap-pages",
    hooks: {
      "astro:config:done": ({ config }) => { site = config.site; },
      "astro:build:done": async ({ dir }) => {
        indexable.clear();
        const root = fileURLToPath(dir);
        async function scan(folder) {
          for (const entry of await readdir(folder, { withFileTypes: true })) {
            const file = join(folder, entry.name);
            if (entry.isDirectory()) { await scan(file); continue; }
            if (!entry.name.endsWith(".html")) continue;
            let path = relative(root, file).replace(/\\/g, "/");
            if (path === "index.html") path = "";
            else path = path.replace(/\/index\.html$/, "/");
            const url = new URL(path, site).href;
            const metadata = inspectSeoPage(await readFile(file, "utf8"), url);
            if (metadata) indexable.set(url, metadata);
          }
        }
        await scan(root);
      },
    },
  }, sitemap({
    filter: url => indexable.has(url),
    serialize: item => ({ ...item, ...indexable.get(item.url) }),
  })];
}
