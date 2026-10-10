# 日常服务启动与设置去重验证

2026-10-10。沿用 2026-10-09 的 Web 工作区成果和 Core 独立提交 c44f5ffee737f5915f9baae20b49a33717eaced1；App、ron 未修改。

- 启动前确认 1212、18876 未监听，原 Core 无运行进程；原数据目录在服务启动前完成本地备份。组合启动命令曾被自动审批以 blocked by policy 拒绝，未执行；拆为单独复制备份和不含删除/终止操作的前台启动后成功。
- Core 18876 已实际启动，健康接口确认沿用原数据目录；Web 1212 使用 pnpm build 后的 pnpm preview，API 宿主接同一 Core。开发服务曾停在启动画面，未将开发模式浏览器验证写为通过；当前生产资源页面已实际加载。
- 日常 Web 的身份绑定、含归档范围的 NSG 列表、运行策略、MO State 运行状态/契约和提示词读取均返回 200。此前旧 Core 导致的 405/422 能力不匹配在当前实例已消除。
- 现有 2 个个人空间目录、参数/模型、角色、对话及历史、记忆、NSG 和来源哈希与启动前记录完全一致：当前空间仍为 1 个角色、1 个对话、1 条记忆和 1 个 NSG；另一空间为空。没有重新初始化或导入测试资产。
- 通用设置是唯一的提示词管理入口，包含全部 6 个空间。日常浏览器实点记忆提取，内置提示词内容读取成功；下拉同时含语义网维护。独立“记忆与语义网”页仅呈现维护/生命周期配置，无重复提示词编辑器，MO State 保持独立。未修改用户配置来测试表单。
- 严格类型检查、31 项产品单元测试、无 Electron 边界和生产浏览器/宿主构建再次通过；应用脚本实际 Node v26.11.1。浏览器控制台无 warn/error；构建仍有既有 Tailwind 类名和 chunk 体积提示。验证截图在忽略目录 .cache/settings-memory-20261010.png 与 .cache/settings-general-prompts-20261010.png。

以下是 2026-10-09 的隔离测试及当时未升级日常服务的历史记录；日常服务状态以本节为准。配置快照导入恢复与真实付费供应商仍未验证。

---

# 设置与配置组件导出增补验证

2026-10-09。Web 基线 bf5274c；Core 独立提交 c44f5ffee737f5915f9baae20b49a33717eaced1。设计见 [0009](decisions/0009-settings-and-portable-configuration.md)。App、ron 未修改。

- 严格类型、无 Electron 边界、生产浏览器/宿主构建通过；31 项产品单元测试通过。新表单/导出组件 Biome lint 无错误，保留 6 项警告，不宣称全仓零警告；构建保留原 Tailwind 类与大 chunk 提示。
- 真实 Core HTTP：模型上下文 null 持久化、0 拒绝；JSON 额外 frequency_penalty 到达实际离线模型请求，空采样/输出仍省略，重试保持快照。功能模型路由可携带额外参数，继续交由 Core RequestOverridePolicy 管理；空参数映射省略序列化保持既有指纹。
- MOC 配置单独导出：解压实际包，核对 13 个宿主扩展模块（连接、参数、偏好、个人空间目录、提示词及 8 类个人空间配置），不含未选空间、未选业务资产、模型密钥或本机图片引用。配置单独密码加密导出成功，无明文配置和密码。此前资产范围/加密/非法选择回归同时通过。
- 隔离生产浏览器 12209：上下文输入 0 失焦后变为合法下界，再清空保存，刷新仍空；JSON 非法时不能保存，修改温度及供应商参数保存刷新保留；生命周期衰减系数 0.85 保存刷新保留；选择连接、参数、界面偏好、记忆提取提示词与一个个人空间生命周期，实际收到 MOC 下载。控制台无 warn/error。截图在忽略目录 .cache/settings-config-export-verified.png。
- Core Rust 1.99.0：新增可选上下文单测通过；momo-server/momo_core all-targets clippy -D warnings、fmt 通过，服务二进制构建完成。未改工具链。

日常服务状态：1212 仍连接原 18876 Core。健康、状态和运行策略可读；身份绑定 GET 返回 405，带 include_archived 的 NSG 列表返回 422，已确认旧版本不具备新接口/字段。Web 现在返回明确 core_version_mismatch，不静默丢弃归档范围；连接异常与超时也分开描述。此前停止/备份/重启操作被自动审批拒绝，本轮未重复或绕过该操作，新二进制只用于隔离验证。本机日常实例的新业务能力仍未通过，不能将本轮测试写成已升级。

既有空间目录、参数、模型、角色、历史、记忆、NSG 与来源哈希复核未变化。

配置扩展当前为可携带快照；应用导入恢复、本机图片文件导出、付费供应商及 ron 不在本轮验证内。导出各组件不会将完整运行快照伪装成配置。

---

# 角色配置、资产编辑、MO State 与 MOC 验证

日期：2026-10-09。Web 基线 669f057，Core 独立提交 60ae97aff99398b835311c716759d59d06dbce67。App 与 ron 未修改。此前只读恢复记录保留在下方，不作为本轮完成范围。

- TypeScript 严格检查、无 Electron 边界、生产浏览器/宿主构建通过。28 项产品单元测试通过。
- 真实 Web HTTP → 独立 Core → 本地离线模型：角色全字段创建/更新、首条开场消息持久化和不重复；检查真实模型请求含开场白、用户设定、编辑后的记忆与 NSG 约束。
- 记忆与 NSG 新建、编辑、归档/恢复、正文与授权原子提交、过期 revision 拒绝、来源第一条修订保持。NSG 同图有向边与 world 绑定实际保存。删除目标对话后，记忆仍可编辑并保留原绑定，不自动扩大范围。
- MO State 空间稀疏覆盖/继承恢复、状态读取、状态契约保存/恢复与 CAS 冲突通过。真实对话后读取契约暴露的 recovery admission 缺口已修于 Core，并有回归测试。
- MOC 下载后用 Zstandard 解压并检查 tar 清单/角色负载：只含选定模块、空间和角色，不含未选空间、未选角色或模型密钥；口令保护包不含明文角色/口令。非法跨空间角色选择拒绝。
- 真实 Core 空间迁移/删除/最后一个空间保护回归通过。
- 隔离生产 preview 12209 的浏览器操作：创建作者/设定/开场齐全的合成角色；角色卡“新对话”直接显示真实开场，刷新仍只有一条；记忆正文修改、归档和恢复；NSG 约束修改刷新保留；MO State 最大协调步数改为 5，保存刷新保留；MOC 指定一个合成角色后收到真实下载。控制台没有 error/warn。截图在本机忽略目录 .cache/moc-configuration-verified.jpg 与 .cache/role-opening-verified.jpg。隔离服务已停止，未改真实资产。
- Core 使用 Rust 1.99.0：asset_editing/default_assistant 共 3 项、契约恢复单测 1 项通过；受影响四个 crate all-targets clippy `-D warnings`、fmt 通过。并行链接曾因 Windows 页面文件不足失败，改 `-j 1` 后通过，未改系统/工具链。
- Web 新增及主要编辑表单的 Biome lint 没有错误，保留 12 项警告（含 React 导入、依赖列表、索引 key、非空断言）；不宣称全仓 lint 零警告。构建仍有原有 Tailwind 类名与大 chunk 提示。

## 本机运行状态

代码与隔离实测使用新 Core；日常 1212 仍连接旧 18876 Core。尝试停止旧进程、备份原数据并启动新二进制时，自动审批返回 blocked by policy，命令未执行，未给出更具体原因。当前服务尚未替换，不能宣称本机日常实例已通过新功能验收。新二进制已构建，切换步骤需要解决该审批限制。

替换前记录了现有空间目录、参数/模型、角色、对话/历史、记忆、NSG 与 provenance 的哈希（只存哈希，不输出私有内容）；2 个空间中当前空间仍是 1 个角色、1 个对话、1 条记忆和 1 个 NSG。用户数据没有删除、复制到新业务数据库或重新初始化。Core 更新应沿用同一数据目录。

不覆盖：付费供应商、所有平台/附件、角色简介/头像等展示元数据、治理审批/完整来源审计、对话归档/分支/篇章、ron 桌面。MOC 按 Core 范围：对话/记忆/NSG 按空间，角色可按 ID；没有伪造逐消息/逐节点导出。

---

# Web 既有 Core 功能恢复验证

日期：2026-10-09。Web 基线 d25351d；迁入来源 MOMO-app e664a9007fe523d1c3c24e9ad1edc7ce401e57ef；独立 Core 测试使用 32c2088d96b93d2d985950c5898fbe556f373d24。本轮未修改 Core 或 ron。

- pnpm check 严格类型、pnpm check:web、pnpm build 通过。浏览器产物与 Node 宿主分别构建；实际客户端模块图排除服务端模块和 Electron。
- 新增宿主、入口与 HTTP 测试文件的 Biome check（6 个文件）通过。
- pnpm test:product：28 项通过，含 Core DTO、Space CAS/迁移、参数快照/空值、SSE 终态/断流与新增 HTTP Host/Origin/白名单、64 KiB 定长/分块输入限制、首块实时返回及断开取消。
- pnpm test:product:resources：真实 Web HTTP 宿主 → 独立 Core → 离线模型，通过角色编辑/默认助手/历史、模型发现/凭据脱敏、参数策略/用途/实际请求、幂等重放、提示词保存恢复、资产读取和 Space 隔离。
- pnpm test:product:spaces：独立真实 Core 与宿主 SQLite，资产清点、迁移保留身份、删除和最后一个空间保护通过。
- 只读对比 1212 与原 App 的 workspace、parameters、models、memory、NSG、两份 provenance，响应一致。现有 2 个空间、当前 1 个角色/1 个对话、1 条记忆/1 个 NSG 节点沿用同一数据；没有复制、删除或重建资产。
- 浏览器 1212：独立记忆能点击查看原内容，NSG 显示原节点；设置有模型参数组/用途模型、留空继承说明，无快捷键导航。
- 浏览器隔离生产 preview 12209：真实键盘 Shift+Enter 保留两行草稿，Enter 经真实 Core 获得离线模型回复；刷新后恰好 user/assistant 两条历史。参数页面把温度/Top P/最大输出清空并保存，API 持久值全部 null，刷新仍为空，无 0 占位。浏览器控制台无 error/warn。隔离测试进程已结束。
- 不覆盖真实付费模型、完整记忆/NSG 编辑、完整角色卡/开场白、归档/分支/篇章及 ron 桌面。保留既有缺口，见 product-boundaries.md。
- 构建保留体积提示（主 chunk 大于 500 KiB）和既有 Tailwind 工具类提示；pnpm 启动器 Node 22 引擎警告与实际脚本 Node 26 已区分。不是全仓 lint 零警告声明。

以下保留上一轮清理的历史证据，其“未接 Core/快捷键待移除”描述已由本轮更正，不能作为当前行为。

---

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
