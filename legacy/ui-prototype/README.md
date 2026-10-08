# MOMO

基于 Electron + Remix v2 + React + assistant-ui + TypeScript 的桌面 AI 聊天应用。界面参考 Chatbox 的会话布局，使用独立实现与用户提供的蓝紫图标。

当前提供紫色浅色/深色界面、流式演示聊天和 Electron 桌面宿主。**尚未接入真实模型与数据库；对话保存在页面内存中，刷新或退出后清空。**

## 环境与启动

统一使用 pnpm 11.25.0。开发运行时锁定 Node.js **26.11.1**，由 `devEngines.runtime` 自动下载、校验并供 pnpm 脚本使用；`.node-version` 同步记录版本。系统 Node 22.20+ 可作为安装引导，无需覆盖系统 Node。用 `pnpm exec node --version` 检查项目实际运行时，直接运行 `node --version` 仍可能显示系统版本。

```sh
pnpm install
pnpm dev
```

Web 热更新预览：http://127.0.0.1:5173/。

```sh
pnpm build
pnpm desktop
```

桌面窗口加载生产构建，使用 Electron 自带 Node，不依赖系统 Node。修改后需要重新构建再启动。Electron 主进程只管理窗口、服务生命周期和受控复制接口；独立 utilityProcess 承载 Remix 服务。

```sh
pnpm package
```

先运行 `pnpm build`，再打包。Windows x64 便携版输出到 `release/MOMO-win32-x64/MOMO.exe`，整个目录需一起分发。当前没有安装向导、签名和自动更新。

## 已实现

- 会话新建、切换、删除、标题搜索和重命名。
- 建议话题、流式演示回复、停止、重新生成、Markdown 与代码展示、复制。
- 紫色浅色/深色/系统主题，响应式侧栏、键盘焦点、窄屏导航。
- 静态图标与克制的颜色反馈；不使用旋转、弹跳、呼吸或入场位移动画。
- Electron 单实例、沙箱窗口、独立本地服务、随机会话 Cookie、Host/Origin 校验和白名单 IPC。

快捷键：Enter 发送、Shift+Enter 换行、Ctrl/Cmd+K 搜索、Ctrl/Cmd+Shift+O 新建。切换会话时停止当前生成；删除立即生效。主题偏好保存在 localStorage；桌面隔离 session 当前不持久化主题。

UI 通过 `ConversationEngine` 与 `HostAdapter` 注入能力，后续替换桌面运行时或对话内核时保留组件与样式。浏览器和桌面共用 HTTP 对话适配，桌面通过 preload 提供复制。

## 验证命令

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
pnpm build
```

`pnpm start` 是纯 Web 生产预览，需设置 `HOST=127.0.0.1`。它不包含桌面宿主鉴权，不应作为对外部署服务。

## 目录与文档

```text
app/                 React 界面、assistant-ui、Remix 路由和服务
app/platform/        浏览器与桌面宿主适配
shared/contracts/    类型和运行时校验契约
electron/main/       窗口、服务监管、白名单 IPC
electron/preload/    最小桌面 API
server/              本地 HTTP 宿主与访问校验
scripts/             桌面构建和便携版打包
public/brand/        用户提供的品牌图标
tests/               流协议、接口与桌面边界测试
docs/                架构、开发、视觉与决策记录
```

- [架构规范](docs/architecture.md)
- [开发约定](docs/development.md)
- [阶段计划](docs/roadmap.md)
- [UI 与验证记录](docs/ui-preview.md)
- [可替换内核](docs/decisions/0001-ui-and-adapters.md)
- [Chatbox 参考与紫色桌面方案](docs/decisions/0002-purple-desktop.md)
- [仓库工作规则](AGENTS.md)
