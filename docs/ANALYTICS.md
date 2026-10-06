# 流量統計與 fork 前設定

[返回文件索引](README.md)

## Fork 後先檢查追蹤設定

此倉庫含本站的追蹤識別碼。Fork 後直接部署會沿用這些識別碼，訪客事件可能送到原專案的後台；取得程式碼不代表取得該後台的管理權限。部署自己的網站前，請更換為自己的專案，或移除不用的追蹤程式。

| 項目 | 目前位置 | Fork 後處理 |
| --- | --- | --- |
| Clarity 專案 `ytd2zio6uv` | [Layout.astro](../src/layouts/Layout.astro) 的 `data-clarity-loader` | 換成自己的 Clarity ID，或刪除整個 Clarity 條件區塊 |
| GTM 容器 `GTM-KRX3XGVH` | 同檔案的 `loadAnalytics()` 與 body 的 noscript iframe | 換成自己的容器 ID，兩處一起改；不用時移除對應 script 與 iframe |
| Umami 前台數據 | [astro.config.mjs](../astro.config.mjs) 的 `umami({ shareUrl: false })` | 目前沒有啟用分享數據；若接入，使用自己專案的設定 |

這些前端 ID 是公開識別碼，不是密碼。API 密鑰與後台登入憑證不應放進前端原始碼。請依實際使用的服務更新自己網站的隱私說明。

## Clarity 安裝與停用

本專案使用手動安裝，不需要另裝 NPM 套件。到自己的 Clarity 專案取得 ID，替換 `https://www.clarity.ms/tag/ytd2zio6uv` 最後一段即可。不要同時再透過 GTM 安裝另一份 Clarity。

不需要 Clarity 時，在 Layout 刪除含 `data-clarity-loader` 的整個 `{import.meta.env.PROD && ...}` 區塊。只刪除 ID 會留下無效請求，並不是完整停用。

`pnpm dev` 不輸出 Clarity 載入程式；正式建置才輸出，且 localhost、其子網域、127.0.0.1 與 IPv6 loopback 預覽會略過。其他主機名稱不在這個排除範圍：正式產物部署到公開預覽網域，或透過區網 IP 開啟，都可能發送事件。若預覽環境也要完全停用，應另外增加明確的主機允許清單或部署環境開關。

載入程式會避免同一頁重複插入 Clarity script，但這不能替代檢查 GTM 後台是否另外設定追蹤。以上環境控制只針對 Clarity，GTM 沒有因此自動停用。

## 部署後驗證

1. 執行完整 `pnpm build` 並部署到自己的網站。
2. 開啟正式網址，確認 Network 中的 Clarity tag 請求使用自己的 ID，而不是原作者的 ID。
3. 到自己的 Clarity 後台確認收到資料。建置通過或 script 下載成功，均不能單獨證明事件已入庫；瀏覽器封鎖、同意設定及網路都可能影響收集。

## 站點統計與訪客統計不同

頁尾／側欄的站點統計是文章、分類、標籤、字數與日期等內容資料，不是訪客人數。Clarity 主要用於行為分析；既有個人卡片與文章瀏覽數顯示則使用 Umami 資料介面。瀏覽次數、造訪次數與不重複訪客數應分別標示，不應混稱為「瀏覽人數」。
