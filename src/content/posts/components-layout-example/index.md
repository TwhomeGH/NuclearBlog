---
title: "Example：組件與前端排版維護指南"
published: 2026-09-23
description: "從文章內容、全域版面到側欄組件，說明 NuclearBlog 的修改入口，並示範浮動目錄、音樂播放器及新增組件的維護方式。"
tags: ["Example", "Astro", "組件", "前端維護"]
category: "專案維護"
lang: "zh-TW"
draft: false
---

這篇文章同時是維護指南與長文章測試頁。可以往下捲動，使用角落的「目錄」跳到任一章節，再試著收合、移動音樂播放器，確認閱讀時不會被工具遮住。

本文描述的是這個專案的實際檔案結構。`PostPage.astro` 的名字容易誤會：它負責文章列表，不是單篇文章內文。

## 先分清楚：內容、組件與版面

| 類別 | 負責什麼 | 常見修改 |
| --- | --- | --- |
| 文章內容 | Markdown 文字、圖片、標題與 metadata | 寫文章、增加章節、插入表格 |
| 組件 | 可重複使用的一個介面或功能 | 目錄、音樂、文章卡片、公告 |
| 前端版面 | 決定組件擺在哪裡、寬度與斷點 | 左右側欄、主欄、橫幅、固定工具 |
| 全域設定 | 功能開關與資料 | 網站名稱、目錄層數、音樂來源、側欄排序 |
| 建置設定 | Astro 整合與 Markdown 處理流程 | 註冊 remark／rehype 外掛、Svelte 與 CSS 處理 |

:::tip
只想改文字或組件順序，先看 `src/config.ts`。想改位置，再看 layouts。想改組件內部互動，最後才進入 components。
:::

### 網頁的組合關係

```text
src/pages/                         路由入口
  └─ MainGridLayout.astro          橫幅、網格、側欄、main
       └─ Layout.astro             HTML、head、主題、全域工具
            ├─ 頁面 slot          各路由傳入的內容
            ├─ FloatingTOC        常駐角落目錄
            ├─ MusicPlayer        常駐音樂播放器
            └─ Pio                看板娘
```

這是組合關係，不是檔案所在目錄。`MainGridLayout.astro` 使用 `Layout.astro` 包住它的內容；`Layout.astro` 內的 `<slot />` 接收整個主版面。

## 常用檔案對照表

| 檔案 | 用途 |
| --- | --- |
| `src/config.ts` | 網站設定、目錄、音樂、側欄排列 |
| `src/types/config.ts` | 設定與組件種類的 TypeScript 型別 |
| `src/layouts/Layout.astro` | HTML 外殼、主題、字型、全域常駐組件 |
| `src/layouts/MainGridLayout.astro` | 頂部橫幅、主內容網格、側欄與頁尾 |
| `src/components/Navbar.astro` | 導覽列 |
| `src/components/widget/SideBar.astro` | 左側欄，以及手機／平板的組件選擇 |
| `src/components/layout/RightSideBar.astro` | 右側欄組件渲染 |
| `src/utils/widget-manager.ts` | 根據裝置、位置與設定挑選組件 |
| `src/components/PostPage.astro` | 文章列表及卡片／列表排列 |
| `src/components/PostCard.astro` | 單張文章卡片 |
| `src/pages/posts/[...slug].astro` | 一般文章路由、metadata 與內文組合 |
| `src/pages/[permalink].astro` | 自訂固定網址的文章路由 |
| `src/components/misc/Markdown.astro` | Markdown 內容外框及相關行為 |
| `src/content.config.ts` | 文章 schema、檔案載入規則 |
| `astro.config.mjs` | Astro 整合與 Markdown 外掛註冊 |
| `postcss.config.mjs` | Tailwind 3、巢狀 CSS、autoprefixer |
| `src/styles/tailwind.css` | 全域 Tailwind 基礎樣式入口 |

維護文章版面時，記得一般 slug 與 permalink 是不同路由。不要只修改其中一個，就認為所有文章都已套用。

## 閱讀工具：隨時可用的目錄

浮動目錄由 `src/components/control/FloatingTOC.astro` 提供，掛在 `Layout.astro`。它從目前文章的 `#post-container` 讀取帶有 `id` 的標題；沒有文章或沒有標題時會隱藏。

### 如何操作

- 右下角的「目錄」按鈕可展開或收合章節列表。
- 點章節會跳到標題上方，預留導覽列的空間，並更新網址的 hash。
- 閱讀位置會反映在目前章節的高亮，以及按鈕上的進度百分比。
- 清單很長時只捲動目錄面板，不需要回到文章頂端。
- 點面板外部或按 Escape 可收合；Escape 後焦點回到目錄按鈕。
- 拖曳點狀把手可移動。鍵盤使用者可聚焦把手，以方向鍵移動、Shift 加方向鍵細調、Home 重設。

### 設定層數與顯示模式

在 `src/config.ts` 的 `siteConfig.toc` 修改：

```ts
toc: {
  enable: true,
  mode: "float",
  depth: 2,
  useJapaneseBadge: true,
},
```

`enable` 是總開關。`mode: "float"` 使用角落入口；保留的 `sidebar` 模式還可以顯示原本的大螢幕側邊目錄，而角落入口仍然可用。

浮動目錄的 `depth` 是相對於文章中最淺的標題層級。例如文章從 `##` 開始，`depth: 2` 會列出 `##` 與 `###`。數字改大後，長文章的清單也會更長。

`useJapaneseBadge` 控制最上層標題使用片假名或數字標記。

### 為什麼不要放在會移動的內容容器內

`position: fixed` 不代表在任何父容器中都會固定於視窗。父層的 `transform`、`filter` 或某些 containment 設定會改變定位基準。固定工具應放在全域外殼，避免跟著文章進場動畫、側欄網格或內容容器一起移動。

本專案使用 Swup 換頁，文章區域可能被替換但全域工具保留。目錄因此必須重新讀取新文章；事件和 observer 也必須在組件移除時清理，不能每次換頁都多綁一組捲動事件。

## 音樂播放器：收合不等於停止播放

`src/components/widget/MusicPlayer.svelte` 是有瀏覽器互動狀態的 Svelte 組件，由 `Layout.astro` 使用 `client:idle` 載入。

### 三種顯示狀態

| 狀態 | 適合什麼情境 |
| --- | --- |
| 專輯封面 | 只顯示 56px 圓形封面，點擊展開、拖曳移動 |
| 迷你播放器 | 看歌名、控制播放，再展開完整介面 |
| 完整播放器 | 調整進度、音量、循環及播放列表 |

首次進入時預設收合在左下角。收合只隱藏介面，不卸載 `<audio>`，因此不會因收納而停止播放。播放器會記住收合狀態與位置；播放時間不保證跨重新整理保存。

開啟目錄時，播放器會自動收合；開啟播放器時，目錄會收合，避免兩塊面板互相遮住。音訊不受影響。

展開時使用獨立拖曳把手；收合時直接拖曳專輯封面，移動超過 6px 後會攔截該次點擊，避免放開時誤展開。播放列表跟著播放器移動，不再獨立固定在畫面另一角。

### 播放器收合為專輯封面

播放器工具列的「收合」會將介面縮成只有 56px 的圓形專輯封面，播放不會中斷。直接拖曳封面可移動，點擊則展開；拖曳放開不會誤觸展開。封面亦支援方向鍵移動、Home 重設位置，以及 Enter／空白鍵展開。

### 修改音樂來源

`src/config.ts` 的 `musicPlayerConfig` 管理 `enable`、`mode`、Meting API、`id`、`server` 與 `type`。現有的本地播放清單則位於 `MusicPlayer.svelte` 的 `localPlaylist`。

外部音源是否可播放仍取決於服務回應、CORS 與瀏覽器播放限制。調整版面不應改變這些來源設定，也不應為了收合介面而建立第二個播放器實例。

:::important
播放器已由全域 `Layout.astro` 掛載。不要再把相同播放器加入側欄，否則可能出現多個 audio 實例、重複下載與播放控制衝突。
:::

## 共用的浮動面板控制器

`src/utils/floating-panel.ts` 供目錄與音樂共用：

- 只從 `data-floating-drag` 把手開始移動，支援滑鼠與觸控。
- `data-floating-reset` 按鈕回到預設角落。
- 位置以可移動範圍的比例保存，而非只記住某個螢幕的像素座標。
- 視窗尺寸或面板大小改變後重新限制位置，避免展開、旋轉螢幕後跑到畫面外。
- localStorage 不可用或資料損壞時回到預設值。
- `destroy()` 清理監聽器、ResizeObserver 與待執行的動畫影格。

Svelte 組件可直接使用 action：

```svelte
<script lang="ts">
  import { floatingPanel } from "../../utils/floating-panel";
</script>

<div class="my-panel" use:floatingPanel={{ key: "my-panel-position-v1", side: "right" }}>
  <button data-floating-drag aria-label="移動面板">移動</button>
  <button data-floating-reset>重設位置</button>
  <p>組件內容</p>
</div>

<style>
  .my-panel { position: fixed; max-width: calc(100vw - 32px); }
  [data-floating-drag] { touch-action: none; }
</style>
```

每個不同工具使用不同的儲存 key。Astro 自訂元素可在 `connectedCallback()` 呼叫 `floatingPanel()`，並在 `disconnectedCallback()` 呼叫回傳物件的 `destroy()`。

## 新增側欄組件：ReadingTip 範例

下面示範新增一張靜態閱讀提示卡片。這段程式碼是教學範例，並未自動將卡片加入現有側欄。

### 第一步：建立組件

新增 `src/components/widget/ReadingTip.astro`：

```astro
---
interface Props {
  class?: string;
  style?: string;
}
const { class: className, style } = Astro.props;
---
<section class:list={["card-base p-4", className]} style={style}>
  <h2 class="font-bold mb-2">閱讀小提示</h2>
  <p>使用角落目錄可以快速切換章節。</p>
</section>
```

`class` 與 `style` 要傳到外框，側欄管理器提供的動畫或響應式設定才會生效。可重複掛載的組件避免寫死相同 `id`。

### 第二步：登記型別與映射

1. 在 `src/types/config.ts` 的 `WidgetComponentType` 加入 `"reading-tip"`。
2. 在 `src/utils/widget-manager.ts` 的 `WIDGET_COMPONENT_MAP` 加入對應檔案路徑。
3. 在 `SideBar.astro` 和 `RightSideBar.astro` 匯入 `ReadingTip`，並在兩份 `componentMap` 加入 `"reading-tip": ReadingTip`。

目前渲染器使用明確的 import 映射。只在 `WIDGET_COMPONENT_MAP` 加路徑，或只填一個 `custom` 設定，不會自動載入新組件。

### 第三步：加入側欄設定

在 `src/config.ts` 的 `sidebarLayoutConfig.properties` 新增：

```ts
{
  type: "reading-tip",
  position: "sticky",
  animationDelay: 100,
},
```

再將 `"reading-tip"` 放到需要的位置，例如 `components.left` 或 `components.drawer`。陣列順序就是組件順序；`properties` 描述的是該組件的設定。

`position: "top"` 指側欄上方的一般內容區，不是固定在視窗頂部。`sticky` 會受父容器高度及 overflow 限制，也不能取代真正的全域浮動工具。

### 如果新組件需要互動

Astro 組件的 `<script>` 可以處理簡單 DOM 行為。狀態較多時可寫 Svelte，並在掛載位置明確使用 `client:load`、`client:idle` 或 `client:visible`。

目前側欄動態映射渲染的是 `<Component {...props} />`。把 Svelte 組件加入映射不會自動取得 hydration 指令；需要為互動組件增加明確的渲染分支。全域常駐工具可參考 `Layout.astro` 中的播放器掛載方式。

## 改排版時應該改哪裡

### 主欄、側欄與斷點

先看 `sidebarLayoutConfig.components` 與 `responsive.breakpoints`，再看 `MainGridLayout.astro` 的網格及 sidebar class。

Tailwind 的 `md`／`lg` 在 `tailwind.config.cjs` 定義，目前分別是 768px 與 1280px。部分組件還有獨立的 CSS media query；改斷點時需要一起搜尋，不能只改一份設定。

### 文章內文與列表卡片

文章段落、表格、程式碼區塊等視覺設定集中在 `src/styles/markdown.css`、`markdown-extend.styl`、`expressive-code.css`，以及 `Markdown.astro`。

列表卡片看 `PostCard.astro`，整體列表／網格看 `PostPage.astro`。修改單篇文章的標題、作者、分享與授權位置，則看兩個文章路由。

### 全域 CSS 與層級

Tailwind 由 `postcss.config.mjs` 處理，`Layout.astro` 明確匯入 `src/styles/tailwind.css`。新增一份樣式檔並不等於瀏覽器一定會載入，要檢查實際 import。

浮動閱讀工具目前使用 z-index 70。新增對話框、抽屜或遮罩時，應一起檢查 Navbar、看板娘、回到頂部及閱讀工具，避免只能看到卻點不到的介面。

## Markdown 組件與外掛入口

本文使用標準 Markdown 的標題、表格、程式碼區塊及提示框。目錄依賴標題 ID，`rehype-slug` 與 heading anchor 相關設定在 `astro.config.mjs`。

目前 Astro 7 的 Markdown 使用 `@astrojs/markdown-remark` 的 `unified()` 處理器。新增語法時通常會涉及：

1. `src/plugins/` 中的 remark 或 rehype 外掛。
2. `astro.config.mjs` 的 `unified({ remarkPlugins, rehypePlugins })` 註冊。
3. 對應的全域 CSS 或瀏覽器腳本。
4. 一篇能實際測試新語法的 example 文章。

若需要在文章中直接 import Svelte／Astro 組件，不能直接假設 `.md` 支援。本專案目前的文章 loader 只讀取 `**/*.md`；要引入 MDX，需要另外整合 MDX、修改 loader 並驗證建置。

## 維護完成後的驗證清單

```sh
corepack pnpm check
corepack pnpm build
corepack pnpm dev
```

`dev` 預設監聽 `0.0.0.0`。平板需與電腦在相同區域網路，瀏覽「電腦的區域網路 IP:4321」，而不是平板自己的 localhost。IP 可能隨網路重新分配，請以當次伺服器顯示為準。

建議每次修改閱讀工具都測試：

- 桌機、平板直向／橫向，以及窄螢幕。
- 文章頂部、中段、底部都能打開目錄與跳轉。
- 首頁進文章、文章換文章、返回上一頁後，目錄屬於目前文章。
- 拖曳不會誤觸播放；播放中收合不會中斷音訊。
- 移到邊緣後展開、縮小視窗或旋轉平板，工具仍在可見範圍。
- 重新整理保留工具位置；重設位置可恢復預設角落。
- Tab、Enter、方向鍵、Home、Escape 可以完成基本操作。
- 淺色／深色主題下文字和焦點都看得清楚。

### 最後一個章節：長文章跳轉測試

如果你已經捲到這裡，現在打開角落目錄，跳回「先分清楚：內容、組件與版面」。目錄入口應持續留在你設定的位置，不需要回到文章最上方才能找到。

## 長文拆章與系列導覽

同一系列使用相同 `series`，以 `seriesOrder` 的數字排序。`index.md` 使用 0 作導讀與系列入口；章節由 1 開始。檔名可自由命名，排序不依賴檔名。每份檔案仍要有 title、published 等正常文章欄位。

```yaml
series: weight-management
seriesOrder: 0
seriesTitle: 權重管理
```

章節改用 `seriesOrder: 1`、`2` 等；`seriesTitle` 設在導讀即可。新增章節會自動進入目錄與上下章導覽。缺少導讀、重複順序或只填一個系列欄位會報錯，避免默默產生錯誤排序。

維護入口：`src/content.config.ts` 定義欄位，`src/utils/series-utils.ts` 驗證分組，`src/components/misc/SeriesNavigation.astro` 顯示目錄及上下章，兩種文章路由都使用此組件。

首頁只列導讀，不重複列出各章；歸檔、分類及搜尋仍可找到各章。一般文章的上下篇導覽不會插入系列章節。系列使用現有網址產生工具，因此 alias 與 permalink 設定仍有效。正式建置不列 draft 章節。

拆分由作者選擇章節邊界，不依字數截斷或自動改寫正文。參考 `WeightManagement/` 的實際七章範例。

## 開發時文章沒有更新怎麼檢查

修改正文後，先確認終端是否出現 `Reloaded data from ...`，再完整重新整理該文章。若原稿有內容但伺服器輸出的 HTML 沒有，先檢查內容快取，不要認定是字數上限。

修改 `src/content.config.ts` 的 schema 或 remark／rehype 渲染程式時，既有內容可能仍保留先前解析的結果。可執行：

```sh
corepack pnpm dev:refresh
```

這個指令以 `--force` 清除 Astro 內容快取並替換目前的開發服務，仍綁定 `0.0.0.0`。它不會刪除或改寫文章。一般寫文章仍使用 `corepack pnpm dev`。

本次在目前 Windows／OneDrive 工作目錄測試新增、等長修改、原子儲存與刪除，檔案事件可正常送達；但已讀文章修改後曾出現 `Reloaded data` 而頁面仍顯示舊正文。文章集合已改用 `glob({ ..., deferRender: true })`，讓正文透過 Vite 的 Markdown 模組重新渲染，而不是沿用內容集合的預渲染結果。修改後已驗證伺服器與站內返回文章皆顯示新正文，無須手動重啟。

目前沒有足夠證據認定 OneDrive 是原因，因此沒有全面啟用輪詢監看。若修改 schema 或渲染外掛後仍看到舊結果，可再使用 `dev:refresh`。
