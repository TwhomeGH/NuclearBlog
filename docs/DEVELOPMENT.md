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

Corepack 快取損壞或 pnpm 無法啟動時，參閱 [部署指南](DEPLOYMENT.md)，先確認 Node、Corepack 與專案指定版本，避免同時混用不同安裝來源。

## 文章存檔後沒有更新

文章沒有因字數而截斷的限制。先確認正在編輯的檔案、網址與執行中的專案目錄一致，再觀察終端的內容更新訊息。

[內容集合設定](../src/content.config.ts) 的 posts loader 使用 `deferRender: true`，讓 Markdown 在使用時渲染。先前曾出現 loader 已回報更新、頁面仍回傳舊正文的情形；套用後已驗證新增、修改、原子替換、刪除與切頁後修改。不應僅憑此現象判定是 OneDrive 沒有送出檔案事件。

若修改解析插件、集合 schema 或相依套件後仍看到舊結果，停止開發服務，再執行：

```powershell
corepack pnpm dev:refresh
```

此命令使用 `astro dev --force --host 0.0.0.0`。一般寫文章不需要每次重啟；仍有問題時，記錄「檔案事件有沒有出現」與「重新請求是否仍回傳舊內容」，再判斷監看或渲染快取問題。目前沒有全域啟用 polling。

## 驗證與建置

```powershell
corepack pnpm check
corepack pnpm exec astro build
```

上述建置只驗證 Astro。完整發佈流程使用 `corepack pnpm build`，還會執行內容同步、番劇資料更新、Pagefind 與字型壓縮；執行前確認內容同步設定。避免一邊執行檢查／建置、一邊驗證既有開發頁面，重整 Vite 快取可能使舊頁面持有失效的模組網址。

## 升級維護重點

Markdown 插件集中在 [astro.config.mjs](../astro.config.mjs) 的 `markdown.processor: unified(...)`。Tailwind 3 由 [PostCSS 設定](../postcss.config.mjs) 與 [全域入口](../src/styles/tailwind.css) 載入，不再使用舊 Astro Tailwind integration。CI 的 Node 版本與套件升級需要一起檢查。
