# 影片與圖片：載入、快取與尺寸

[返回文件索引](README.md)

本站的影片與圖片都採「內容雜湊檔名 + 長效快取」，並由主機支援 HTTP Range 分段請求。撰寫時只要使用相對路徑，其餘（雜湊、複製、標頭）由建置流程自動處理。

## 影片：`::video` 指令

語法必須寫在**同一行**，參數不可換行：

```md
::video[示範片段]{ src="./clip.mp4" controls=true autoplay=false muted=true width="100%" height="468px"}
```

| 參數 | 說明 | 預設 |
| --- | --- | --- |
| `src` | 影片來源。相對路徑＝本地檔；`http(s)://`、`//`、`/` 開頭＝外部或 `public/` 路徑 | 必填 |
| `controls` | 顯示播放控制列 | `true` |
| `autoplay` | 自動播放（多數瀏覽器要求同時 `muted=true` 才允許） | `false` |
| `loop` | 循環播放 | `false` |
| `muted` | 靜音 | `false` |
| `preload` | 預載策略；預設只抓檔頭，按播放才分段抓取 | `metadata` |
| `poster` | 封面圖 URL | 無 |
| `width` / `height` | 外框尺寸 | `100%` / `150px` |

### 本地影片（建議）

把影片檔和文章放在同一個資料夾，用相對路徑引用：

```md
::video[除霜示範]{ src="./VID_20260505_212018.mp4" controls=true muted=true width="100%" height="468px"}
```

建置時會依**檔案內容**計算 `sha256` 短雜湊，輸出成 `/media/<檔名>.<hash>.<副檔名>`。因此：

- 內容不變 → URL 不變 → 瀏覽器永久快取（`Cache-Control: public, max-age=31536000, immutable`），不再重複下載。
- 內容改變 → 檔名（hash）改變 → 自動失效，不需要手動清快取。
- 同源提供，`Accept-Ranges: bytes` 可用，`<video>` 播放／拖曳即自動用分段請求。
- `preload="metadata"` 讓初次載入只抓檔頭，不會一次抓完整個檔案。

開發時由中介層提供 `/media/*`（支援 Range）；建置時複製到 `dist/media/`。相關標頭見 [vercel.json](../vercel.json) 與 [public/_headers](../public/_headers)。

### 外部影片

`src` 以 `http(s)://`、`//` 或 `/` 開頭時，外掛**不會改寫**，直接沿用該 URL：

```md
::video[外部示範]{ src="https://example.com/clip.mp4" controls=true}
```

外部影片的快取與 Range 完全取決於對方主機：

- 若對方回傳 `ETag`／`Last-Modified` → 未變更時只回 304，不會重抓。
- 若對方只有短 `max-age` 且沒有驗證器（ETag/Last-Modified）→ 快取過期後會**整個檔案重抓**。
- 本站先前用的外部分享站就是後者（`max-age=3600`、無驗證器），所以 3.9MB 會反覆重載。

除非對方是可信的 CDN（長快取 + ETag + 支援 Range），否則建議改用本地影片，交給本站的雜湊與快取機制處理。

## 圖片：尺寸與響應式

圖片沿用 `alt` 尾綴控制尺寸：

```txt
![ice0 h-344px](./ice0.jpg)
![ice4 w-50%](./ice4.jpg)
```

`w-` / `h-` 支援 `%` 與 `px`；會套用到圖片顯示尺寸。

本站已開啟 Astro 響應式圖片（`layout: "constrained"`），Markdown 圖片會自動產生 `srcset`，並依實測欄寬注入 `sizes`：

- 單張：`(min-width: 1024px) 720px, (min-width: 768px) 560px, 100vw`
- 並排多張（同一段落多個 `![...]`）：`(min-width: 1024px) 360px, (min-width: 768px) 280px, 50vw`

瀏覽器因此只下載接近實際顯示寬度的版本，而非原圖（例如 4080px）。圖片本體一樣輸出到 `_astro/*`，內容雜湊 + immutable 快取，且 `_astro/*` 快取由主機標頭保證。

## 程式入口

- [src/plugins/video-assets.mjs](../src/plugins/video-assets.mjs)：remark 改寫相對影片路徑、影片雜湊、開發中介層（Range）與建置複製。
- [src/plugins/rehype-video-width.mjs](../src/plugins/rehype-video-width.mjs)：影片外框尺寸與 `w-xx%`。
- [src/plugins/rehype-video-component.mjs](../src/plugins/rehype-video-component.mjs)：`<video>` 屬性正規化（`preload`、`playsinline`、布林值）。
- [src/plugins/rehype-image-width.mjs](../src/plugins/rehype-image-width.mjs)：圖片尺寸與 `sizes` 注入。
- [astro.config.mjs](../astro.config.mjs)：註冊外掛、`image.layout` 與 `breakpoints`。
- [vercel.json](../vercel.json)、[public/_headers](../public/_headers)：`/media/*` 與 `/_astro/*` 長快取標頭。

## 維護注意

- `::video` 的參數必須同一行，換行會解析失敗。
- 不要把 rehype-components 的元件 key 設成與回傳的同名標籤（例如 `video` 回傳 `<video>`），會無限迴圈；影片屬性因此由 `rehype-video-width` 呼叫 `VideoComponent` 處理。
- 改動 `astro.config.mjs` 的 `image` 設定會使既有圖片快取失效，下次 build 會重新產生所有圖片尺寸（一次性）。
- 若使用[內容分離](CONTENT_SEPARATION.md)模式，本地影片要放在內容倉庫的 `posts/` 對應文章資料夾內；`public/videos/` 是另一條路徑（相簿／公開資源），不經過雜湊。
