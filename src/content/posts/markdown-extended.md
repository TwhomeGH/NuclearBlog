---
title: Markdown 擴充功能
published: 2024-05-01
updated: 2024-11-29
description: 'Mizuki 支援的 Markdown 擴充功能示範'
image: ''
tags: [Demo, Example, Markdown, Mizuki]
category: 'Examples'
draft: false
---

## GitHub 專案卡片

你可以加入連到 GitHub 專案的動態卡片，載入頁面時會從 GitHub API 取得專案資訊。

::github{repo="matsuzaka-yuki/Mizuki"}

用 `::github{repo="matsuzaka-yuki/Mizuki"}` 這段語法建立 GitHub 專案卡片。

```markdown
::github{repo="matsuzaka-yuki/Mizuki"}
```

## 提示框（Admonitions）

支援以下幾種提示框：`note` `tip` `important` `warning` `caution`

:::note
提醒使用者即使快速瀏覽也應留意的資訊。
:::

:::tip
有助於使用者更順利完成操作的補充資訊。
:::

:::important
使用者要成功完成操作所不可或缺的關鍵資訊。
:::

:::warning
需要使用者立即注意、可能帶來風險的重要內容。
:::

:::caution
某個操作可能造成的負面後果。
:::

### 基本語法

```markdown
:::note
提醒使用者即使快速瀏覽也應留意的資訊。
:::

:::tip
有助於使用者更順利完成操作的補充資訊。
:::
```

### 自訂標題

提示框的標題可以自訂。

:::note[我的自訂標題]
這是一個帶有自訂標題的提示框。
:::

```markdown
:::note[我的自訂標題]
這是一個帶有自訂標題的提示框。
:::
```

### GitHub 語法

> [!TIP]
> 也支援 [GitHub 的提示語法](https://github.com/orgs/community/discussions/16925)。

```
> [!NOTE]
> 也支援 GitHub 的提示語法。

> [!TIP]
> 也支援 GitHub 的提示語法。
```

### 劇透（Spoiler）

你可以在文字中加入劇透，內容同樣支援 **Markdown** 語法。

被藏起來的內容 :spoiler[是 **ayyy**]!

```markdown
被藏起來的內容 :spoiler[是 **ayyy**]!
```

## 影片

用 `::video` 指令嵌入影片，**所有參數必須寫在同一行**。

**本地檔案（建議）**：把影片放在文章旁，用相對路徑引用。建置時會複製並依內容雜湊成 `/media/<檔名>.<hash>.mp4`，以長效 immutable 快取與 HTTP Range 提供；只有檔案內容改變時 URL 才會變，所以會一直快取到你真的替換它為止：

```markdown
::video[Demo Clip]{ src="./clip.mp4" controls=true muted=true width="100%" height="468px"}
```

**外部 URL**：不會被改寫，快取與 Range 支援完全取決於對方主機：

::video[External Demo Clip]{ src="https://coffee3322.ccwu.cc/api/s/xf1q1s/VID_20260505_212018.mp4" controls=true muted=true width="100%" height="468px"}
