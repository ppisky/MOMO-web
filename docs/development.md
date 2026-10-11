# 开发与验证

使用 pnpm 10.33.0。应用脚本由 pnpm 提供 Node 26.11.1；通过 `pnpm --dir apps/momo exec node --version` 核对运行版本。初次安装使用根目录与应用目录的 `pnpm install --frozen-lockfile`。

| 命令 | 用途 |
| --- | --- |
| pnpm dev | 网页与同源 API，127.0.0.1:1212 |
| pnpm typecheck | TypeScript 严格检查 |
| pnpm check:web | 浏览器、依赖与服务端边界 |
| pnpm test:product | 契约、参数、空间、SSE、HTTP 安全与取消 |
| pnpm test:product:resources | 真实 Core 角色、记忆、NSG、MO State、MOC 和生成联调 |
| pnpm test:product:spaces | 真实 Core 空间迁移、删除和持久化 |
| pnpm build | 浏览器与 API 宿主生产构建 |
| pnpm preview | 运行生产构建，默认 1212 |

集成测试需要 `MOMO_CORE_SERVER` 指向已编译的配套 momo-server，版本见[运行组合](sources/runtime-combination.json)。测试使用自己的临时目录、随机端口和离线模型，完成后停止测试进程，不读取用户配置。

浏览器联调可在构建后，从应用目录运行 `pnpm exec tsx test/product/resources.integration.ts --browser`。它保留隔离测试服务供检查，Ctrl+C 结束。测试夹具只用于验证，不提供独立演示站或产品发布入口。

按修改范围执行类型、相关测试、边界与生产构建。文档修改检查链接及 `git diff --check`。不得提交密钥、私人角色/对话、数据库、日志、环境文件、构建产物或开发专用演示站。

## 发布

发布范围是正式源码、构建与测试脚本、使用说明、接口规范和许可。个人开发记录、原型和本机工具配置不属于发行内容。新增文件先检查 `git diff --cached`，确认来源与必要性。

网页版本以 `apps/momo/package.json` 为准，“关于”页自动读取；Core 版本从运行服务获取，两者不互相冒用版本号。两个仓库分别提交与发布。
