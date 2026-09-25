# 浮動目錄與音樂播放器

[返回文件索引](README.md)

## 使用方式

目錄預設位於右下角，收合時顯示「目錄」與閱讀進度。展開後可跳至章節並標示目前章節；頁面往下捲動仍能使用。點擊外部或按 Escape 可收合。

音樂播放器預設位於左下角，可縮成只有專輯封面的圓形按鈕。點封面重新展開，收合不會停止播放。展開播放器或目錄會收合另一個閱讀工具，減少畫面遮擋。

使用拖曳把手調整位置；播放器只剩封面時也能拖動封面。位置保存在目前瀏覽器的 localStorage，重開頁面會沿用，視窗大小改變時限制在可見範圍。把手可使用方向鍵移動，Shift 加方向鍵微調，Home 或重設按鈕回到預設位置。

## 設定與維護入口

| 項目 | 檔案 | 負責內容 |
| --- | --- | --- |
| 啟用與預設模式 | [config.ts](../src/config.ts) | `siteConfig.toc`、`musicPlayerConfig` |
| 全域掛載 | [Layout.astro](../src/layouts/Layout.astro) | 閱讀工具掛載位置、播放器 hydration |
| 目錄 | [FloatingTOC.astro](../src/components/control/FloatingTOC.astro) | 標題掃描、章節追蹤、進度、收合 |
| 播放器 | [MusicPlayer.svelte](../src/components/widget/MusicPlayer.svelte) | 音樂狀態、封面、迷你／展開視圖 |
| 共用移動行為 | [floating-panel.ts](../src/utils/floating-panel.ts) | 指標捕捉、邊界、鍵盤、位置持久化 |

浮動目錄由 Layout 在目錄啟用時掛載；不要再於文章模板重複加入。新增閱讀工具時，沿用共用移動行為與 `reading-tool:open` 事件協調收合，避免拖曳放開時誤觸點擊。

## 修改後檢查

確認桌機與窄螢幕均能展開、收合、移動、重設，縮小視窗後仍可操作；重整後位置保留，封面拖曳不會意外展開。確認切換文章、解密後的章節會更新，目錄操作不會中斷音樂。
