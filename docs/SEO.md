# SEO 與搜尋收錄

[返回文件索引](README.md)

## 網站目前如何產生搜尋資訊

Astro 在建置時產生正文 HTML。`Layout.astro` 統一輸出頁面標題、description、canonical 與 Open Graph／Twitter 分享標記；正式網域取自 `src/config.ts` 的 `siteConfig.siteURL`，不使用本地或預覽主機名稱。

首頁摘要使用站點副標題；一般頁面可透過版型的 `description` 傳入摘要。文章則共用 `src/utils/post-seo.ts`：

- 優先使用文章 frontmatter 的 `description`，沒有才從正文產生最多 160 個字元加省略號的備用摘要，排除程式碼與圖片標記。這是本站預設，不是搜尋引擎的硬性字數限制。
- canonical 使用 `getPostUrl()` 決定的主要網址，移除查詢參數與頁內錨點。別名與舊文章路徑會指向同一個主要網址。
- 輸出 `BlogPosting` JSON-LD，包含作者、語言、發布／更新時間、主要網址，以及可解析的封面圖片。JSON 中的 `<` 會跳脫，避免內容中出現 `</script>` 時截斷標記。
- 有封面時提供絕對網址的 `og:image` 和 `twitter:image`；本地圖片使用 Astro 產生的資源網址。沒有封面也未開啟 `generateOgImages` 時不虛構圖片。

## 撰寫文章時怎麼設定

```yaml
title: 文章標題
description: 用一兩句話說明文章解決什麼問題，以及讀者可以得到什麼。
published: 2026-10-08
updated: 2026-10-09
image: ./cover.png
author: 核音
draft: false
```

`updated` 應反映實質內容更新，不要為了 SEO 每次建置都改成當天。分享圖片可以使用文章旁的本地圖片、`public` 下以 `/` 開頭的路徑，或完整 HTTPS 網址。自動摘要只是備用，正式文章建議手寫。

## Robots、sitemap 與排除

`src/pages/robots.txt.ts` 允許搜尋引擎爬取網站與必要樣式、腳本、圖片，並列出 `sitemap-index.xml`。不要用封鎖所有路徑再放行文章的方式，否則會連呈現文章所需資源一起封鎖。

`src/plugins/seo-sitemap.mjs` 在 HTML 建置完成後檢查每頁的 head，再交給 sitemap 套件產生 XML：

- 只加入具有 canonical、且 canonical 與該頁網址一致的 HTML 頁面。
- 排除 `noindex` 頁面與重複文章路徑。
- 文章的 `lastmod` 取自 JSON-LD 的 `dateModified`，不使用建置時間。

正式建置原有流程會排除草稿；本地可見的草稿仍標記 `noindex`。加密文章與 404 也標記 `noindex, follow`，不進 sitemap。加密文章 SEO 摘要固定為「此文章受密碼保護。」，不輸出文章 JSON-LD 或生成分享圖片。

`noindex` 是搜尋收錄指示，不是存取控制或加密保證。本文描述的排除涵蓋 SEO 中繼資料、sitemap 與生成分享圖片；RSS、站內搜尋等其他輸出仍有自己的內容處理流程。

## 部署後確認

1. 開啟 `/robots.txt`、`/sitemap-index.xml` 與其中列出的 sitemap。
2. 查看文章原始碼，確認 canonical 使用正式網域，摘要與作者正確，JSON-LD 可解析。
3. 在 Google Search Console 驗證網站並提交 sitemap，使用網址檢查及結構化資料驗證工具確認實際收錄狀態。
4. 網站有 IndexNow 提交腳本，但建置不代表已提交，也不保證任何搜尋引擎收錄。

參考：[Google sitemap 說明](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[摘要說明](https://developers.google.com/search/docs/appearance/snippet)、[結構化資料說明](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)。
