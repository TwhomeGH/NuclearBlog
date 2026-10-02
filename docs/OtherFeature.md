# 這一版 Mizuki主要額外改動了一些地方


主要是額外支持了 `Video` 組件

你能以以下方式插入視頻（**所有參數必須在同一行**）：

```md
::video[Demo Clip]{ src="./VID_20260505_212018.mp4" controls=true autoplay=false muted=true width="100%" height="468px"}
```

- `src` 用**相對路徑**＝本地影片：建置時依內容雜湊成 `/media/<檔名>.<hash>.<副檔名>`，可永久快取、支援 HTTP Range，內容有變才換 URL。
- `src` 以 `http(s)://` 開頭＝**外部影片**：外掛不改寫，快取與 Range 取決於對方主機（若對方沒有 ETag/Last-Modified 且 `max-age` 很短，過期後會整個檔案重抓）。

完整的參數表、本地／外部差異、快取與 Range 機制見 [影片與圖片載入](MEDIA_ASSETS.md)。

然後也對 `Image` 組件做了調整

```txt
![ice0 h-344px](./ice0.jpg)
```

- 原本只支持對 `width` 進行調整，現在額外支持高度控制。
- 原本他只支持用 `%`，現在 `%` 與 `px` 都可以。
- 另外開啟了響應式圖片：Markdown 圖片會自動產生 `srcset`，並依實際欄寬注入 `sizes`，只下載接近顯示寬度的版本（不再固定抓原圖畫素）。詳見 [影片與圖片載入](MEDIA_ASSETS.md)。

## CodeQL 近期修正

近期新增了 CodeQL workflow 作為額外保障，用來協助排查本地 build、lint 或人工檢查不一定會馬上暴露的隱性問題。具體修正清單統一維護在 [CodeQL 修正記錄](./CODEQL_REMEDIATION.md)，本文件只保留版本改動入口，避免後續每次修 CodeQL 都需要同步更新多份文檔。

工作流設計與排查背景可以看 [部署指南](./DEPLOYMENT.md#codeql-隐性问题排查保障)。



## 新增功能的維護文件

新增功能依主題整理，請由 [文件索引](README.md#新功能與維護入口) 查閱開發環境、浮動閱讀工具、Markdown 圖表、系列文章與版面維護說明。本文保留既有 Video／圖片擴充等補充記錄。
