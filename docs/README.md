# Mizuki 文档索引

欢迎查阅 Mizuki 的详细文档！

## 🧭 快速导航

| 文档 | 适合什么时候看 | 主要内容 |
|------|----------------|----------|
| [主 README](../README.zh.md) | 第一次了解项目、需要快速启动 | 项目介绍、快速开始、基础配置、常见问题 |
| [補充改動](./OtherFeature.md) | 想知道当前版本额外改了什么 | Video 组件、图片尺寸扩展、近期维护说明 |
| [部署指南](./DEPLOYMENT.md) | 准备上线、构建失败、排查 GitHub Actions | GitHub Pages、Vercel、Netlify、Cloudflare Pages、Corepack/pnpm 排查、CodeQL 保障 |
| [CodeQL 修正记录](./CODEQL_REMEDIATION.md) | 想追踪安全扫描近期修了什么 | CodeQL 告警、处理方式、后续维护原则 |
| [自动构建触发快速参考](./AUTO_BUILD_TRIGGER.md) | 内容更新后没有自动重新部署 | Repository Dispatch 快速配置 |
| [内容分离完整指南](./CONTENT_SEPARATION.md) | 想把文章内容和站点代码拆开维护 | 内容同步、私有仓库、CI/CD、故障排查 |
| [内容仓库结构指南](./CONTENT_REPOSITORY.md) | 正在整理独立内容仓库 | 推荐目录、文章/图片组织、内容编写规范 |
| [内容迁移指南](./MIGRATION_GUIDE.md) | 从单仓库迁移到内容分离模式 | 迁移步骤、验证方法、部署配置 |

## 📚 文档列表


### 這一版的改動部分說明

[**補充改動**](./OtherFeature.md)


### 核心文档

- **[../README.zh.md](../README.zh.md)** - 项目主文档 (简体中文)
  - 快速开始
  - 功能特性
  - 基础配置
  - 常见问题

### 多语言文档

- **[../README.md](../README.md)** - English
- **[../README.ja.md](../README.ja.md)** - 日本語  
- **[../README.tw.md](../README.tw.md)** - 繁體中文

### 内容分离相关

- **[CONTENT_SEPARATION.md](./CONTENT_SEPARATION.md)** - 内容分离完整指南 ⭐
  - ENABLE_CONTENT_SYNC 控制开关
  - 环境变量配置详解
  - 私有仓库配置方法
  - 模式切换指南
  - 故障排查

- **[CONTENT_REPOSITORY.md](./CONTENT_REPOSITORY.md)** - 内容仓库结构指南
  - 推荐的目录结构
  - 文件组织方式
  - 内容编写规范
  - 图片管理建议

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - 内容迁移指南
  - 从单仓库迁移到分离模式
  - 详细迁移步骤
  - 测试验证方法

### 部署相关

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - 部署完整指南 ⭐
  - 各平台部署配置 (GitHub Pages / Vercel / Netlify / Cloudflare Pages)
  - 内容仓库更新自动触发构建
  - 私有仓库认证
  - 故障排查

- **[AUTO_BUILD_TRIGGER.md](./AUTO_BUILD_TRIGGER.md)** - 自动构建触发快速参考 🆕
  - 5 步快速配置，解决内容更新不触发部署的问题

### 安全扫描相关

- **[CODEQL_REMEDIATION.md](./CODEQL_REMEDIATION.md)** - CodeQL 修正记录
  - 近期 CodeQL 告警处理记录
  - 修正方式说明
  - 后续维护原则

## 🚀 快速查找

### 我是新手，想快速开始
→ 阅读 [主 README](../README.zh.md)

### 我想部署博客
→ 阅读 [部署指南](./DEPLOYMENT.md)

### 我想使用内容分离功能
→ 阅读 [内容分离完整指南](./CONTENT_SEPARATION.md)

### 我想从单仓库迁移到分离模式
→ 阅读 [内容迁移指南](./MIGRATION_GUIDE.md)

### 我想配置私有内容仓库
→ 阅读 [内容分离指南 - 私有仓库配置](./CONTENT_SEPARATION.md#-私有仓库配置)

### 我的部署遇到问题
→ 阅读 [部署指南 - 故障排查](./DEPLOYMENT.md#-故障排查)

### 本地 pnpm/build 跑不起来
→ 阅读 [部署指南 - Corepack 与 pnpm 修复](./DEPLOYMENT.md#问题-8-本地-pnpm-或-build-无法启动)

### 想看 CodeQL 最近修了什么
→ 阅读 [CodeQL 修正记录](./CODEQL_REMEDIATION.md)

### 我遇到了内容同步错误
→ 阅读 [内容分离指南 - 故障排查](./CONTENT_SEPARATION.md#-故障排查)

### 内容仓库更新后站点没有自动重新部署 🆕
→ 阅读 [自动构建触发快速参考](./AUTO_BUILD_TRIGGER.md)

## 📖 文档架构

```
docs/
├── README.md                    # 本文档 - 索引导航
├── CONTENT_SEPARATION.md        # 内容分离核心指南
├── CONTENT_REPOSITORY.md        # 内容仓库结构
├── MIGRATION_GUIDE.md           # 迁移指南
├── DEPLOYMENT.md                # 部署完整指南
├── AUTO_BUILD_TRIGGER.md        # 自动构建触发快速参考
├── CODEQL_REMEDIATION.md        # CodeQL 修正记录
├── OtherFeature.md              # 当前版本补充改动
└── image/                       # 文档图片资源
```

## 🎯 文档使用建议

### 新用户推荐阅读顺序

1. [主 README](../README.zh.md) - 了解项目基本情况
2. [部署指南](./DEPLOYMENT.md) - 选择平台并部署
3. (可选) [内容分离指南](./CONTENT_SEPARATION.md) - 高级功能

### 高级用户推荐

- 直接查阅具体主题的文档
- 使用快速查找定位问题解决方案

## 🤝 需要帮助？

- 查看 [GitHub Issues](https://github.com/matsuzaka-yuki/Mizuki/issues)
- 阅读相关文档的故障排查章节
- 运行 `pnpm run check-env` 检查配置

祝你使用愉快！🎉
