# MOMO Web

基于 [Chatbox](https://github.com/chatboxai/chatbox) 源码的紫色角色对话网页，活动源码在 `apps/momo`。2026-10-09 按用户决定回到本仓库，移除 Electron，先调好原网页；MOMO-app 开发与 ron 兼容暂缓。沿用原来的页面和业务操作。

## 运行

使用 pnpm **10.33.0**。应用运行时锁定 Node.js **26.11.1**，由 pnpm 的 devEngines.runtime 提供；根目录启动器支持系统 Node 22.20+。

```sh
pnpm install
pnpm setup
pnpm dev
```

打开 http://127.0.0.1:1212/。dev 直接启动原网页，不需要 Electron。若全局 pnpm 版本不同，首次用 `npx --yes pnpm@10.33.0 install`，之后 Windows 可用 `./node_modules/.bin/pnpm.cmd` 执行上述命令。

```sh
pnpm typecheck
pnpm check:web
pnpm test:roleplay
pnpm test:settings
pnpm build
pnpm preview
```

生产文件输出到 `apps/momo/dist/web`。preview 同样监听 127.0.0.1:1212，先停止占用该端口的 dev。静态服务器需对页面路由回退到 index.html，按根目录部署。桌面启动、安装包、自动更新和 Electron 依赖已删除。

## 当前能力和边界

保留原版角色、头像与背景、手动故事记忆、聊天、重试、分支、新篇章、归档/恢复和自定义 API 连接。语言保留简体中文、繁体中文、日语、韩语和英文。

服务商列表初始为空，在设置中添加自定义服务商、协议、地址、可选密钥和模型 ID。浏览器直接请求所填地址，服务端须允许当前网页来源的 CORS。不提供公共转发代理，不向 Chatbox 发送模型凭据。保留 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages、Google Gemini 协议适配；真实供应商按各服务单独验证。

当前网页沿用 Chatbox 业务服务和浏览器 IndexedDB，**尚未接入 MOMO-core**。数据随网页 origin（协议、主机、端口）隔离，不读取 Electron 的本地数据目录，也不新增旧桌面数据导入。现有网页数据保留。

Core 角色完整字段与真实开场白、独立记忆/NSG、空间、参数组及固定 Enter/Shift+Enter 规则仍须逐项落实。原页现有的参数零值说明、会话参数副本和快捷键设置是待调整项；开场白参与真实历史和上下文的决定不再待确认。

账号、订阅、在线角色市场、内置云模型、搜索、画图、知识库、MCP、技能和工作模式仍停用。残留上游类型或组件不代表可用能力，本地命令/stdio 不会伪装成浏览器功能。

- [当前架构](docs/architecture.md)
- [开发和验收](docs/development.md)
- [网页优先决定与产品边界](docs/decisions/0006-web-first.md)
- [验证记录](docs/validation.md)
- [后续计划](docs/roadmap.md)
- [来源和定制范围](UPSTREAM.md)
- [GPL-3.0 许可证](LICENSE)
