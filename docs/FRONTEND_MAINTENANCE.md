# 前端組件與版面維護

[返回文件索引](README.md)

## 先找對修改層級

| 想修改的內容 | 入口 |
| --- | --- |
| 網站設定、目錄與播放器開關 | [src/config.ts](../src/config.ts) |
| 全站殼層、共用樣式及浮動工具 | [Layout.astro](../src/layouts/Layout.astro) |
| 導航、橫幅、側欄及主要網格 | [MainGridLayout.astro](../src/layouts/MainGridLayout.astro) |
| 文章正文周圍的版面 | [文章路由](../src/pages/posts/[...slug].astro) 與 [permalink 路由](../src/pages/[permalink].astro) |
| Markdown 元素樣式 | [markdown-extend.styl](../src/styles/markdown-extend.styl) |
| Markdown 擴充語法 | [astro.config.mjs](../astro.config.mjs) 與 [plugins](../src/plugins/) |
| 內容欄位與驗證 | [content.config.ts](../src/content.config.ts) |

## 新增組件

只在特定版面使用的靜態區塊，可建立 Astro 組件後在對應 layout／page 匯入。需要互動時，依現有架構使用 Svelte hydration 或具有完整生命週期的 custom element。全站工具掛在 Layout，文章專用區塊則掛在文章模板，避免重複渲染。

Markdown 不會因為建立了一個 `.astro` 或 `.svelte` 檔案，就自動支援同名標籤。需要作者可用的語法時，另加 remark／rehype 轉換，將節點轉成可渲染 HTML，再註冊到 Markdown processor。互動圖表的 [remark 插件](../src/plugins/remark-echarts.mjs) 與 [執行端](../src/scripts/echarts-runtime.ts) 是完整範例。

使用 Astro scoped style 時，確認選擇器能命中組件實際輸出的元素；動態建立的子節點應由適當的全域樣式處理。一般 `.css` 檔不要套用僅在組件編譯情境有效的 `:global(...)` 寫法。

## 互動與驗證

本站使用 Swup 切頁，不能只依賴第一次 `DOMContentLoaded`。互動組件要能重複掛載，在移除時清理 observer、事件與圖表實例，並處理深淺色切換及容器大小變更。

修改後至少檢查桌機與手機、深淺色、鍵盤聚焦、切頁返回；文章版面須同時考慮一般 slug 與 permalink 入口。圖表與浮動元件另依各自文件的檢查清單驗證。

## 文件與文章的界線

`docs` 放正式操作、設定與維護說明；`src/content/posts` 放會進入網站內容流程的文章。示例文章可以展示實際渲染效果，但不能作為唯一的維護手冊。

提交時按功能分組，程式與對應相依套件一起提交；文件可獨立提交。文章草稿及正式文章另行審閱，使用明確路徑暫存，避免 `git add .` 把未完成內容一起納入。即使文章標記 `draft`，也仍需決定是否適合進版本紀錄。

延伸閱讀：[開發環境](DEVELOPMENT.md)、[浮動閱讀工具](READING_TOOLS.md)、[Markdown 圖表](MARKDOWN_CHARTS.md)、[系列文章](ARTICLE_SERIES.md)。
