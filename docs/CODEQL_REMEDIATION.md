# CodeQL 修正记录

本文档记录 CodeQL 扫描后已经处理的告警，以及对应的调整方式。后续若继续修复 CodeQL finding，优先更新这里，其他文档只保留链接，避免同一份清单在多处重复维护。

## 使用方式

- 想了解为什么项目加入 CodeQL，可以先看 [部署指南 - CodeQL 隐性问题排查保障](./DEPLOYMENT.md#codeql-隐性问题排查保障)。
- 想查看近期具体修了哪些告警，以本文档为准。
- 若 CodeQL 再出现新的告警，建议先确认它来自源码、构建产物还是第三方库，再决定修正、忽略或调整扫描范围。

## 近期修正

| 类型 | 位置 | 处理方式 |
|------|------|----------|
| Insecure randomness | `src/plugins/rehype-component-github-card.mjs` | GitHub Card DOM id 从 `Math.random()` 改为模块内递增计数器 |
| Insecure randomness | `src/plugins/rehype-mermaid.mjs` | Mermaid 容器 id 从随机值改为递增计数器 |
| DOM text reinterpreted as HTML | `src/plugins/mermaid-render-script.js` | 移除 `innerHTML`、`DOMParser.parseFromString`，改用 `createElement`、`textContent` 与 SVG Blob 图片渲染 |
| Mermaid SVG 安全边界 | `src/plugins/mermaid-render-script.js` | Mermaid `securityLevel` 从 `loose` 调整为 `strict` |
| Inefficient regular expression | `scripts/compress-fonts.js` | 字符串字面量收集从多段复杂正则改为单趟扫描器 |
| Insecure randomness | `scripts/compress-fonts.js` | Bangumi 详情抽样从 `Math.random()` 改为固定比例抽样 |
| Replacement of a substring with itself | `scripts/update-bilibili.mjs` | Bilibili 描述清理改为明确处理字面量 `\\u003c` / `\\u003e`，并统一压缩空白 |
| Shell command built from environment values | `scripts/sync-content.js` | Git 命令从 shell 字符串改为 `execFileSync` 参数数组，并限制 `CONTENT_DIR` 必须位于项目根目录内 |
| File data in outbound network request | `scripts/update-bilibili.mjs` | 从配置读取的 `vmid` 先限制为数字 ID，再通过固定 Bilibili API URL 与 `URLSearchParams` 组装请求 |
| File data in outbound network request | `scripts/update-bangumi.mjs` | 从配置读取的 `userId` 与 API 返回的 `subjectId` 先验证格式，再通过固定 Bangumi API URL 组装请求 |
| File data in outbound network request | `scripts/compress-fonts.js` | Meting/Bangumi 字体字集补充请求加入参数验证、HTTPS 检查与固定 Bangumi API URL builder |
| File data in outbound network request | `scripts/indexnow-submit.js` | IndexNow host/key 加入格式验证，sitemap URL 必须解析后确认属于指定 host 才会提交 |

## 维护原则

- 优先修源码里的真实风险，不为了消除告警牺牲原有功能。
- 对只是生成临时 id、抽样或排序的场景，避免使用 `Math.random()`，优先使用递增计数器或可重现的固定策略。
- 涉及外部输入、环境变量或命令执行时，避免拼接 shell 字符串，优先使用参数数组和明确的路径限制。
- 涉及配置文件数据进入网络请求时，先验证格式并使用固定 API host 与 `URLSearchParams` 组装 URL。
- 涉及 DOM 插入时，避免把字符串重新解释为 HTML，优先使用 `createElement`、`textContent`、属性赋值或经过明确边界处理的资源形式。
