# 流量統計與 fork 前設定

[返回文件索引](README.md)

## Fork 後先檢查追蹤設定

此倉庫含本站的追蹤識別碼。Fork 後直接部署會沿用這些識別碼，訪客事件可能送到原專案的後台；取得程式碼不代表取得該後台的管理權限。部署自己的網站前，請更換為自己的專案，或移除不用的追蹤程式。

| 項目 | 目前位置 | Fork 後處理 |
| --- | --- | --- |
| Clarity 專案 `ytd2zio6uv` | [analytics.config.mjs](../src/analytics.config.mjs) | 更換 `projectId`；不用則設 `enabled: false` |
| GTM 容器 `GTM-KRX3XGVH` | [Layout.astro](../src/layouts/Layout.astro) 的 `loadAnalytics()` 與 body 的 noscript iframe | 換成自己的容器 ID，兩處一起改；不用時移除對應 script 與 iframe |
| Umami 追蹤 | [analytics.config.mjs](../src/analytics.config.mjs) 的 `umamiConfig` | 更換 `websiteId`、確認 `scriptUrl` 並更新 `domains`；不用則設 `enabled: false` |
| 舊 Umami 分享介面 | [astro.config.mjs](../astro.config.mjs) 的 `umami({ shareUrl: false })` | 目前沒有啟用分享數據；若接入，使用自己專案的設定 |

這些前端 ID 是公開識別碼，不是密碼。API 密鑰與後台登入憑證不應放進前端原始碼。請依實際使用的服務更新自己網站的隱私說明。

## Clarity 安裝與停用

本專案使用手動安裝，不需要另裝 NPM 套件。集中設定在 `src/analytics.config.mjs`：

```js
export const clarityConfig = {
  enabled: true, // 不需要追蹤時改為 false
  projectId: "你的專案ID", // fork 後務必更換
};
```

變更後重新啟動 dev；正式網站需要重新 build 並部署才生效。停用不會刪除 Clarity 後台已收集的資料，也不會關閉 GTM 或內容統計卡片。不要同時透過 GTM 安裝另一份 Clarity。

啟動 `pnpm dev`／`pnpm build` 時，終端會列出啟用狀態、專案 ID、當次是否輸出追蹤程式，以及設定與文件路徑。`dev:refresh`、`start` 和直接執行 Astro 也沿用同一個掛鉤；dev 若由 Astro 背景服務執行，訊息也可在 `pnpm dev:logs` 查看。`pnpm preview` 提醒使用的是既有產物，不能僅修改設定就改變它。

`pnpm dev` 不輸出 Clarity 載入程式；正式建置才輸出，且 localhost、其子網域、127.0.0.1 與 IPv6 loopback 預覽會略過。其他主機名稱不在這個排除範圍：正式產物部署到公開預覽網域，或透過區網 IP 開啟，都可能發送事件。若預覽環境也要完全停用，應另外增加明確的主機允許清單或部署環境開關。

載入程式會避免同一頁重複插入 Clarity script，但這不能替代檢查 GTM 後台是否另外設定追蹤。以上環境控制只針對 Clarity，GTM 沒有因此自動停用。

## 部署後驗證

1. 執行完整 `pnpm build` 並部署到自己的網站。
2. 開啟正式網址，確認 Network 中的 Clarity tag 請求使用自己的 ID，而不是原作者的 ID。
3. 到自己的 Clarity 後台確認收到資料。建置通過或 script 下載成功，均不能單獨證明事件已入庫；瀏覽器封鎖、同意設定及網路都可能影響收集。

## 站點統計與訪客統計不同

頁尾／側欄的站點統計是文章、分類、標籤、字數與日期等內容資料，不是訪客人數。Clarity 主要用於行為分析；目前 Umami 追蹤會將事件送往 Umami 後台，本站則提供「查看公開流量統計」外部連結，讓訪客自行查看 Umami 分享頁，不在本站讀取或顯示即時瀏覽數字。瀏覽次數、造訪次數與不重複訪客數應分別標示，不應混稱為「瀏覽人數」。

## 關閉「站點統計」顯示

若要隱藏文章數、字數等卡片，在 `src/config.ts` 的 `sidebarLayoutConfig.components` 中，從 `left`、`right`、`drawer` 各陣列移除 `"site-stats"`（若存在）。例如目前右側改成 `right: ["calendar"]`。頁尾與手機選單的統計入口也會消失；恢復 `"site-stats"` 即可重新顯示。日曆則對應 `"calendar"`。

這只改變 UI，不會停用 Clarity；要停止 Clarity 請使用上面的 `enabled: false`。

## Umami 追蹤與公開統計連結

設定集中在 [src/analytics.config.mjs](../src/analytics.config.mjs)。以下為 fork 設定範例，請填入自己的 Website ID、網域與分享連結：

```js
export const umamiConfig = {
  enabled: true,
  scriptUrl: "https://cloud.umami.is/script.js",
  websiteId: "你的 Umami Website ID",
  domains: ["blog.example.com"],
  showStats: true,
  shareUrl: "https://cloud.umami.is/share/你的分享識別碼",
};
```

| 欄位 | 用途 |
| --- | --- |
| `enabled` | 控制正式產物是否輸出追蹤載入程式；不控制公開統計連結，也不影響 Clarity／GTM。 |
| `scriptUrl` | Umami 提供的追蹤腳本網址；自架時改用自己服務的網址。 |
| `websiteId` | 自己的 Umami Website ID，不是 API 金鑰。 |
| `domains` | 與 `location.hostname` 完全相符的允許清單；不含協定、路徑、連接埠，不支援萬用字元。主網域與 www 子網域需分別列入；空陣列不允許任何網域。 |
| `showStats` | 控制站點統計卡片與文章資訊列中的公開統計入口；不影響追蹤與文章數、字數等內容統計。 |
| `shareUrl` | 自己的公開分享網址。空字串時不顯示入口；fork 時務必更換，否則會連到原作者的統計頁。 |

目前本站連結為 [Umami 公開統計](https://cloud.umami.is/share/CAaXynL6S0GJqfWc)。全站統計卡片（含手機入口）與文章資訊列都連到同一份**全站**報表，不是個別文章的篩選報表。點擊後另開分頁；本站不嵌入 iframe，也不向分享頁或數據 API 背景請求資料。

此方案不需要 API key。已移除開發示例數字、`devExample` 設定及「尚未接入統計數據」佔位文字；dev 與正式頁面顯示相同的公開連結。

### 常用開關

- 保留追蹤但隱藏入口：`enabled: true`、`showStats: false`。
- 停止追蹤但保留公開歷史報表入口：`enabled: false`、`showStats: true`，並保留 `shareUrl`。
- 停止追蹤且隱藏入口：`enabled: false`、`showStats: false`。
- 沒有公開分享頁：將 `shareUrl` 設為空字串。

### 開發與部署

`pnpm dev` 不注入 Umami tracker。正式產物只在 `enabled: true` 且 hostname 符合 `domains` 時載入追蹤；建置本身不送出瀏覽事件。目前 localhost 與區網 IP 不在清單內，因此正式產物在這些位址預覽也不載入追蹤。

設定變更後重新啟動 dev；正式網站需重新 build 並部署。`pnpm preview` 使用既有產物。啟動日誌會提示追蹤狀態與公開入口的顯示設定；背景 dev 可透過 `pnpm dev:logs` 查看日誌。

Fork 時請同時確認 `websiteId`、`scriptUrl`、`domains` 與 `shareUrl`。公開分享頁可供取得連結的人查看，請在 Umami 後台確認分享範圍；撤銷分享後也應清空本站的 `shareUrl` 或隱藏入口。

部署後確認連結開啟的是自己的報表，再到 Umami 後台驗證首次進站與 Swup 切換文章是否正常計數。不要透過 GTM 重複安裝相同 tracker。舊的 `oddmisc` 分享整合仍維持停用，不必將此連結再填進 `astro.config.mjs`。

## Clarity 前台統計

已提供獨立排程快取服務與全站卡片；設定 `clarityConfig.statsEndpoint` 才顯示。每 6 小時更新最近 72 小時的全站造訪摘要，訪客只讀快取。需要在 Cloudflare Secret 設定匯出 Token，不能使用追蹤 projectId 代替。完整部署、限流與停用方式見 [Clarity 前台統計](CLARITY-STATS.md)。
