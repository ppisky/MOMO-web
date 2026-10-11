# MOMO Web

MOMO Web 是基于 Chatbox 界面的角色扮演网页，通过 MOMO-core 提供角色、对话、长期记忆、语义网与 MO State。活动源码位于 `apps/momo`，浏览器与本机 Node 宿主分别构建；已移除 Electron，ron 桌面兼容暂缓。两个项目保持独立维护，通过原生 HTTP/SSE 接入。

[网页源码](https://github.com/ppisky/MOMO-web) · [Core RC6](https://github.com/ppisky/MOMO-core/releases/tag/v1.0.0-rc.6) · [网页 CI](https://github.com/ppisky/MOMO-web/actions/workflows/web.yml)

## 运行

使用 pnpm 10.33.0。应用脚本使用 pnpm 提供的 Node 26.11.1，根目录启动器支持系统 Node 22.20+。

1. 根目录执行 `pnpm install --frozen-lockfile`、`pnpm --dir apps/momo install --frozen-lockfile`。
2. 单独启动 MOMO-core `v1.0.0-rc.6`；已验证 revision 为 `c61a7419dac1cbf1421e0b4bd4e35a3944d4c0f5`，见 [配套运行](docs/core-integration.md)。
3. 复制 apps/momo/.env.example 为 .env.local，填写 MOMO_CORE_ORIGIN（仅 loopback）。已有配置必须让 MOMO_APP_DATA_DIR 指向原 host-config.sqlite3 所在目录，保留 Space ID、参数组和当前空间；不搬动或重新初始化 Core 数据。
4. 根目录执行 pnpm dev，打开 http://127.0.0.1:1212/。

新安装未配置时 Core 默认 `http://127.0.0.1:8765`。宿主目录在 Windows 默认 `LOCALAPPDATA/MOMO-App`，未设置 LOCALAPPDATA 时位于工作目录的 `MOMO-App`；可通过 `MOMO_APP_DATA_DIR` 指定持久目录。`.env.local`、数据和凭据不提交到仓库。若全局 pnpm 不一致，可先 `npx --yes pnpm@10.33.0 install --frozen-lockfile`，再使用根目录 `node_modules/.bin/pnpm.cmd`。

生产执行 pnpm build、pnpm preview。build 同时生成 dist/web 浏览器资源和 dist/host 服务端模块；preview 使用相同 /api 适配，默认端口 1212。需要停止占用该端口的 dev。不能仅部署静态文件而省略 API 宿主。

仅看模型参数：执行 `pnpm demo:parameters`，打开 http://127.0.0.1:1213/。预置文本、视觉和向量化演示模型，不需要 Core、服务商或密钥；复用正式页面，支持选择、参数组、JSON 编辑、保存和恢复，修改仅保存在该演示 origin。独立生产演示用 `pnpm build:demo:parameters`、`pnpm preview:demo:parameters`，可单独托管 `dist/model-parameters-demo` 静态文件。见 [演示边界](docs/decisions/0012-model-parameters-demo.md)。

## 当前能力

- Core 角色卡完整字段（版本、作者/链接、人物设定、用户设定、开场白）编辑；默认助手、对话创建/改名、历史、流式回复/取消/重试。角色卡“新对话”直接创建对话并显示已保存的开场白。对话行可归档，设置“已归档对话”可恢复，保留原身份与全部历史。
- 独立记忆 /memory、语义网 /nsg：新增、编辑、归档/恢复，配置正文/节点语义、范围与带类型/方向/权重的边。来源保持；正文与授权在 Core 原子提交，过期编辑返回冲突。
- 独立 MO State 设置 /settings/mo-state：个人空间配置、继承恢复、运行状态、状态契约；MOC 导出 /settings/moc：一次选范围，角色、对话、记忆与语义网、使用配置四组快速选择，支持展开细选与“部分”状态，摘要/下载保持可见。保留逐组件空间选择、具体角色、兼容格式和密码加密；全局连接/参数/提示词/界面偏好与个人空间配置明确区分。
- 空间创建/改名/切换，以及带资产清点、用户选择和冲突处理的删除/迁移；至少保留一个。
- 自定义模型服务商、文本/视觉/向量化分类；对话参数组与独立用途模型，视觉回退和语义网向量化入口按已配置类型显示。向量化实际接入 Core 索引与检索；可直接编辑对话请求参数 JSON，stream 与开关及实际 Core 请求一致，后台用途不继承这份 JSON。上下文长度允许留空，不能设置为 0。温度、Top P、最大输出留空继承，最大输出不能为 0。具体边界见 [0010](docs/decisions/0010-model-types-and-purposes.md)。
- 通用设置统一管理全部提示词空间，包括记忆提取和语义网维护；独立记忆/NSG 设置只管理自动维护与生命周期策略，不重复提示词选项。保留对话显示与外观设置。Enter 发送、Shift+Enter 换行，IME 不发送；没有快捷键设置和“仅保存不回复”。

Core 拥有角色、会话、记忆和 NSG；Web 宿主保存空间目录和参数组。浏览器只保存界面偏好/装饰资源，活动入口不再运行旧 IndexedDB 聊天引擎。旧 renderer 源码和浏览器数据保留，没有清空或偷偷导入另一套数据。

MO State 管理入口位于侧栏 `/mo-state`：当前个人空间的状态快照、场景与五维约束、输入依据、规则版本、最近 20 次处理及实际注入审计；角色侧写缓存可查询/重置。运行配置继续在 `/settings/mo-state`。管理查询不会调用模型，旧记录缺少回复关联时明确显示注入未知，见 [0015](docs/decisions/0015-mo-state-management.md)。

MOC 仅携带已修改的提示词空间，内置正文由 Core 提供；恢复默认后不再导出。MO State 页统一显示“闭环自治”和“状态投影”，版本对应关系放在说明中。模型参数页沿用原结构，按用户是否配置对应类型显示用途入口，撤销此前未确认的折叠布局提案。

后台用途请求配置按 [0011](docs/decisions/0011-background-request-defaults.md) 实施：Core 提供推荐值和校验接口，满足模型条件后在当前用途下主动展开 JSON，支持删除覆盖恢复推荐值。宿主及 MOC 仅保存自定义部分；对话 JSON 独立且保持直接显示，不新增模型请求空间。

本轮落实范围见 [0008](docs/decisions/0008-editable-assets-state-export.md)、[0009](docs/decisions/0009-settings-and-portable-configuration.md) 和 [0014](docs/decisions/0014-conversation-archive.md)。角色简介/头像/背景等展示资产、NSG 治理候选审批、完整来源审计界面、对话删除/分支/篇章仍有缺口。继续依据 [产品边界](docs/product-boundaries.md) 和 [计划](docs/roadmap.md) 实施。

- [架构](docs/architecture.md) · [开发和验证](docs/development.md) · [验证记录](docs/validation.md)
- [网页与 Core 配套运行](docs/core-integration.md) · [开源准备](docs/decisions/0016-open-source-release.md)
- [来源](UPSTREAM.md) · [源码 GPL-3.0](LICENSE) · [MOMO 图标 CC BY-SA 4.0](public/brand/README.md)

2026-10-11：[0013](docs/decisions/0013-openai-requests-and-embedding-dimensions.md) 落实 OpenAI 兼容默认 Chat、直接 Responses 和向量维数默认继承。向量请求 JSON 只显示供应商参数，手填维数与 dimensions 双向同步；不再预填 1536，也不显示内部 profile 字段。演示与正式页面共用组件，Core 负责实际维数、索引与协议适配。
