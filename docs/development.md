# 开发与验证

当前在 apps/momo 维护 Core 接入网页，使用 pnpm 10.33.0、Node 26.11.1、原 Vite 7。根目录转发命令；应用有独立 workspace 与锁文件。Electron 已删除，ron 暂缓。

Windows 可用根目录 node_modules/.bin/pnpm.cmd；系统 Node 22 启动 pnpm 可能显示 engine 警告，pnpm --dir apps/momo exec node --version 核对实际脚本运行时。

| 根目录命令 | 用途 |
| --- | --- |
| pnpm setup | 安装应用依赖 |
| pnpm dev | 网页与同源 API，127.0.0.1:1212 |
| pnpm typecheck | 原参照代码与活动产品严格类型检查 |
| pnpm check:web | Electron 清理边界检查 |
| pnpm test:product | Core 契约、空间、参数、SSE 与 Web HTTP 安全/取消测试 |
| pnpm test:product:resources | 隔离真实 Core + Web HTTP + 离线模型：角色、参数、提示词和真实生成 |
| pnpm test:product:spaces | 隔离真实 Core：空间资产迁移、删除和持久化 |
| pnpm build | dist/web 浏览器产物 + dist/host 服务产物 |
| pnpm preview | 生产资源与同一 API 宿主，默认 1212 |

真实 Core 测试要求环境变量 MOMO_CORE_SERVER 指向已编译的 32c2088d96b93d2d985950c5898fbe556f373d24 momo-server。测试自行创建临时数据/宿主目录、随机端口和离线模型，不读取本机用户配置。测试结束停止自己的进程。

浏览器隔离验收：先 pnpm build，再在应用目录设置上述 MOMO_CORE_SERVER 并运行 pnpm exec tsx test/product/resources.integration.ts --browser。它运行真实集成测试后保留隔离 Core、fixture 模型和生产 preview 12209；用 http://127.0.0.1:12209/ 检查参数组保存、Enter/Shift+Enter、历史刷新。Ctrl+C 结束测试并停止这些服务，不影响日常 1212 和用户 Core。

原 test:roleplay、test:settings、test:brand 继续为保留的旧源码提供回归；通过不能替代活动 Core 产品验收。应用目录还有 check:shared-boundaries、check:packages。按变更范围运行类型、相关测试、边界与生产构建，不自动运行付费供应商测试。

每次任务在所属仓库提交，保留用户改动；本轮只修改 Web 与 App 迁回记录，不修改 Core/ron。不得提交私有数据、数据库、日志、密钥或构建产物，不自动推送/发布。
