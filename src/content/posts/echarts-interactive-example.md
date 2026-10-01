---
title: "ECharts 互動圖表：點選折線資料看數值"
published: 2026-09-25
description: "可實際點選、查看數值與切換圖例的 Markdown 互動折線圖，附完整語法與維護說明。"
tags: [Markdown, ECharts, Example]
category: 專案維護
lang: zh-TW
draft: false
---

## 直接操作這張圖

滑鼠移到折線上可查看數值；平板可點一下資料點。點選後，下方會保留所選日期與兩組數值。點「本週／上週」圖例可以隱藏或顯示該系列。

圖表固定在文章內，不會因拖曳而移動位置。鍵盤使用者可聚焦圖表，再按左右方向鍵查看不同日期；Escape 關閉提示。

```echarts
{
  "title": {
    "text": "每週文章瀏覽量",
    "left": "center"
  },
  "xAxis": {
    "type": "category",
    "data": [
      "週一",
      "週二",
      "週三",
      "週四",
      "週五",
      "週六",
      "週日"
    ]
  },
  "yAxis": {
    "type": "value",
    "name": "瀏覽次數"
  },
  "series": [
    {
      "name": "本週",
      "type": "line",
      "data": [
        120,
        180,
        150,
        260,
        310,
        420,
        380
      ]
    },
    {
      "name": "上週",
      "type": "line",
      "data": [
        90,
        140,
        170,
        220,
        280,
        330,
        350
      ]
    }
  ]
}
```

## Markdown 語法

將以下整段貼進 `.md` 文章。語言標記使用 `echarts`，內容是標準 JSON，不是 JavaScript：鍵名與文字必須使用雙引號，不可有註解、函式或結尾多餘逗號。

````markdown
```echarts
{
  "title": {
    "text": "每週文章瀏覽量",
    "left": "center"
  },
  "xAxis": {
    "type": "category",
    "data": [
      "週一",
      "週二",
      "週三",
      "週四",
      "週五",
      "週六",
      "週日"
    ]
  },
  "yAxis": {
    "type": "value",
    "name": "瀏覽次數"
  },
  "series": [
    {
      "name": "本週",
      "type": "line",
      "data": [
        120,
        180,
        150,
        260,
        310,
        420,
        380
      ]
    },
    {
      "name": "上週",
      "type": "line",
      "data": [
        90,
        140,
        170,
        220,
        280,
        330,
        350
      ]
    }
  ]
}
```
````

- `title.text`：圖表標題。
- `xAxis.data`：依序排列的分類標籤。
- `series`：每個物件代表一條線；`name` 會顯示在圖例與提示中。
- `series[].data`：對應分類的數值，數量應與標籤一致。
- `type: "line"`：折線；也可改成 `"bar"` 繪製長條圖。

本站預設補上座標軸提示、圖例與可點選的資料點。可以用 ECharts option 的 JSON 屬性調整外觀，例如 `smooth: true`；不支援 JavaScript formatter 函式。圖表不預設開啟 dataZoom 或拖曳平移。

## 與 Mermaid 如何選擇

需要點選數值、比較資料系列時，使用 `echarts`。流程圖、時序圖、類別圖使用 `mermaid`。Mermaid 圖片上的位置鎖定與解鎖，不等於資料點互動。

[Mermaid 折線圖與鎖定操作範例](/posts/mermaid-line-chart/)

## 維護入口

1. `src/plugins/remark-echarts.mjs`：辨識 Markdown 的 echarts 區塊，產生 `interactive-chart` 元素，將 JSON 保留於 HTML 屬性。
2. `astro.config.mjs`：在 unified 的 remarkPlugins 註冊解析器。
3. `src/scripts/echarts-runtime.ts`：由 Layout 載入，遇到圖表才動態下載 ECharts，建立 SVG 互動圖表；沒有使用 eval 執行文章內容。
4. `src/styles/echarts.css`：圖表高度、響應式寬度與提示文字排版。

ECharts 已安裝在專案，由本站提供資源，內網平板無須另外連到圖表 CDN。切換深淺主題時重新繪圖，容器改變大小時 resize；離開文章時 dispose，避免頁面切換後留下舊實例。解密後插入的圖表也由 custom element 自動初始化。

若 JSON 無效，該圖表會顯示錯誤與重試按鈕，不影響其他圖表。進階語法可參考 [Apache ECharts 官方手冊](https://echarts.apache.org/handbook/en/concepts/axis/)。

## 標題、副標題與圖例間距

`title.subtext` 可加入副標題，例如「概念示意，非實測數據」。一般單一標題／圖例／繪圖區會依文字實際高度安排上方空間；手機標題可換行，圖例預設可捲動切換。

只設定部分 `legend` 或 `grid` 時，其餘預設值仍會保留。數字形式的 `legend.top` 與 `grid.top` 若太小，會提高到不重疊的安全位置；百分比或其他字串定位及多組 title／legend／grid 屬於自訂排版，仍由作者自行配置。

可參考 [第七章的堆疊長條圖](/posts/weightmanagement/chapter-07/)。
