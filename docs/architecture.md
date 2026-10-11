# 架构

MOMO Web 的浏览器界面通过同源 API 服务连接 MOMO Core。Core 管理角色、消息、长期记忆、NSG、MO State、提示词与运行策略；网页不复制业务数据库或推理流程。

## 代码结构

- `apps/momo/src/renderer/index.html`、`product-entry.tsx`：网页入口。
- `src/product/ui/web`：React 页面、主题和组件。
- `src/product/features`：对话流和个人空间交互。
- `src/product/contracts`：外部数据运行时校验与类型。
- `src/product/routes/api.*`：有限业务 HTTP 处理器。
- `src/product/lib/server`：Core 客户端、SQLite 配置和 Node HTTP 转接；服务端模块使用 `.server.ts` 边界。
- `scripts/product-host-plugin.ts`：开发和生产预览的同源 API 适配。
- `dist/web` 与 `dist/host`：分别构建的浏览器资源与服务模块，不提交源码仓库。

UI 使用 React、TypeScript 和 TanStack Router，构建使用 Vite。页面主体控件由 Mantine 提供；Sidebar 的抽屉使用 MUI SwipeableDrawer，store 中的 ThemeProvider 和 CssBaseline 提供 MUI 主题适配与全局样式重置。这不代表整套界面采用 Material Design 视觉规范。

对话入口是 `src/product/features/chat/Chat.tsx`，通过 Core SSE 控制器处理回复，使用 react-markdown 和 remark-gfm 渲染消息；当前应用依赖及对话入口未接入 assistant-ui。共享组件及其依赖位于 renderer、shared 和 packages；产品以 product-entry 为入口。

## 请求与数据

浏览器 → 同源白名单 API → Core 原生 HTTP/SSE。Core 地址、密钥和配置目录不进入浏览器构建。宿主只接受 loopback Host，拒绝跨源写入，要求 JSON 和同源 Origin，并按个人空间校验资源归属。不存在任意 URL、文件路径或命令代理。

Core 保存角色与对话等业务资产；Web 的 SQLite 保存个人空间目录、模型参数组和幂等请求快照。模型账号由 Core HTTP 宿主管理，密钥不回显。浏览器仅保存界面偏好与装饰资源。

对话 SSE 保留增量、终态、取消、断流和重试语义；重试复用首次请求的模型及参数快照，不能重复保存用户消息。关闭流式时，Core 的完整响应被转成同一终态表示。

记忆与 NSG 的正文、授权和 revision 一起提交 Core；过期修改返回冲突。MO State 管理读取有界快照及实际回复审计，不在 UI 评估规则或生成状态。

MOC 由宿主生成临时路径、流式下载后清理；浏览器不能指定文件系统路径，密码不持久化。快速选择和细选映射到同一个 Core 导出计划。

“关于”页的网页版本直接读取应用 package.json，Core 版本来自当前连接的 health 响应；不可用时不展示缓存的旧版本。

当前 Core 的 `core_version` 来自编译时 Cargo 包版本。RC6 的包版本仍为 `1.0.0`，预发布标识仅存在于发布标签中，因此仅凭 health 响应无法区分 RC6 与正式版。“关于”页展示的是服务报告值，不代表已识别发布渠道。完整发布版本的嵌入及查询列为 Core 下一次发布的[待实现要求](https://github.com/ppisky/MOMO-core/blob/main/docs/release_version_metadata.md)；客户端不得根据网页配套版本或最新标签替运行中的服务猜测版本。

运行版本见[配套版本](sources/runtime-combination.json)，具体功能语义见[产品边界](product-boundaries.md)。
