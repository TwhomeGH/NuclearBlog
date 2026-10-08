// Fork 前請更換為自己的專案 ID；不用時設 enabled: false。
// 操作說明：docs/ANALYTICS.md
export const clarityConfig = {
  enabled: true,
  projectId: "ytd2zio6uv",
  // 部署 workers/clarity-stats 後填入 https://你的-worker.workers.dev/stats。
  showStats: true,
  statsEndpoint: "",
};

export const umamiConfig = {
  enabled: true,
  scriptUrl: "https://cloud.umami.is/script.js",
  websiteId: "662bd9bf-026f-46ec-b6c4-09183aaa1a88",
  // 只在此正式網域收集；fork 或更換網域時需一併修改。
  domains: ["nuclearblog.pages.dev"],
  showStats: true,
  // 公開統計入口；fork 時更換為自己的分享連結，不提供則填空字串。
  shareUrl: "https://cloud.umami.is/share/CAaXynL6S0GJqfWc",
};
