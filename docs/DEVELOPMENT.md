# 本機開發與更新排查

[返回文件索引](README.md)

## 環境與啟動

本專案目前使用 Astro 7.3.3、Svelte 5、Node.js 22.12 以上；建議使用 Node.js 24。pnpm 版本由 [package.json](../package.json) 的 `packageManager` 固定為 10.22.0，升級 Node 不會自動升級專案 pnpm。

```powershell
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

`dev` 與 `start` 已綁定 `0.0.0.0`。平板請開啟終端顯示的電腦區網 IP，例如 `http://192.168.0.102:4321/`，IP 以當下輸出為準。`0.0.0.0` 是監聽位址，不能拿來當平板的目的網址；裝置須能互通，Windows 防火牆也須允許該服務。

### 背景 dev server 管理

Astro 7 的 `astro dev` 會以背景 daemon 執行，重複啟動時預設會拒絕並提示「already running」。因此本專案的 `dev`／`start` 會**先停止舊的再啟動**（`astro dev stop && astro dev --host ...`），不會殘留幽靈進程。

常用的管理指令：

| 指令 | 作用 |
| --- | --- |
| `corepack pnpm dev:stop` | 停止背景 dev server |
| `corepack pnpm dev:status` | 查看是否在跑、PID 與位址 |
| `corepack pnpm dev:logs` | 查看日誌 |
| `corepack pnpm dev:logs:follow` | 即時跟隨日誌 |
| `corepack pnpm dev:panel` | 開啟本機網頁控制台 |

`dev:panel` 會啟動一個只綁定 `127.0.0.1` 的小網頁（預設埠 4323，被占用時自動往上找可用埠），提供狀態、啟動、停止、重啟（可清快取）與即時日誌，並自動開啟瀏覽器。關閉面板（Ctrl+C）不會停止 dev server。

Corepack 快取損壞或 pnpm 無法啟動時，參閱 [部署指南](DEPLOYMENT.md)，先確認 Node、Corepack 與專案指定版本，避免同時混用不同安裝來源。

## 文章存檔後沒有更新

文章沒有因字數而截斷的限制。先確認正在編輯的檔案、網址與執行中的專案目錄一致，再觀察終端的內容更新訊息。

[內容集合設定](../src/content.config.ts) 的 posts loader 使用 `deferRender: true`，讓 Markdown 在使用時渲染。先前曾出現 loader 已回報更新、頁面仍回傳舊正文的情形；套用後已驗證新增、修改、原子替換、刪除與切頁後修改。不應僅憑此現象判定是 OneDrive 沒有送出檔案事件。

若修改解析插件、集合 schema 或相依套件後仍看到舊結果，停止開發服務，再執行：

```powershell
corepack pnpm dev:refresh
```

此命令使用 `astro dev stop && astro dev --force --host 0.0.0.0`，會先停掉既有背景 server，再以清快取方式啟動。一般寫文章不需要每次重啟；仍有問題時，記錄「檔案事件有沒有出現」與「重新請求是否仍回傳舊內容」，再判斷監看或渲染快取問題。目前沒有全域啟用 polling。

## 驗證與建置

```powershell
corepack pnpm check
corepack pnpm exec astro build
```

上述建置只驗證 Astro。完整發佈流程使用 `corepack pnpm build`，還會執行內容同步、番劇資料更新、Pagefind 與字型壓縮；執行前確認內容同步設定。避免一邊執行檢查／建置、一邊驗證既有開發頁面，重整 Vite 快取可能使舊頁面持有失效的模組網址。

## 單元測試

核心邏輯的單元測試放在 `Test/`，使用 [Vitest](../vitest.config.ts)：

```powershell
corepack pnpm test        # 跑一次
corepack pnpm test:watch  # 監看模式
```

目前涵蓋純函式與外掛：`src/utils/date-utils`、`url-utils`、`permalink-utils`，以及 `src/plugins/` 的 `rehype-image-width`、`rehype-video-width`、`video-assets`。別名由 `vitest.config.ts` 對齊 `tsconfig.json` 的 paths。

組件與型別檢查由 `corepack pnpm check`（`astro check`）負責。CI 的 [CI.yml](../.github/workflows/CI.yml) 跑檢查與建置，[test.yml](../.github/workflows/test.yml) 跑單元測試，[lint.yml](../.github/workflows/lint.yml) 跑 ESLint 與型別檢查。

## 升級維護重點

Markdown 插件集中在 [astro.config.mjs](../astro.config.mjs) 的 `markdown.processor: unified(...)`。Tailwind 3 由 [PostCSS 設定](../postcss.config.mjs) 與 [全域入口](../src/styles/tailwind.css) 載入，不再使用舊 Astro Tailwind integration。CI 的 Node 版本與套件升級需要一起檢查。

## 本機字型預覽

`LocalFonts.astro` 依 `src/config.ts` 的字型設定產生宣告。`pnpm dev` 直接載入 `public/assets/font/` 的原始 TTF，不必先壓縮；ASCII 字型限制在 `U+0000-007F`，中文由 CJK 字型處理。原始字型較大，首次載入時會先顯示替代字型，再切換至自訂字型。

正式環境中啟用 `enableCompress` 的 TTF 改用 WOFF2 子集。請使用完整 `pnpm build` 產生壓縮檔，再執行 `pnpm preview`；單獨 `astro build` 不包含字型壓縮步驟。更換字型時更新 `fontFamily`、`fontWeight` 與 `localFonts`，不用另改 main.css。

## Clarity 行為分析

Clarity 使用專案 `ytd2zio6uv`，由 `Layout.astro` 手動載入。只有正式建置會輸出載入程式；`pnpm dev` 不載入，正式產物在 localhost／127.0.0.1／IPv6 loopback 預覽也不載入。部署後需到 Clarity 後台確認資料是否收到，程式建置成功不代表後台已驗證。

載入程式會避免重複插入 Clarity script。不要再透過 GTM 或 NPM 安裝同一個 Clarity 追蹤器。此處的環境控制只針對 Clarity，現有 GTM 設定另行管理。

Fork 或部署預覽站點前，請閱讀 [流量統計與 fork 前設定](ANALYTICS.md)，確認追蹤 ID 歸屬、停用方式及預覽環境限制。
