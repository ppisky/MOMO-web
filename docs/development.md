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
| pnpm test:product:resources | 隔离真实 Core + Web HTTP + 离线模型：完整角色/开场、记忆/NSG 原子配置、MO State、MOC、参数/提示词与真实生成 |
| pnpm test:product:spaces | 隔离真实 Core：空间资产迁移、删除和持久化 |
| pnpm build | dist/web 浏览器产物 + dist/host 服务产物 |
| pnpm preview | 生产资源与同一 API 宿主，默认 1212 |
| pnpm demo:parameters | 只展示模型参数的离线演示，预置三类模型，1213 |
| pnpm build:demo:parameters | 独立静态演示产物 dist/model-parameters-demo |
| pnpm preview:demo:parameters | 生产演示，1213；不加载 API 宿主、不连接 Core |

真实 Core 测试要求环境变量 MOMO_CORE_SERVER 指向已编译的 174cba356590fb7a1e8130296afb4c54be53f284 momo-server。测试自行创建临时数据/宿主目录、随机端口和离线模型，不读取本机用户配置。测试结束停止自己的进程。资源联调包含 NSG 向量化的索引、增量复用、维数失败保护与取消，以及后台推荐值/独立覆盖、实际视觉/记忆/NSG 请求、向量 profile、MOC 差量和恢复/重试；对话归档/恢复验证真实列表筛选、重复操作、重命名、空间隔离、历史和资产保持。维护 drain 仅用于隔离测试批次屏障，不向网页开放管理接口。

浏览器隔离验收：先 pnpm build，再在应用目录设置上述 MOMO_CORE_SERVER 并运行 pnpm exec tsx test/product/resources.integration.ts --browser。它运行真实集成测试后保留隔离 Core、fixture 模型和生产 preview 12209；用 http://127.0.0.1:12209/ 检查角色配置与直接新对话、记忆/NSG 保存/归档/恢复、MO State 管理（状态/记录选择、角色侧写查询与重置）及配置和范围 MOC 下载。Ctrl+C 结束测试并停止这些服务，不影响日常 1212 和用户 Core。

原 test:roleplay、test:settings、test:brand 继续为保留的旧源码提供回归；通过不能替代活动 Core 产品验收。应用目录还有 check:shared-boundaries、check:packages。按变更范围运行类型、相关测试、边界与生产构建，不自动运行付费供应商测试。

每次任务在所属仓库提交，保留用户改动；本轮 Web 与必要 Core 能力各自独立提交；App 和 ron 不修改。不得提交私有数据、数据库、日志、密钥或构建产物，不自动推送/发布。
