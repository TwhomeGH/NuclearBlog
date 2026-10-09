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

4. 等待下一次排程（UTC 每天 00:17、06:17、12:17、18:17）。首次成功前 `/stats` 回傳 HTTP 200、`status: "unavailable"`、`hasData: false`；這不會觸發即時補抓。從 Worker 日誌確認更新情況。
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

## 排查 503 與更新狀態

`GET /stats` 只讀 Durable Object 的最新成功快照，不會呼叫 Clarity，也不提供歷史快照查詢。舊版沒有成功快取時回傳 503；新版改為 HTTP 200 搭配 `status: "unavailable"`、`hasData: false`，避免正常空資料狀態被當成服務故障。沒有資料時不補零，也不使用 HTTP 快取。回應中的 `diagnostics` 提供最近結果：

| reason | 意義與處理 |
| --- | --- |
| `awaiting_first_update` | 有 Token，但尚無更新結果；確認 Cron 已部署及查看 scheduled invocation。 |
| `legacy_attempt_unknown` | 有舊版留下的冷卻時間但沒有錯誤歷史；無法判定前次失敗原因，等待後續排程或查看舊日誌。 |
| `missing_token` | 此 Worker 沒有非空白 `CLARITY_API_TOKEN`；Pages 的同名變數不共用。 |
| `invalid_token_format` | Token 不是三段式 JWT；請只貼 Data Export Token，不包含 `Bearer`、引號或中間換行。前後空白會自動移除，格式錯誤不消耗上游呼叫。 |
| `upstream_redirect` | 上游回傳 3xx；程式不跟隨重新導向，避免將授權 Header 轉送到其他主機。 |
| `updating` | 已預留配額並开始更新；若長時間不變，查看該次執行是否被中止。 |
| `unauthorized` / `forbidden` | 上游 401／403，檢查 Data Export Token 與專案權限。 |
| `rate_limited` | 上游 429，冷卻 24 小時，檢查其他工具是否共用專案配額。 |
| `upstream_http_error` | 其他上游 HTTP 失敗，查看 `upstreamStatus`。 |
| `timeout` / `network_error` | 請求逾時或連線失敗，下次排程再嘗試。 |
| `invalid_json` / `invalid_schema` | 上游非有效 JSON，或沒有符合預期的單筆 Traffic 彙總；不將缺資料當作零。 |
| `storage_error` | 寫入快取失敗，檢查 Durable Object 狀態。 |
| `updated` / `legacy_snapshot` | 最近更新成功，或已有舊版留下的快取。 |

`lastAttemptAt` 是最近真正預留上游呼叫的時間；`lastSuccessAt` 是成功快取時間。`nextEligibleAt` 是冷卻解除時間，**不是保證執行時間**，仍需等後續 Cron。時間均為 UTC ISO 字串。有舊快取時仍回 200，並提供 `stale` 與最近失敗原因。

設定檔已啟用 Observability。部署新版 Worker 後，在 Cloudflare 日誌依事件搜尋 `scheduled_started`、`refresh_started`、`refresh_result`、`refresh_skipped`、`scheduled_finished`／`scheduled_failed`。更新失敗會讓 scheduled handler 報錯，冷卻略過則正常結束；持久化預留仍會阻止重複執行立即消耗配額。日誌不輸出 Token、上游原始回應或個別訪客資料。

### 從日誌確認更新了什麼

Cloudflare 自動產生的 `scheduled OK` 只表示排程正常結束（可能因冷卻而略過）；`durable_object_storage_put OK` 只表示一次儲存操作完成，也可能寫入的是冷卻或診斷狀態。請搜尋應用程式事件 `scheduled_finished` 或 `refresh_result`，確認 `reason: "updated"`。

成功日誌包含中文 `message`、`sessions`、`botSessions`、`periodHours`、`updatedAt`、`recordedAt`、`durationMs`、`upstreamStatus` 與 `nextEligibleAt`。例如「已儲存最近 72 小時統計：3 次造訪、0 次機器人造訪（期間總數，非本次新增）。」這些數字是覆寫快照的期間總數，不能當成新增人數；滾動期間的數字也可能下降。`updatedAt` 為本次抓取起始時間，`recordedAt` 為結果記錄時間，不代表 Clarity 上游資料已即時處理完畢。

冷卻時會記錄 `reason: "cooldown"`、「未呼叫 Clarity API」及 `nextEligibleAt`，不列出本次更新數字，也不覆蓋上次成功的診斷結果。新增日誌不會增加 API 呼叫。重新部署後的排程才會出現這些欄位，舊日誌不會補寫。

```powershell
pnpm dlx wrangler deploy --config workers/clarity-stats/wrangler.jsonc
pnpm dlx wrangler tail --config workers/clarity-stats/wrangler.jsonc
```

只有 GET 的 503 紀錄不足以推斷排程失敗原因。舊版沒有儲存錯誤歷史，升級後也無法還原它；必須查看既有 scheduled 日誌，或等待新版下一次排程留下結果。

出現 `network_error` 時查看同一次執行的 `refresh_exception`：包含 `phase`、`errorName`、遮蔽憑證後的 `errorMessage` 與可用時的 `causeCode`。這些細節只記錄於 Worker 日誌，不放進公開 `/stats`。沒有 HTTP 狀態不代表一定是 Token 授權錯誤；也可能是請求建立、DNS、TLS 或執行環境限制。

## 驗證範圍

本地測試覆蓋併發預留、重啟保留冷卻時間、429、網路失敗、只讀端點及回應驗證。尚需使用真實 Token 與 Cloudflare 部署驗證端到端；單元測試不等同實際 Durable Object 平台測試。若上游全站彙總不是單筆 `Traffic`，解析器會保留舊資料而不自行加總，應先核對實際 API 回應。
