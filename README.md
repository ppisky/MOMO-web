# MOMO Web

基于 Chatbox 原界面的 MOMO 网页，活动源码在 apps/momo。已移除 Electron。回到原仓库继续开发时，保留 MOMO-app 已完成的 Core 接入、角色、独立记忆/NSG、空间、模型参数组和提示词；ron 兼容暂缓。此前只启动旧 renderer 的回退已纠正，见 [0007](docs/decisions/0007-preserve-core-progress.md)。

## 运行

使用 pnpm 10.33.0。应用脚本使用 pnpm 提供的 Node 26.11.1，根目录启动器支持系统 Node 22.20+。

1. 根目录执行 pnpm install、pnpm setup。
2. 单独启动兼容的 MOMO-core；已验证 revision 为 c44f5ffee737f5915f9baae20b49a33717eaced1。
3. 复制 apps/momo/.env.example 为 .env.local，填写 MOMO_CORE_ORIGIN（仅 loopback）。已有配置必须让 MOMO_APP_DATA_DIR 指向原 host-config.sqlite3 所在目录，保留 Space ID、参数组和当前空间；不搬动或重新初始化 Core 数据。
4. 根目录执行 pnpm dev，打开 http://127.0.0.1:1212/。

本机 .env.local 已连接既有 Core 和既有宿主配置，不提交这些本地路径。新安装未配置时 Core 默认 http://127.0.0.1:8765，宿主目录默认 LOCALAPPDATA/MOMO-App。若全局 pnpm 不一致，可先 npx --yes pnpm@10.33.0 install，再使用根目录 node_modules/.bin/pnpm.cmd。

生产执行 pnpm build、pnpm preview。build 同时生成 dist/web 浏览器资源和 dist/host 服务端模块；preview 使用相同 /api 适配，默认端口 1212。需要停止占用该端口的 dev。不能仅部署静态文件而省略 API 宿主。

## 当前能力

- Core 角色卡完整字段（版本、作者/链接、人物设定、用户设定、开场白）编辑；默认助手、对话创建/改名、历史、流式回复/取消/重试。角色卡“新对话”直接创建对话并显示已保存的开场白。
- 独立记忆 /memory、语义网 /nsg：新增、编辑、归档/恢复，配置正文/节点语义、范围与带类型/方向/权重的边。来源保持；正文与授权在 Core 原子提交，过期编辑返回冲突。
- 独立 MO State 设置 /settings/mo-state：个人空间配置、继承恢复、运行状态、状态契约；MOC 导出 /settings/moc：一次选范围，角色、对话、记忆与语义网、使用配置四组快速选择，支持展开细选与“部分”状态，摘要/下载保持可见。保留逐组件空间选择、具体角色、兼容格式和密码加密；全局连接/参数/提示词/界面偏好与个人空间配置明确区分。
- 空间创建/改名/切换，以及带资产清点、用户选择和冲突处理的删除/迁移；至少保留一个。
- 自定义模型服务商、文本/视觉/向量化分类；对话参数组与独立用途模型，视觉回退和语义网向量化入口按已配置类型显示。向量化实际接入 Core 索引与检索；可直接编辑对话请求参数 JSON，stream 与开关及实际 Core 请求一致，后台用途不继承这份 JSON。上下文长度允许留空，不能设置为 0。温度、Top P、最大输出留空继承，最大输出不能为 0。具体边界见 [0010](docs/decisions/0010-model-types-and-purposes.md)。
- 通用设置统一管理全部提示词空间，包括记忆提取和语义网维护；独立记忆/NSG 设置只管理自动维护与生命周期策略，不重复提示词选项。保留对话显示与外观设置。Enter 发送、Shift+Enter 换行，IME 不发送；没有快捷键设置和“仅保存不回复”。

Core 拥有角色、会话、记忆和 NSG；Web 宿主保存空间目录和参数组。浏览器只保存界面偏好/装饰资源，活动入口不再运行旧 IndexedDB 聊天引擎。旧 renderer 源码和浏览器数据保留，没有清空或偷偷导入另一套数据。

MOC 仅携带已修改的提示词空间，内置正文由 Core 提供；恢复默认后不再导出。MO State 页解释闭环自治与 V1 状态投影的实际职责。模型参数页沿用原结构，按用户是否配置对应类型显示用途入口，撤销此前未确认的折叠布局提案。

本轮落实范围见 [0008](docs/decisions/0008-editable-assets-state-export.md) 和 [0009](docs/decisions/0009-settings-and-portable-configuration.md)。角色简介/头像/背景等展示资产、NSG 治理候选审批、完整来源审计界面、对话归档/分支/篇章仍有缺口；不要把资产归档误认为对话归档。继续依据 [产品边界](docs/product-boundaries.md) 和 [计划](docs/roadmap.md) 实施。

- [架构](docs/architecture.md) · [开发和验证](docs/development.md) · [验证记录](docs/validation.md)
- [来源](UPSTREAM.md) · [GPL-3.0](LICENSE)
