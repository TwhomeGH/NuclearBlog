import type { CollectionEntry } from "astro:content";
type Post = CollectionEntry<"posts">;

export function isSeriesChapter(post: Post) {
  return Boolean(post.data.series && (post.data.seriesOrder ?? 0) > 0);
}

/** 驗證明確排序，避免重號或漏設導讀造成錯誤連結。 */
export function groupSeries(posts: Post[]) {
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    const { series, seriesOrder } = post.data;
    if (!series && seriesOrder === undefined) continue;
    if (!series || seriesOrder === undefined) throw new Error(`${post.id}: series 與 seriesOrder 必須一起設定`);
    const group = groups.get(series) ?? [];
    if (group.some(p => p.data.seriesOrder === seriesOrder)) throw new Error(`${series}: seriesOrder ${seriesOrder} 重複`);
    group.push(post);
    groups.set(series, group);
  }
  for (const [name, group] of groups) {
    group.sort((a, b) => a.data.seriesOrder! - b.data.seriesOrder!);
    if (group[0].data.seriesOrder !== 0) throw new Error(`${name}: 缺少 seriesOrder: 0 的系列導讀`);
  }
  return groups;
}
