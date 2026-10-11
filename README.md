# MOMO Web

[English](README.en.md)

MOMO 是一个面向角色与故事的 AI 对话应用，支持长期记忆、叙事语义网、MO State 和个人空间。

[源码](https://github.com/ppisky/MOMO-web) · [MOMO Core](https://github.com/ppisky/MOMO-core) · [问题反馈](https://github.com/ppisky/MOMO-web/issues)

## 功能

- 角色配置、默认助手、开场白、流式对话、归档与恢复。
- 独立的记忆和语义网页面，编辑内容、关系和注入范围。
- MO State 状态管理、处理记录、回复注入审计和角色侧写。
- 个人空间创建、切换和资产迁移；MOC 按范围导出，支持密码加密。
- 模型服务商、对话参数组、视觉与向量化用途配置，支持 OpenAI Chat Completions 和 Responses。
- 提示词编辑与恢复默认；中文、繁体中文、英文、日文、韩文界面。

当前尚未提供配置包导入恢复、对话删除/分支/篇章及完整 NSG 治理审批界面，详见[产品边界](docs/product-boundaries.md)。

## 运行

先按[配套运行指南](docs/core-integration.md)启动 MOMO Core **v1.0.0-rc.6**。使用 **pnpm 10.33.0**；应用脚本的 Node **26.11.1** 由 pnpm 管理。

```sh
git clone https://github.com/ppisky/MOMO-web.git
cd MOMO-web
pnpm install --frozen-lockfile
pnpm --dir apps/momo install --frozen-lockfile
```

复制 `apps/momo/.env.example` 为 `apps/momo/.env.local`，设置 `MOMO_CORE_ORIGIN`（默认 `http://127.0.0.1:8765`）和持久化目录 `MOMO_APP_DATA_DIR`，然后运行：

```sh
pnpm dev
```

打开 **http://127.0.0.1:1212/**，在设置中添加模型服务商。生产构建使用 `pnpm build`，运行 `pnpm preview`。网页需要同源 API 服务，不能只托管静态文件。目前面向本机使用，未提供公网账户认证。

升级时先停止服务、备份数据，并沿用原 Core 与网页数据目录。“关于”页自动显示网页包版本及已连接 Core 的版本。

## 文档与许可

[架构](docs/architecture.md) · [开发](docs/development.md) · [功能边界](docs/product-boundaries.md) · [后续计划](docs/roadmap.md)

源码采用 [GPL-3.0](LICENSE)。MOMO 双圆图标及简化版采用 [CC BY-SA 4.0](public/brand/README.md)。第三方项目及署名见[致谢](UPSTREAM.md)。
