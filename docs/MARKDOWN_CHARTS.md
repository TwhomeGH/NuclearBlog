# Markdown 圖表：Mermaid 與 ECharts

[返回文件索引](README.md)

## 選擇圖表

| 需求 | 使用方式 |
| --- | --- |
| 流程圖、關係圖、簡單趨勢示意 | `mermaid` 程式碼區塊 |
| 點選資料、查看數值、切換資料系列 | `echarts` 程式碼區塊，內容使用 JSON |

## Mermaid 範例

````markdown
```mermaid
xychart-beta
  title "每週練習次數"
  x-axis [第一週, 第二週, 第三週, 第四週]
  y-axis "次數" 0 --> 10
  line [2, 4, 3, 7]
```
````

圖表初始配合文章寬度顯示且位置鎖定。工具列可放大、縮小、解除鎖定與重設；解除鎖定後可拖曳，即使縮放為 100% 也可移動。重設會恢復適合寬度並鎖定位置，避免一般閱讀時誤拖。

目前 Mermaid 轉成 SVG 圖片顯示，因此圖中的資料點沒有 ECharts 那種數值互動。Mermaid 執行庫仍由外部 CDN 載入；載入失敗時也要檢查網路。

## ECharts 範例

````markdown
```echarts
{
  "title": {
    "text": "每週練習次數",
    "subtext": "概念示意，非實測數據",
    "left": "center"
  },
  "legend": {},
  "xAxis": { "type": "category", "data": ["第一週", "第二週", "第三週", "第四週"] },
  "yAxis": { "type": "value", "name": "次數" },
  "series": [
    { "name": "練習", "type": "line", "data": [2, 4, 3, 7] }
  ]
}
```
````

JSON 必須是物件，並包含非空的 `series` 陣列。使用雙引號，不可含註解、尾端逗號或 JavaScript 函式；此解析器不執行程式碼。長條圖可把 `type` 改成 `bar`，堆疊圖則讓相關系列使用相同的 `stack` 字串。

移入或點選資料點可查看數值，點擊會把該位置各系列數值留在圖表下方；點圖例切換系列。對單一分類 x 軸（`xAxis.data`）可聚焦圖表後使用左右方向鍵，Escape 隱藏提示。複雜 dataset、多座標軸等配置可能仍能繪製，但底部選取文字與鍵盤瀏覽目前以此基本資料結構為主。

圖表預設固定，沒有整張畫布拖曳或 dataZoom。需要數值互動不必先「解除鎖定」，那是 Mermaid 的圖片操作。

## 標題、副標題與間距

一般單一 title／legend／grid 配置會根據實際標題與副標題高度，安排圖例及繪圖區；窄螢幕標題可換行，圖例預設可捲動。建議先省略 `legend.top` 與 `grid.top`，不要靠插入空白或換行推開圖表。

若提供數字形式的 top，系統會保留避免重疊的最小距離，必要時增加圖表高度。字串形式（例如 `"25%"`）的位置，以及 title／legend／grid 陣列，視為作者自訂配置，需自行檢查各種螢幕大小。`title.subtext` 適合放簡短說明，較長的解讀請放在圖表外的正文。

## 程式入口

- [astro.config.mjs](../astro.config.mjs)：註冊 Markdown 插件。
- [remark-echarts.mjs](../src/plugins/remark-echarts.mjs)：將 fenced JSON 轉為 `interactive-chart` 元素。
- [echarts-runtime.ts](../src/scripts/echarts-runtime.ts)：延後載入本站 ECharts、解析、繪圖、點選、主題與大小更新。
- [echarts.css](../src/styles/echarts.css)：容器高度、操作提示、選取結果排版。
- [mermaid-render-script.js](../src/plugins/mermaid-render-script.js) 與 [markdown-extend.styl](../src/styles/markdown-extend.styl)：Mermaid 圖片與工具列互動。

ECharts 元素在移出頁面時會釋放圖表與 observer；新插入元素會自動初始化。修改後檢查切頁返回、深淺色、手機點選、標題換行與錯誤 JSON；單一圖表錯誤應留在該容器，不影響正文。
