import type { CollectionEntry } from "astro:content";
import type { ImageMetadata } from "astro";
import { siteConfig, profileConfig } from "../config";
import { getPostUrl } from "./url-utils";
import { canonicalUrl, postDescription } from "./seo";

const images = import.meta.glob<{ default: ImageMetadata }>("/src/**/*.{png,jpg,jpeg,webp,avif,gif}");
export async function postSeo(entry: CollectionEntry<"posts">) {
  const noindex = entry.data.draft || entry.data.encrypted;
  const canonical = canonicalUrl(getPostUrl(entry), siteConfig.siteURL);
  const description = postDescription(entry.data.description, entry.body || "", entry.data.title, entry.data.encrypted);
  let image: string | undefined;
  const cover = entry.data.image;
  if (!noindex && cover) {
    if (/^https?:\/\//.test(cover) || cover.startsWith("/")) image = new URL(cover, siteConfig.siteURL).href;
    else if (entry.filePath) {
      const file = entry.filePath.replace(/\\/g, "/");
      const relative = file.startsWith("src/") ? "/" + file : file.slice(file.indexOf("/src/"));
      const key = new URL(cover, "https://local" + relative).pathname;
      if (images[key]) image = new URL((await images[key]()).default.src, siteConfig.siteURL).href;
    }
  }
  const jsonLd = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: entry.data.title, description, url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Person", name: entry.data.author || profileConfig.name, url: siteConfig.siteURL },
    datePublished: entry.data.published.toISOString(),
    dateModified: (entry.data.updated || entry.data.published).toISOString(),
    inLanguage: (entry.data.lang || siteConfig.lang).replace("_", "-"),
    keywords: entry.data.tags, ...(image ? { image: [image] } : {}),
  };
  return { noindex, canonical, description, image, jsonLd };
}
