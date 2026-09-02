# 這一版 Mizuki主要額外改動了一些地方


主要是額外支持了 `Video` 組件

你能以以下方式插入視頻

:::video[Demo Clip]{ src="https://coffee3322.ccwu.cc/api/s/xf1q1s/VID_20260505_212018.mp4" controls=true autoplay=false width="100%" height="468px" muted=true}

> [!TIP]
> 注意請確保他所有參數在同一行 而不是換行過後的
>

然後也對 `Image` 組件做了調整

```txt
![ice0 h-344px](./ice0.jpg)
```

他原本只支持對 `width` 進行調整

現在額外支持了高度控制

原本他只支持用 `%`

現在讓他可以用兩種形式

```txt
![ice0 h-100%](./ice0.jpg)
```

## CodeQL 近期修正

近期新增了 CodeQL workflow 作為額外保障，用來協助排查本地 build、lint 或人工檢查不一定會馬上暴露的隱性問題。依照掃描結果，目前主要修正了以下幾類:

- GitHub Card 與 Mermaid 容器的臨時 DOM id 不再使用 `Math.random()`，改成簡單遞增計數器，避免被判定為不安全隨機數。
- Mermaid 渲染腳本不再用 `innerHTML` 或 `DOMParser.parseFromString` 把 SVG 字串重新解讀成 DOM，改用安全的 DOM API 與 SVG Blob 圖片方式渲染。
- Mermaid 的 `securityLevel` 從 `loose` 調整為 `strict`，縮小圖表渲染時允許的 HTML/SVG 能力。
- 字體壓縮腳本中用來收集 JS/TS 字串的複雜正則，改成單趟掃描器，降低正則回溯造成的效能風險。
- Bangumi 詳細資料抽樣從隨機抽樣改成固定比例抽樣，結果更可重現，也避免不必要的安全掃描告警。

更完整的工作流說明與排查方式可以看 [部署指南](./DEPLOYMENT.md#codeql-近期修正记录)。

