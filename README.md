# MOMO

基于 [Chatbox](https://github.com/chatboxai/chatbox) 源码的紫色角色对话应用。当前源码位于 apps/momo；旧 Remix + assistant-ui 原型保存在 legacy/ui-prototype。

应用内标识是无描边的重叠双圆；Windows 应用与任务栏使用用户提供的蓝紫毛玻璃图标。不添加装饰性动画。

## 开发

使用 pnpm **10.33.0**，apps/momo 的开发运行时锁定 Node.js **26.11.1**。应用的 devEngines.runtime 允许 pnpm 自动提供运行时；根目录启动器支持系统 Node 22.20+，不覆盖系统 Node。

依次运行：

```sh
pnpm install
pnpm setup
pnpm dev
```

dev 启动 Electron 热更新。只调试画面时运行 pnpm dev:web，打开 http://127.0.0.1:1212/。Web 预览不包含桌面文件、托盘与本地工具能力。

如果全局 pnpm 是其他版本，首次用 `npx --yes pnpm@10.33.0 install`，之后 Windows 可用仓库内固定版本：`./node_modules/.bin/pnpm.cmd setup`、`./node_modules/.bin/pnpm.cmd dev`。本机已完成安装。用 `./node_modules/.bin/pnpm.cmd --dir apps/momo exec node --version` 检查应用运行时。

```sh
pnpm typecheck
pnpm test:brand
pnpm build
pnpm desktop
pnpm package
```

desktop 启动生产构建；package 在完成 build 后生成 Windows x64 目录包：apps/momo/release/build/win-unpacked/MOMO.exe，整个目录必须一起分发。未配置签名、发布和自动更新。

界面只保留对话、角色和设置。支持本地角色设定、头像与背景、手动故事记忆、回复重试、对话分支、新篇章、归档，以及自定义 API 和本地模型连接。

服务商列表初始为空。进入设置 → 服务商 → 添加 → 添加自定义服务商，选择 API 协议，再自行填写地址、可选密钥与模型 ID。仅提供 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages、Google Gemini 协议适配，不内置任何服务商地址、推荐模型或兼容配置。获取模型只访问填写的地址。

模型参数是独立设置页，管理温度、Top P、最大输出 Token 数、上下文消息上限和流式输出，用于新对话。最大输出 Token 数默认显示 0，表示不指定应用层输出上限，使用 API 默认值；手动填写正数才指定上限。没有全局默认对话模型；对话中手动选择模型，新对话可沿用上次仍有效的自定义模型。已有对话保持各自参数，退休的内置服务商记录需要手动重新配置。

界面语言仅保留简体中文、繁体中文、日语、韩语和英文。其他语言的历史偏好回退为英文；角色内容与聊天正文不自动翻译。

不提供账号登录、Chatbox 授权与订阅、在线角色市场、内置云模型、联网搜索、画图、知识库、MCP、技能与工作模式。相关入口和后台初始化已停用；部分上游类型与源码仅保留历史数据兼容，不代表可用功能。

新安装不写入示例对话。已有安装首次升级时，根据原始 ID、标题和消息摘要识别未修改的文本示例，先保留本地备份再移除；续写、改名、修改设定或含附件的对话保留。真实聊天和自建角色不会批量删除。

默认使用独立的 %APPDATA%/MOMO-Chatbox 数据目录，不读取原 Chatbox 数据；上游统计和自动更新关闭，网络边界阻断 Chatbox 服务域名。

- [来源、许可和定制范围](UPSTREAM.md)
- [当前架构](docs/architecture.md)
- [开发约定](docs/development.md)
- [源码接入决策](docs/decisions/0003-chatbox-fork.md)
- [角色对话精简决策](docs/decisions/0004-roleplay-scope.md)
- [自定义连接与语言范围](docs/decisions/0005-custom-providers.md)
- [GPL-3.0 许可证](LICENSE)
