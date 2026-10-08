# 开发与验证

当前源码在 apps/momo，使用 pnpm 10.33.0、Node 26.11.1、Electron 44.7.0。根目录 package.json 只转发命令；应用拥有自己的 workspace 与锁文件。旧原型不参与构建。

根目录只安装固定版 pnpm，支持系统 Node 22.20+；实际应用脚本由 apps/momo 的 runtime 约束使用 Node 26。Windows 可执行 `./node_modules/.bin/pnpm.cmd`，避免全局 pnpm 11 的自动安装行为混用依赖存储。

| 根目录命令 | 用途 |
| --- | --- |
| pnpm setup | 安装完整应用依赖 |
| pnpm dev | Electron 热更新 |
| pnpm dev:web | 127.0.0.1:1212 画面预览 |
| pnpm typecheck | 生成路由并检查 TypeScript |
| pnpm test:brand | 本次主题相关测试 |
| pnpm test:roleplay | 角色对话边界、迁移与记忆相关测试 |
| pnpm test:settings | 自定义连接、参数、协议路径与五种语言测试 |
| pnpm test | 上游默认测试集 |
| pnpm lint | 上游 Biome lint |
| pnpm build | main、preload、renderer 生产构建 |
| pnpm desktop | 启动生产构建 |
| pnpm package | Windows x64 目录包，先运行 build |

不要擅自运行 live model-provider 测试或使用真实密钥。按变更执行类型、相关测试、lint 和构建；修改打包时验证产物启动。区分成功、失败与未验证，旧版 19 项测试不适用于当前源码。

保持紫色布局与角色对话主线；新增输入使用运行时校验，系统能力沿用明确的 preload/IPC 接口，不新增任意执行通道。不要重新接入登录、Chatbox 在线业务或工作工具，也不要把旧原型框架规则误套到当前实现。

相关验证使用 test:roleplay；上游全量测试包含被移除能力的断言，尚未整体裁剪，不能作为 MOMO 全功能通过的声明。真实供应商与翻译脚本需要单独验证。

模型配置验证使用 test:settings，并可通过独立测试数据目录与本地模拟 API 检查手动添加、模型获取、零值采样、输出限制和流式回复。不要使用真实密钥。五种语言需检查设置、首页与角色文案；其他语言不应重新出现在翻译工具配置中。

桌面冒烟可用 --user-data-dir 指向忽略的临时目录。打包依赖删除前验证绝对路径并拒绝链接目录，保留生产锁一致性检查。不得提交真实数据、密钥、日志或构建产物。

package:dir 使用已安装并校验的 Electron 分发目录，避免 electron-builder 重复下载。beforePack 优先通过调用方 npm_execpath 运行固定 pnpm CLI，避免 Windows 嵌套命令包装器的路径问题。生产包尚未签名。

Git 不自动推送或改写历史。源码基准与许可见 [UPSTREAM.md](../UPSTREAM.md)，未来上游合并保留品牌修改与原作者信息。
