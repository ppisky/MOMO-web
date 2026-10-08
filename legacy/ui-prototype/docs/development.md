# 开发约定

状态：已落地 Web UI 与基本 Electron 宿主。实际可用命令以 README 与 package.json 为准。`pnpm dev` 启动 Web 热更新；`pnpm desktop` 启动已构建桌面窗口；`pnpm package` 生成 Windows 便携版。自动化 `test:e2e` 尚未提供。

## 1. 工程组织

先采用单仓库、单 package.json，通过目录和导入边界划分职责，不提前拆成多个工作区包。

```text
electron/
  main/                   # 桌面生命周期、服务监管、凭据与系统接口
  preload/                # contextBridge 与窄接口
server/                   # 本地 HTTP 宿主、鉴权、Remix 请求接入
app/
  routes/                 # Remix 页面与资源路由
  components/             # 可复用 React 组件
  features/chat/          # assistant-ui 组件组合与 runtime 适配
  services/               # *.server.ts：聊天服务与模型适配
  repositories/           # *.server.ts：存储与数据访问
  styles/                 # 全局样式与设计变量
shared/
  contracts/              # IPC、HTTP、流式事件和领域数据契约
tests/                    # 跨模块集成与端到端测试
docs/                     # 项目规范与决策记录
```

这是目标目录，不要求提前创建空目录。当前额外使用 `app/platform/` 保存宿主适配，路由是能力注入组合入口。Remix route 模块允许框架规定的 loader/action 与组件组合，其他服务端能力必须在服务端模块内隔离。Electron 构建入口与 Web 客户端入口分开。Web 与桌面分别使用 tsconfig.json 和 tsconfig.desktop.json。

依赖方向：界面 → 客户端适配层 → 公共契约；路由 → 服务 → 数据访问/模型适配。公共契约不依赖 Electron、React 或服务端实现。主进程与服务进程通过契约通信，不互相导入启动入口。

## 2. 语言与类型

- 业务代码统一使用 TypeScript，启用 `strict`、`noUncheckedIndexedAccess` 和 `exactOptionalPropertyTypes`；各运行环境使用独立 tsconfig 并共享基础配置。
- 外部输入先作为 `unknown`，经 schema 校验收窄；不使用 `any` 或双重断言绕过边界。
- `import type` 区分类型导入；公共接口明确输入、输出和错误类型。
- 通信采用可序列化数据，不跨 IPC 传递回调、运行时对象或 SDK 客户端。
- React 组件使用 PascalCase，hooks 使用 `use` 前缀；服务端文件使用 `.server.ts`。Remix 路由命名遵循其约定。
- 注释解释必要原因与约束，避免重复描述代码行为。

## 3. UI 与状态

- React 负责渲染，assistant-ui 负责聊天交互和消息运行时；优先组合其组件与适配器。
- 会话历史由服务端持久化，runtime 是当前客户端视图；不要再添加独立 store 镜像同一消息列表。
- 首版明确处理空状态、连接未配置、生成中、取消、失败、历史加载与服务不可用。
- 输入、发送、停止、重试和会话切换支持键盘操作、可访问名称与明确焦点反馈。
- 不在组件中直接访问供应商 SDK、数据库或凭据。
- 视觉风格在 UI 阶段单独确定，本轮不预设额外组件库和设计体系。

## 4. 依赖与构建

- 默认使用 pnpm，只保留一份 `pnpm-lock.yaml`。在 package.json 中固定 packageManager，并声明经过验证的 Node.js 范围。
- 不使用 `create-remix@latest` 等未验证脚手架命令改变架构基线。先核对依赖兼容性，再锁定版本。
- Electron 自带 Node.js 与开发机 Node.js 分别验证；安装包必须脱离开发环境运行。
- 在引入依赖时说明用途；不提前安装云服务、全局状态库或第二套路由框架。
- 生产构建包含 Electron 主进程、preload、Remix 客户端与服务端产物，验证资源路径与原生模块。

脚本约定如下；test:e2e 仍为规划：

| 脚本                | 约定职责                                      |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Web 热更新预览；桌面用 build + desktop 启动   |
| `pnpm typecheck`    | 检查主进程、preload、客户端、服务端与公共契约 |
| `pnpm lint`         | ESLint 与导入边界检查                         |
| `pnpm format:check` | Prettier 格式检查                             |
| `pnpm test`         | 单元与集成测试                                |
| `pnpm test:e2e`     | Electron 关键路径冒烟测试                     |
| `pnpm build`        | 构建全部生产产物                              |
| `pnpm package`      | 生成当前平台可验证的桌面分发产物              |

## 5. 测试与完成标准

计划使用 Vitest 覆盖纯逻辑与服务集成，使用 Playwright 的 Electron 能力验证桌面关键路径，版本在脚手架阶段确定。

重点测试：请求校验、会话鉴权、IPC 来源限制、流解析分块、取消传播、重复请求、数据库迁移与服务退出。测试使用模拟 Provider 和临时数据库，默认不消耗真实模型额度。

业务变更完成前需通过相关测试、类型检查与 lint。触及进程或构建流程时还需生产构建与打包后冒烟，覆盖启动、加载、退出及无残留进程。修改纯文档时检查链接、格式和内容一致性即可。

不能把没有运行过的命令、未实现的测试或开发模式验证表述为生产验证成功。

## 6. Git 与文件

- 默认主分支为 `main`；代理创建的分支使用 `codex/<topic>` 前缀。
- 提交使用 `type: 简要说明`，例如 `docs: 建立桌面应用架构规范`。
- 每次提交围绕一个可解释的改动；提交前检查 diff 与暂存内容。
- 不自动推送、不改写已有提交、不提交与本次任务无关的用户改动。
- 依赖、构建输出、真实环境变量、日志、数据库与凭据不进入版本库。示例环境文件只放占位值。
- 文件统一 UTF-8、LF、末尾换行。编辑器约定由 .editorconfig 定义，Git 换行由 .gitattributes 定义。

## 7. 架构调整

涉及框架替换、进程边界、通信方式或持久化模型的变更，在 docs/decisions/ 中按需新增编号决策记录，说明背景、选择、代价与迁移方式。固定技术栈的替换先取得用户明确决策，普通实现细节依照本规范推进。
