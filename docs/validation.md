# 网页清理验证记录

日期：2026-10-09。基线：完整源码快照 `5f37630dfbb4d7007ea8b1abddfdce1721b117a9`。本轮只验证原 MOMO-web 移除 Electron 后的网页，不将结果写成 Core 或 ron 完成。

## 工具和静态检查

- pnpm 10.33.0；应用脚本实际 Node v26.11.1，Vite 7.3.6。
- 应用依赖安装完成；`pnpm install --frozen-lockfile --ignore-scripts` 复查锁一致，通过。Electron、electron-vite、electron-builder、webpack 及旧 release/app workspace 已移出依赖锁。
- `pnpm check`：严格 TypeScript 通过。
- `pnpm check:packages`：chatbox-core、chatbox-react 类型通过。
- `pnpm check:web`、`pnpm check:shared-boundaries`：通过。
- 修改涉及的 12 个源文件/配置执行 Biome check：无错误，仍有 6 项警告；没有宣称全仓 lint 无警告。
- `pnpm build`：生产构建通过，产物在 apps/momo/dist/web；构建模块图检查未发现 Electron/main/preload 依赖。

构建仍报告原有 store 包 eval、动态/静态混合导入和大 chunk 警告，主 chunk 约 8.45 MB（gzip 2.70 MB），首次加载体积仍待优化。依赖树的 React/Zod peer 和翻译工具 engine 警告保留，本轮未通过升级整个框架掩盖它们。

## 回归测试

两组共 21 个测试文件、211 项测试通过：

- 7 文件 / 64 项：浏览器初始化、请求与取消/错误、MCP 原生传输拒绝、主题、SessionService、会话行归档及归档列表。
- 14 文件 / 147 项：MOMO 产品边界、角色/记忆、初始数据、模型配置、协议路径和语言等现有回归。

旧桌面存储与 IPC stdio 用例随桌面实现删除，改为浏览器初始化/传输检查。上游全量测试及真实供应商 live 测试未执行。

## 实际浏览器操作

开发网页运行在 `http://127.0.0.1:1212/`，确认原有角色和会话可显示，未修改这些既有数据。生产构建另用 `12209` 端口与独立 IndexedDB 验收，模型端点使用仓库本地 fixture（步骤见 [开发文档](development.md#隔离浏览器验收)）。

1. 从原设置页添加 OpenAI Chat Completions 自定义服务商，地址为本地 fixture，留空密钥；获取并添加模型成功。
2. 从原角色页创建测试角色，填写简介与人物设定，从角色进入对话并选择模型。
3. 发送后显示完整 SSE 回复；刷新会话深层 URL 后，同一用户消息与助手回复各保留一次。
4. 会话行点击归档，侧栏隐藏会话；设置的归档列表可见该项，恢复后回到侧栏，历史仍在。
5. 恢复后 Enter 发送第二轮，收到回复。fixture 记录的第二轮聊天请求角色序列为 system、user、assistant、user，包含上一轮上下文。
6. 生产设置深层 URL `/settings/model-parameters` 可直接打开。验收过程中控制台未出现 error。

验收截图保存在本机忽略目录 `.cache/web-browser-smoke.jpg`，仅含合成测试内容，不提交到 Git。测试服务和生产验收预览结束后停止，原开发网页继续提供给用户。

## 尚未完成

- 原网页尚未接入 MOMO-core，仍使用原 Chatbox 业务与浏览器存储。
- Core 完整角色字段、真实开场白、独立记忆/NSG、空间和模型参数组尚未在原网页落实；快捷键及最大输出零值说明等旧行为仍待按已确认规则调整。
- 没有测试付费/外部模型、所有附件格式、所有设备和浏览器，也没有重做完整产品验收。
- App、Core、ron 代码本轮未修改；App 只同步暂停和返回原仓库的文档。
