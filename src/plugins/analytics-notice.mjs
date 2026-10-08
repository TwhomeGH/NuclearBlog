import { clarityConfig, umamiConfig } from "../analytics.config.mjs";

export function analyticsNotice(config = clarityConfig) {
  return {
    name: "analytics-notice",
    hooks: {
      "astro:config:setup": ({ command, logger }) => {
        if (!["dev", "build", "preview"].includes(command)) return;
        logger.info(`Umami ${umamiConfig.enabled ? "已啟用設定" : "已停用"}（${umamiConfig.websiteId}）：${command === "dev" ? "dev 不追蹤" : command === "preview" ? "使用既有產物；僅允許設定中的正式網域" : "正式產物僅在 " + umamiConfig.domains.join(", ") + " 載入追蹤"}。前台使用公開統計連結（${umamiConfig.showStats && umamiConfig.shareUrl ? "顯示" : "隱藏"}），不讀取數據 API；設定與開關：src/analytics.config.mjs，說明：docs/ANALYTICS.md。`);
        const validId = /^[a-z0-9]+$/i.test(config.projectId || "");
        if (config.enabled && !validId) throw new Error("Clarity projectId 無效。請修正 src/analytics.config.mjs 或設 enabled: false；詳見 docs/ANALYTICS.md。");
        if (command === "preview") {
          logger.info("Clarity：preview 使用既有建置產物，變更設定後須重新 build；localhost 預覽不載入。詳見 docs/ANALYTICS.md。");
          return;
        }
        if (!config.enabled) logger.info("Clarity：已停用，本次不輸出追蹤程式。設定：src/analytics.config.mjs；文件：docs/ANALYTICS.md。");
        else logger.warn(`Clarity 已啟用設定（專案 ${config.projectId}）：${command === "dev" ? "本次為 dev，不載入、不送出 Clarity 資料" : "本次 build 會輸出追蹤程式；建置本身不送出瀏覽事件"}。
不用時將 src/analytics.config.mjs 的 enabled 設為 false；fork 請更換自己的 projectId。詳見 docs/ANALYTICS.md（另含站點統計顯示開關）。`);
      },
    },
  };
}
