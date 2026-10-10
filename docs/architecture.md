# 当前架构

2026-10-09 按 [0007](decisions/0007-preserve-core-progress.md) 纠正切仓库引起的功能回退。原仓库独立安装/构建/运行；没有对 MOMO-app 源码或 5178 服务的运行依赖。ron 留待网页稳定后兼容。0008 的角色全字段创建、原子开场、资产原子编辑和 MO State 契约读取修复在独立 Core 仓库实现；不修改 ron。

## 活动结构

- apps/momo/src/renderer/index.html、product-entry.tsx：网页入口；不再导入旧 index.tsx。
- apps/momo/src/product/ui/web：此前从原 Web 适配的 Mantine/MUI 页面、主题与组件；迁回后在本仓库维护。
- src/product/features：聊天流控制和空间目录操作；src/product/contracts：运行时校验与类型。
- src/product/routes/api.*：有限的业务 HTTP 处理器，去除 Remix 类型依赖，交给框架无关的 Request/Response 端口。
- src/product/lib/server：Core 客户端、宿主 SQLite 配置和 Node HTTP 转接。服务端模块以 .server.ts 隔离。
- scripts/product-host-plugin.ts：Vite dev 和 preview 共用同源 /api；scripts/build-product-host.mjs 构建生产服务模块。
- dist/web 与 dist/host：忽略的浏览器与服务产物。

独立模型参数演示位于 `apps/momo/demos/model-parameters`。其 Vite 配置复用正式构建约束与主题，在演示模块图中将 Web API 替换为离线适配，移除生产 API 宿主插件；正式 ModelParameters、RequestParameterJson、PurposeRequestJson 源码不变。输出 `dist/model-parameters-demo` 纯静态站点，保存到独立 origin 的浏览器本地存储；不依赖或修改 Core、宿主数据库和服务商配置。见 [0012](decisions/0012-model-parameters-demo.md)。

旧 renderer、shared 与 Chatbox 业务包保留作原功能的迁入参照，不与 Core 双写，也不能据此宣称这些能力已接入。原浏览器数据没有清除。Electron main/preload、IPC、桌面安装/打包工具链继续移除。

## 数据与请求

浏览器 → 同源白名单 /api → Core HTTP/SSE。只接受绑定端口的 loopback Host；拒绝跨 Origin 请求，写入要求同源 Origin 和 JSON，输入限制 64 KiB。Core 管理命令必须经过已登记处理器和 Space 归属校验，不提供任意 URL、磁盘或命令代理。SSE 按块返回，保留终态、客户端断开、取消和重试语义。

Core 保存角色、历史、记忆/NSG、提示词与运行策略。模型账号由 momo-server 宿主配置适配器管理，不由 Core 库启动时读取；密钥不回显到浏览器。Web SQLite 保存空间目录、参数组及幂等请求参数快照。沿用原配置目录即可保留 Space UUID，不复制一份聊天库。

界面偏好/装饰图像使用浏览器本地存储。不同网页 origin 的偏好不会自动互通；本轮不新增旧格式导入。未来桌面通过已有宿主端口适配，不把 Node 实现塞回 Core 或 ron。

## 配置与导出

Web 的 api.assets 只校验宿主授权和表单，将完整内容、RecordPolicy 和 revision 一起交给 Core；不自己写资产文件。Core 区分个人 Space 与存储 Space。世界选项通过实际 MemoryIdentity 获取，不以对话 ID 猜共享世界。原目标对话消失后可保留绑定继续编辑，不能自动扩大注入范围。

MO State 复用 runtime-settings 稀疏 PATCH、契约 CAS 和运行状态。MOC 路由只接受模块/空间/角色选择，由宿主生成临时路径、流式返回下载并清理文件；不接收浏览器指定的文件路径，不持久化密码。Core 保存/导出边界不复制到 UI。具体提交组合见 sources/runtime-combination.json。

MOC 的快速分组只在 Web 选择层将范围映射到既有导出计划，细选与快速开关共用同一份选择，不新增后端导出协议。全局配置和空间配置仍按各自的实际归属导出。

提示词资源契约独立位于 contracts/prompts.ts，资源管理和 MOC 导出共用来源校验。导出只接受 Core 标记的 override 正文；服务端重新核对，builtin 不生成提示词模块，不在 Web 复制 Core 的内置值。

stream 是浏览器输出偏好，也是本次 Core 请求的显式控制字段；参数 JSON 显示和修改同一偏好，供应商扩展参数仍禁止带入 stream。宿主首次请求快照冻结该布尔值。关闭流式时 Core 返回完整 JSON，宿主适配为一个完成事件供页面沿用终态投影；开启时转发真实增量 SSE。旧快照未记录该字段时沿用当时固定开启的行为。

## 构建约束

后台用途配置按 [0011](decisions/0011-background-request-defaults.md) 实施：Core 原生 `POST /v1/momo/model-requests/resolve` 提供推荐值、约束、差量覆盖与有效结果，Web 经同源 `POST /api/purpose-parameters` 转接。编辑器主动就地展开，宿主参数配置与 MOC 只保存自定义部分；未修改继续发送 model-only 路由并跟随 Core 推荐值。无新空间、业务数据库或第二套生成流程。

用途配置按 [0010](decisions/0010-model-types-and-purposes.md) 直接引用符合类型的模型；对话请求参数 JSON 不参与后台用途。独立生成覆盖随 model_routes 传输；向量化选择、维数及独立 profile 覆盖冻结进请求，由 Core 宿主解析不可变连接。Core 复用增量索引和查询，双方使用同一有效 profile；未选择时显式关闭向量请求，不影响普通检索。Core 的向量降级在对话页使用现有 Alert 显示，不把降级回复误报为向量化已成功。

现有 Vite 7、React 18、pnpm 10 保持不变。实际浏览器模块图禁止 .server.ts、Node 内建模块和 Electron；生产宿主单独构建，不把 Core 地址、配置目录或密钥注入客户端环境。check:web 继续检查无 Electron 依赖、原生桥和启动脚本。

0009 增补：模型未声明上下文长度和功能路由额外参数修在 Core；Web 参数 JSON 与表单、请求重放共用一份参数组。记忆生命周期仍存 Core mo_state.memory_lifecycle，页面放在记忆与语义网；MO State 恢复继承不清除此块。通用设置统一管理全部提示词空间，记忆与语义网页不重复编辑器。MOC 配置使用既有 HostMocModule，Web 从白名单资源生成扩展快照，不给 Core 增加 Web 设置数据库依赖。配置导出路径及临时文件仅由服务端管理。
