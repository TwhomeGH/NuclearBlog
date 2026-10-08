# 在本站顯示 Clarity 統計

[返回統計設定](ANALYTICS.md)

## 顯示內容與目前狀態

站點統計卡片（含手機入口）可顯示 Clarity 全站造訪次數、機器人造訪次數，以及截至快取更新時間的最近 72 小時期間。直接使用 API 的 `totalSessionCount`、`totalBotSessionCount`；兩者分別列出，不推算真人訪客或瀏覽量，不與 Umami 相加。這不是累積總人數，也不是單篇文章數據。錄影、熱圖與個別訪客紀錄不會公開。

程式與測試已提供；需要自行部署 Worker、設定 Secret 及端點後才會顯示。未設定 `statsEndpoint` 時不顯示佔位或假數字。Umami 公開連結仍獨立保留。

## 配額與更新方式

[Clarity 官方 API 文件](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api)規定每專案每日最多 10 次，僅支援最近 1～3 天，最多 1,000 列且不能分頁。

- 獨立 Cloudflare Worker 每 6 小時排程一次，正常每日 4 次，取 72 小時、不帶維度的全站彙總。
- Durable Object 使用固定實例與持久化的下一次可呼叫時間，發送前先預留 6 小時。重啟、失敗或重複觸發不立即重試。
- 429 會再冷卻 24 小時；其他錯誤保留舊快取，等下一次排程。超過 12 小時的資料標示「暫用上次資料」。
- 公開 `/stats` 僅讀快取，不允許手動刷新、時間區間或其他查詢參數；訪客增加不會消耗 Clarity API 次數。瀏覽器／HTTP 快取 5 分鐘，多個卡片共用前端請求。
- 10 次配額由整個 Clarity 專案共用。不要另外為同一專案部署多份排程、刪除限流狀態或同時用其他工具高頻匯出。
- Worker 和 Durable Object 仍有各自的 Cloudflare 用量；Clarity 限流不代表 Cloudflare 的訪客讀取完全沒有成本。

## 部署步驟

1. 以 Clarity 專案管理員登入，開啟 **Settings → Data Export** 產生 Token。不要貼到聊天、前端或 Git。
2. 檢查 `workers/clarity-stats/wrangler.jsonc` 的 Worker 名稱與 `ALLOWED_ORIGIN`；後者填網站 origin（含 https、不加結尾斜線）。Fork 使用自己的 Token 與 origin。
3. 在專案根目錄使用 Wrangler 登入與部署：

```powershell
pnpm dlx wrangler login
pnpm dlx wrangler deploy --config workers/clarity-stats/wrangler.jsonc
pnpm dlx wrangler secret put CLARITY_API_TOKEN --config workers/clarity-stats/wrangler.jsonc
```

最後一行會互動要求輸入 Token，勿將 Token 寫在命令參數中。這是獨立 Worker，不需將 Astro 改成 SSR。部署前請確認 Cloudflare 帳號可使用 SQLite Durable Objects。

4. 等待下一次排程（UTC 每天 00:17、06:17、12:17、18:17）。首次成功前 `/stats` 回傳 503；這不會觸發即時補抓。從 Worker 日誌確認更新情況。
5. 開啟 `https://你的-worker.workers.dev/stats`，確認回應含 `sessions`、`botSessions`、`periodHours: 72` 與 `updatedAt`，再在 `src/analytics.config.mjs` 設定：

```js
export const clarityConfig = {
  enabled: true,
  projectId: "你的追蹤專案ID",
  showStats: true,
  statsEndpoint: "https://你的-worker.workers.dev/stats",
};
```

6. 重新建置、部署部落格，查看站點統計卡片。若要本地連線測試，需暫時把 Worker 的 `ALLOWED_ORIGIN` 改成本地 origin；正式部署後恢復正式 origin。不要因此將 Token 放到前端。

`enabled` 只控制追蹤、`showStats` 只控制卡片；關閉卡片或追蹤**不會停止 Worker 排程**。要停止資料匯出，移除 `triggers.crons` 的排程並重新部署 Worker。撤銷分享不會刪除已公開的彙總快取；需要下線時停用 Worker。

## 驗證範圍

本地測試覆蓋併發預留、重啟保留冷卻時間、429、網路失敗、只讀端點及回應驗證。尚需使用真實 Token 與 Cloudflare 部署驗證端到端；單元測試不等同實際 Durable Object 平台測試。若上游全站彙總不是單筆 `Traffic`，解析器會保留舊資料而不自行加總，應先核對實際 API 回應。
