# 系列文章與長文拆分

[返回文件索引](README.md)

## 設計原則

文章沒有固定字數顯示上限，也不會達到字數後自動切檔或插入下一頁。按章節拆分可以改善編輯與閱讀，但應由作者決定分段邊界。正文意外中斷時，先確認原稿與 [開發更新排查](DEVELOPMENT.md)。

同一資料夾方便管理圖片與 Markdown，但資料夾名稱、檔名不決定系列順序；使用 frontmatter 明確宣告。一般文章不必設定系列欄位。

## 目錄與 metadata

```text
src/content/posts/my-series/
├── index.md
├── chapter-01.md
├── chapter-02.md
└── cover.webp
```

導讀 `index.md`：

```yaml
---
title: 我的系列導讀
published: 2026-09-25
description: 本系列的主題與章節說明
series: my-series
seriesTitle: 我的系列
seriesOrder: 0
---
```

第一章：

```yaml
---
title: 第一章：開始之前
published: 2026-09-25
series: my-series
seriesOrder: 1
---
```

`series` 與 `seriesOrder` 必須一起出現。順序為非負整數，同系列不能重複，必須有 `seriesOrder: 0` 導讀；章節從 1 起，可留號碼間隔。`seriesTitle` 可在導讀設定，作為導覽名稱。

章節未完成時可使用既有的 `draft: true`。正式建置會排除草稿，因此要發佈章節時，導讀也必須已發佈，不能只留下草稿導讀。

## 顯示與導覽

文章上方顯示系列名稱、章節清單與目前位置，下方提供導讀、上一篇／下一篇；第一章與最後一章有邊界處理。系列文章不再顯示一般日期順序的上一篇／下一篇。

首頁列表只顯示系列導讀，章節仍各有自己的路由，仍會出現在 archive、標籤或 RSS 等既有入口；目前不是所有列表都按系列折疊。連結使用專案的 URL helper，沿用 alias／permalink 規則。

## 維護入口

| 檔案 | 負責內容 |
| --- | --- |
| [content.config.ts](../src/content.config.ts) | 欄位 schema、Markdown loader |
| [series-utils.ts](../src/utils/series-utils.ts) | 分組、排序、重號與導讀檢查 |
| [content-utils.ts](../src/utils/content-utils.ts) | 一般文章排序及導覽資料 |
| [SeriesNavigation.astro](../src/components/misc/SeriesNavigation.astro) | 系列導覽及深淺色、手機樣式 |
| [首頁](../src/pages/[...page].astro) | 排除獨立章節卡片 |
| [文章路由](../src/pages/posts/[...slug].astro)／[permalink 路由](../src/pages/[permalink].astro) | 上下導覽的掛載位置 |

拆分原稿時保留備份，檢查正文是否完整、圖片相對路徑是否仍成立，以及舊網址是否需保留為導讀。檔案名稱變更可能改變網址，排序欄位本身不會替舊網址建立轉址。
